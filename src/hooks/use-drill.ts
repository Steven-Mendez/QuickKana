import { useCallback, useEffect, useMemo } from "react"
import { useSelector } from "@tanstack/react-store"
import { getKana, requireKana, resolveTyped } from "@/lib/kana"
import { isCorrect } from "@/lib/kana/romaji"
import { lessonAt, lessonPhase, poolUpTo } from "@/lib/journey"
import { guidedPool } from "@/lib/drill-pool"
import { milestoneAt, timeLimitFor } from "@/lib/pressure"
import { isPushingPace } from "@/lib/momentum"
import { playEffect } from "@/lib/sound"
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
 * What the drill draws from. In guided mode that is `guidedPool` — the new
 * section alone while it is being met, the whole unlocked pool once it is
 * familiar; in free mode it is exactly what the user ticked in the selector.
 */
function currentPool(lessonStreak: number): {
  ids: Array<string>
  boost?: { ids: Set<string>; factor: number }
} {
  const progression = progressionStore.state
  const lesson = currentLesson()
  if (!lesson) return { ids: selectedIds(selectionStore.state) }

  return guidedPool(
    progression.track,
    lesson.index,
    progressStore.state.charStats,
    lessonStreak
  )
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
  const charStats = useSelector(progressStore, (s) => s.charStats)

  // Only practice.tsx's empty-pool check reads this, so the cumulative pool is
  // fine even during focus — a lesson never has fewer than three characters.
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

    const lesson = currentLesson()
    const phaseBefore = lesson
      ? lessonPhase(lesson, progressStore.state.charStats)
      : null

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

    // This answer may have been the one that made the whole section familiar,
    // ending the focus phase. The streak earned there was earned against a
    // pool with no distractors, which says nothing about the mixed pool the
    // gate is about to be judged on — carrying it over would let the momentum
    // discount unlock the next lesson on the very answer that ends focus,
    // skipping review entirely.
    const enteredMix =
      lesson !== null &&
      phaseBefore === "focus" &&
      lessonPhase(lesson, progressStore.state.charStats) === "mix"

    // Computed before the state below is written: the unlock has to be judged
    // on the streak this answer just extended, not the stale one.
    const lessonStreak = enteredMix
      ? 0
      : nextLessonStreak(state, shown.id, correct)

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

    // One sound per answer, rarest event first — never two cues stacked.
    if (unlocked !== null) playEffect("unlock")
    else if (graduated.length > 0) playEffect("graduation")
    else if (correct && milestoneAt(state.streak + 1) !== null)
      playEffect("streakMilestone")
    else playEffect(correct ? "correct" : "wrong")

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

    playEffect("timeout")
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
    // Judged before recordSessionResult raises the bar. The ≥5 floor mirrors
    // the drill's record badge: beating a zero record is not an achievement.
    const { bestStreak } = sessionStore.state
    const newRecord =
      bestStreak >= 5 &&
      bestStreak > progressionStore.state.records.bestSessionStreak
    sessionStore.setState((prev) => ({ ...prev, newRecord }))

    recordSessionResult(sessionStore.state)
    endSession()
    playEffect("sessionEnd")
  }, [])

  const restart = useCallback(() => {
    startSession()
    advance()
  }, [advance])

  const activeGroup = useMemo(() => {
    if (session.current?.source.type !== "group") return null
    return progressStore.state.groups[session.current.source.groupId] ?? null
  }, [session.current])

  /** Which phase the current lesson is in, or `null` outside guided mode. */
  const journeyPhase = useMemo(() => {
    if (progression.mode !== "journey") return null
    const lesson = lessonAt(
      progression.track,
      lessonOf(progression, progression.track)
    )
    return lessonPhase(lesson, charStats)
  }, [progression, charStats])

  /** Whether the run on this section is long enough to be visibly speeding up. */
  const pushingPace = useMemo(() => {
    // Only meaningful in mix: during focus the boost the pace hint describes
    // is not operating at all.
    if (!settings.adaptivePace || journeyPhase !== "mix") return false
    const lesson = lessonAt(
      progression.track,
      lessonOf(progression, progression.track)
    )
    return isPushingPace(session.lessonStreak, lesson.ids.length)
  }, [settings.adaptivePace, progression, journeyPhase, session.lessonStreak])

  return {
    session,
    settings,
    progression,
    kana,
    pool,
    journeyPhase,
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
