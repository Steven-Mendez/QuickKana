import { useCallback, useEffect, useMemo } from "react"
import { useSelector } from "@tanstack/react-store"
import { getKana, requireKana, resolveTyped } from "@/lib/kana"
import { isCorrect } from "@/lib/kana/romaji"
import { lessonAt, poolUpTo } from "@/lib/journey"
import { timeLimitFor } from "@/lib/pressure"
import { lessonBoost } from "@/lib/momentum"
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

/**
 * What the drill draws from. In guided mode the pool is everything unlocked so
 * far, with the current lesson weighted up; in free mode it is exactly what the
 * user ticked in the selector.
 *
 * `streak` decides how hard the lesson is weighted: the better the session is
 * going, the less of it is spent re-confirming characters already answered
 * right a dozen times in a row.
 */
function currentPool(streak: number): {
  ids: Array<string>
  boost?: { ids: Set<string>; factor: number }
} {
  const progression = progressionStore.state
  if (progression.mode !== "journey") {
    return { ids: selectedIds(selectionStore.state) }
  }
  const { track } = progression
  const lesson = lessonOf(progression, track)
  return {
    ids: poolUpTo(track, lesson),
    boost: {
      ids: new Set(lessonAt(track, lesson).ids),
      factor: lessonBoost(streak),
    },
  }
}

/**
 * The streak the pacing runs on — zero when the user has turned adaptive pacing
 * off, which collapses every momentum curve back to its cold default.
 */
const pacingStreak = (streak: number): number =>
  settingsStore.state.adaptivePace ? streak : 0

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
    const { ids, boost } = currentPool(pacingStreak(state.streak))
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

    // A mastered lesson only unlocks the next one on a correct answer, which
    // is the only moment mastery can have gone up. The streak passed here is
    // the one this answer just extended — the session state below has not been
    // written yet, and an off-by-one would ease the bar on stale evidence.
    const unlocked =
      correct && progressionStore.state.mode === "journey"
        ? advanceLesson(
            progressionStore.state.track,
            progressStore.state.charStats,
            pacingStreak(state.streak + 1)
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

  return {
    session,
    settings,
    progression,
    kana,
    pool,
    limitMs,
    activeGroup,
    setInput,
    submit,
    skip,
    finish,
    restart,
  }
}
