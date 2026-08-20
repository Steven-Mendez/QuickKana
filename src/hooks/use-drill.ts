import { useCallback, useEffect, useMemo } from "react"
import { useSelector } from "@tanstack/react-store"
import { getKana, requireKana, resolveTyped } from "@/lib/kana"
import { isCorrect } from "@/lib/kana/romaji"
import { isLessonComplete, lessonAt, poolUpTo, retention } from "@/lib/journey"
import { timeLimitFor } from "@/lib/pressure"
import { LESSON_BOOST_MAX, isPushingPace, lessonBoost } from "@/lib/momentum"
import { nextKana } from "@/lib/scheduler"
import {
  advanceLesson,
  lessonOf,
  progressionStore,
  recordSessionResult,
  touchDay,
} from "@/stores/progression.store"
import {
  countSession,
  progressStore,
  recordAnswer,
} from "@/stores/progress.store"
import { selectedIds, selectionStore } from "@/stores/selection.store"
import { settingsStore } from "@/stores/settings.store"
import {
  endSession,
  sessionStore,
  setInput,
  showPick,
  startSession,
} from "@/stores/session.store"
import type { Lesson } from "@/lib/journey"
import type { SessionState } from "@/lib/types"

/**
 * The lesson currently being introduced, or `null` outside guided mode — free
 * mode has no curriculum, so nothing to pace against.
 */
function currentLesson(): Lesson | null {
  const progression = progressionStore.state
  if (progression.mode !== "journey") return null
  const { track } = progression
  return lessonAt(track, lessonOf(progression, track))
}

/**
 * What the drill draws from. In guided mode the pool is everything unlocked so
 * far, with the current lesson weighted up; in free mode it is exactly what the
 * user ticked in the selector.
 *
 * `lessonStreak` decides how hard that lesson is weighted: the better the user
 * is doing *on the new characters*, the less of the session is spent
 * re-confirming the ones already answered right a dozen times over.
 *
 * Once the section is learned the weight moves to whatever review has slipped,
 * because that is now the only thing standing between the user and the next
 * lesson. Without this the drill would spend its boost drilling five kana that
 * are already mastered while the characters actually blocking the unlock
 * surfaced once every forty prompts.
 */
function currentPool(lessonStreak: number): {
  ids: Array<string>
  boost?: { ids: Set<string>; factor: number }
} {
  const progression = progressionStore.state
  const lesson = currentLesson()
  if (!lesson) return { ids: selectedIds(selectionStore.state) }

  const { charStats } = progressStore.state
  const ids = poolUpTo(progression.track, lesson.index)
  const blocking = isLessonComplete(lesson, charStats)
    ? retention(progression.track, lesson.index, charStats).slipped
    : []

  return {
    ids,
    boost: blocking.length
      ? { ids: new Set(blocking), factor: LESSON_BOOST_MAX }
      : {
          ids: new Set(lesson.ids),
          factor: lessonBoost(lessonStreak, lesson.ids.length),
        },
  }
}

/**
 * The streak the pacing runs on — zero when the user has turned adaptive pacing
 * off, which collapses every momentum curve back to its cold default.
 */
const pacingStreak = (streak: number): number =>
  settingsStore.state.adaptivePace ? streak : 0

/**
 * Where `lessonStreak` goes after one answer.
 *
 * Only the lesson's own characters move it — a review kana answered right says
 * nothing about the section being learned, and that is the whole point of
 * tracking this separately from the session streak.
 *
 * The first sighting of a character is exempt in both directions: the drill
 * shows the reading there, so neither typing it nor fumbling it is evidence.
 */
function nextLessonStreak(
  session: SessionState,
  kanaId: string,
  correct: boolean
): number {
  const lesson = currentLesson()
  if (!lesson || session.introducing || !lesson.ids.includes(kanaId)) {
    return session.lessonStreak
  }
  return correct ? session.lessonStreak + 1 : 0
}

export function useDrill() {
  const session = useSelector(sessionStore, (s) => s)
  const settings = useSelector(settingsStore, (s) => s)
  const selection = useSelector(selectionStore, (s) => s)
  const progression = useSelector(progressionStore, (s) => s)

  const pool = useMemo(
    () =>
      progression.mode === "journey"
        ? poolUpTo(progression.track, lessonOf(progression, progression.track))
        : selectedIds(selection),
    [progression, selection]
  )
  const kana = session.current ? getKana(session.current.id) : undefined

  const advance = useCallback(() => {
    const state = sessionStore.state
    const { ids, boost } = currentPool(pacingStreak(state.lessonStreak))
    const { pick, state: schedulerState } = nextKana(
      {
        lastShownId: state.lastShownId,
        burst: state.burst,
        sinceBurst: state.sinceBurst,
      },
      ids,
      progressStore.state,
      settingsStore.state,
      Math.random,
      boost
    )

    // A kana nobody has ever answered is taught, not tested: the drill shows
    // the reading the first time it comes up.
    const introducing =
      !!pick && (progressStore.state.charStats[pick.id]?.attempts ?? 0) === 0

    sessionStore.setState((prev) => ({ ...prev, ...schedulerState }))
    showPick(pick, introducing)
  }, [])

  // Serve the first character once a session is on screen with a non-empty pool.
  useEffect(() => {
    if (session.ended || session.current || pool.length === 0) return
    advance()
  }, [advance, pool.length, session.current, session.ended])

  const submit = useCallback(() => {
    const state = sessionStore.state
    if (!state.current) return

    // A correct answer holds the screen for a beat before advancing. Hitting
    // Enter again inside that window must not score the same character twice.
    if (state.phase === "correct") return

    const shown = requireKana(state.current.id)
    const typed = state.input.trim()
    if (!typed) return

    // A retry after a miss only unlocks the next character — it is never scored
    // again, so one bad guess cannot drag the accuracy down twice or add a
    // second entry to the confusion matrix.
    if (state.phase === "retry") {
      if (!isCorrect(typed, shown, settingsStore.state.acceptAliases)) {
        sessionStore.setState((prev) => ({ ...prev, input: "" }))
        return
      }
      advance()
      return
    }

    const correct = isCorrect(typed, shown, settingsStore.state.acceptAliases)
    const confusedWith = correct ? null : resolveTyped(typed, shown)
    const ms = Date.now() - state.shownAt

    if (state.attempts === 0) {
      countSession()
      touchDay()
    }

    const { graduated } = recordAnswer(
      {
        kanaId: shown.id,
        expected: shown.romaji,
        typed,
        correct,
        confusedWith,
        ms,
        sessionId: state.id,
      },
      settingsStore.state
    )

    // Computed before the state below is written: the unlock has to be judged
    // on the streak this answer just extended, not the stale one.
    const lessonStreak = nextLessonStreak(state, shown.id, correct)

    // A mastered lesson only unlocks the next one on a correct answer, which
    // is the only moment mastery can have gone up.
    const unlocked =
      correct && progressionStore.state.mode === "journey"
        ? advanceLesson(
            progressionStore.state.track,
            progressStore.state.charStats,
            pacingStreak(lessonStreak)
          )
        : null

    sessionStore.setState((prev) => {
      const streak = correct ? prev.streak + 1 : 0
      return {
        ...prev,
        attempts: prev.attempts + 1,
        correct: prev.correct + (correct ? 1 : 0),
        streak,
        bestStreak: Math.max(prev.bestStreak, streak),
        // A new section starts cold: carrying the run over would hand the
        // lesson after it an unlock nobody earned on its characters.
        lessonStreak: unlocked === null ? lessonStreak : 0,
        graduated: [...prev.graduated, ...graduated],
        unlocked:
          unlocked === null ? prev.unlocked : [...prev.unlocked, unlocked],
        phase: correct ? "correct" : "retry",
        missedCurrent: prev.missedCurrent || !correct,
        input: correct ? typed : "",
      }
    })

    if (correct) {
      // Brief pause so the green state is visible before the next prompt.
      setTimeout(advance, 320)
    }
  }, [advance])

  /**
   * The clock ran out. Scored exactly like a wrong answer — including the
   * retry that follows — because a character you could not read in time is one
   * you do not know yet.
   */
  const timeout = useCallback(() => {
    const state = sessionStore.state
    if (!state.current || state.phase !== "prompt") return

    const shown = requireKana(state.current.id)

    if (state.attempts === 0) {
      countSession()
      touchDay()
    }

    recordAnswer(
      {
        kanaId: shown.id,
        expected: shown.romaji,
        typed: "",
        correct: false,
        confusedWith: null,
        ms: Date.now() - state.shownAt,
        sessionId: state.id,
      },
      settingsStore.state
    )

    sessionStore.setState((prev) => ({
      ...prev,
      attempts: prev.attempts + 1,
      streak: 0,
      lessonStreak: nextLessonStreak(prev, shown.id, false),
      phase: "retry",
      missedCurrent: true,
      input: "",
      timedOut: true,
    }))
  }, [])

  // The authoritative clock. The countdown the user sees ticks separately so a
  // 50ms redraw never touches the rest of the drill.
  const limitMs = timeLimitFor(settings, session.streak)

  useEffect(() => {
    if (limitMs === null || session.phase !== "prompt" || !session.current) {
      return
    }
    const id = setTimeout(timeout, limitMs)
    return () => clearTimeout(id)
  }, [limitMs, session.phase, session.current, session.shownAt, timeout])

  /** Gives up on the current character and moves on, scoring it as a miss. */
  const skip = useCallback(() => {
    const state = sessionStore.state
    if (!state.current) return

    if (state.phase === "prompt") {
      const shown = requireKana(state.current.id)
      recordAnswer(
        {
          kanaId: shown.id,
          expected: shown.romaji,
          typed: "",
          correct: false,
          confusedWith: null,
          ms: Date.now() - state.shownAt,
          sessionId: state.id,
        },
        settingsStore.state
      )
      sessionStore.setState((prev) => ({
        ...prev,
        attempts: prev.attempts + 1,
        streak: 0,
        lessonStreak: nextLessonStreak(prev, shown.id, false),
      }))
    }
    advance()
  }, [advance])

  const finish = useCallback(() => {
    recordSessionResult(sessionStore.state)
    endSession()
  }, [])

  const restart = useCallback(() => {
    startSession()
    advance()
  }, [advance])

  const activeGroup = useMemo(() => {
    if (session.current?.source.type !== "group") return null
    return progressStore.state.groups[session.current.source.groupId] ?? null
  }, [session.current])

  /** Whether the run on this section is long enough to be visibly speeding up. */
  const pushingPace = useMemo(() => {
    if (!settings.adaptivePace || progression.mode !== "journey") return false
    const lesson = lessonAt(
      progression.track,
      lessonOf(progression, progression.track)
    )
    return isPushingPace(session.lessonStreak, lesson.ids.length)
  }, [settings.adaptivePace, progression, session.lessonStreak])

  return {
    session,
    settings,
    progression,
    kana,
    pool,
    limitMs,
    activeGroup,
    pushingPace,
    setInput,
    submit,
    skip,
    finish,
    restart,
  }
}
