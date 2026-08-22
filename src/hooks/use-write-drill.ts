import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSelector } from "@tanstack/react-store"
import { getKana, requireKana } from "@/lib/kana"
import { writableIds } from "@/lib/kana/strokes"
import { isMastered, poolUpTo } from "@/lib/journey"
import { milestoneAt } from "@/lib/pressure"
import { playEffect } from "@/lib/sound"
import { nextKana } from "@/lib/scheduler"
import { lessonOf, progressionStore, touchDay } from "@/stores/progression.store"
import { selectedIds, selectionStore } from "@/stores/selection.store"
import { settingsStore } from "@/stores/settings.store"
import {
  countWriteSession,
  recordWriteAnswer,
  recordWriteSessionStreak,
  writingAsProgress,
  writingStore,
} from "@/stores/writing.store"
import {
  endSession,
  sessionStore,
  showPick,
  startSession,
} from "@/stores/session.store"

/** How long the completed character stays on screen before the next prompt. */
const ADVANCE_AFTER_CLEAN = 650
/** A completion with mistakes holds longer so the red feedback can register. */
const ADVANCE_AFTER_MISSED = 1100

/**
 * The Write drill: same session model as the reading drill, but the answer is
 * a completed hanzi-writer quiz instead of typed rōmaji.
 *
 * What it deliberately does NOT reuse from the reading drill: confusion
 * bursts and lesson pacing (both are typing concepts — see
 * `writingAsProgress`), the timed mode (a clock over handwriting punishes
 * careful strokes), and the read/retype retry loop (the canvas already forces
 * every stroke to land before the character completes).
 */
export function useWriteDrill() {
  const session = useSelector(sessionStore, (s) => s)
  const settings = useSelector(settingsStore, (s) => s)
  const selection = useSelector(selectionStore, (s) => s)
  const progression = useSelector(progressionStore, (s) => s)
  const writing = useSelector(writingStore, (s) => s)

  // The unlocked/selected pool minus digraphs — Write drills one glyph at a
  // time (see `isWritable`). Reading keeps serving them untouched.
  const pool = useMemo(
    () =>
      writableIds(
        progression.mode === "journey"
          ? poolUpTo(progression.track, lessonOf(progression, progression.track))
          : selectedIds(selection)
      ),
    [progression, selection]
  )

  const kana = session.current ? getKana(session.current.id) : undefined

  /**
   * Per-prompt bookkeeping fed by hanzi-writer callbacks. Lives outside React
   * state: stroke events must never re-render the drill mid-trace.
   */
  const prompt = useRef({ mistakes: 0, assisted: false, outline: true })

  // Mirrored into state only for the canvas prop; frozen per prompt so a
  // mastery change on completion can't yank the guide off the finished glyph.
  const [outline, setOutline] = useState(true)

  const advance = useCallback(() => {
    const state = sessionStore.state
    const ids = writableIds(
      progressionStore.state.mode === "journey"
        ? poolUpTo(
            progressionStore.state.track,
            lessonOf(progressionStore.state, progressionStore.state.track)
          )
        : selectedIds(selectionStore.state)
    )
    const { pick, state: schedulerState } = nextKana(
      { lastShownId: state.lastShownId, burst: null, sinceBurst: 0 },
      ids,
      writingAsProgress(writingStore.state),
      settingsStore.state,
      Math.random
    )

    // First time this kana is ever written — the drill demos the strokes.
    const introducing =
      !!pick && (writingStore.state.charStats[pick.id]?.attempts ?? 0) === 0

    const stat = pick ? writingStore.state.charStats[pick.id] : undefined
    const showOutline =
      settingsStore.state.writeAlwaysOutline || !isMastered(stat)

    prompt.current = { mistakes: 0, assisted: false, outline: showOutline }
    setOutline(showOutline)
    sessionStore.setState((prev) => ({ ...prev, ...schedulerState }))
    showPick(pick, introducing)
  }, [])

  // Serve the first character once a session is on screen with a non-empty pool.
  useEffect(() => {
    if (session.ended || session.current || pool.length === 0) return
    advance()
  }, [advance, pool.length, session.current, session.ended])

  /** The demo ran on this prompt — the attempt no longer counts for mastery. */
  const markAssisted = useCallback(() => {
    prompt.current.assisted = true
  }, [])

  const strokeCorrect = useCallback(() => {
    playEffect("strokeCorrect")
  }, [])

  const strokeMistake = useCallback(() => {
    prompt.current.mistakes += 1
    playEffect("strokeWrong")
  }, [])

  const complete = useCallback(
    (totalMistakes: number) => {
      const state = sessionStore.state
      if (!state.current || state.phase !== "prompt") return

      const shown = requireKana(state.current.id)

      if (state.attempts === 0) {
        countWriteSession()
        touchDay()
      }

      const correct = recordWriteAnswer({
        kanaId: shown.id,
        // hanzi-writer's own total is authoritative; the per-stroke callback
        // count backs the sounds, not the score.
        mistakes: totalMistakes,
        assisted: prompt.current.assisted,
        outline: prompt.current.outline,
        skipped: false,
        ms: Date.now() - state.shownAt,
      })

      sessionStore.setState((prev) => {
        const streak = correct ? prev.streak + 1 : 0
        return {
          ...prev,
          attempts: prev.attempts + 1,
          correct: prev.correct + (correct ? 1 : 0),
          streak,
          bestStreak: Math.max(prev.bestStreak, streak),
          phase: correct ? "correct" : "retry",
          missedCurrent: !correct,
        }
      })

      // The wrong-stroke tones already played during the trace, so a missed
      // completion stays silent here.
      if (correct && milestoneAt(state.streak + 1) !== null) {
        playEffect("streakMilestone")
      } else if (correct) {
        playEffect("correct")
      }

      setTimeout(advance, correct ? ADVANCE_AFTER_CLEAN : ADVANCE_AFTER_MISSED)
    },
    [advance]
  )

  /** Gives up on the current character and moves on, scoring it as a miss. */
  const skip = useCallback(() => {
    const state = sessionStore.state
    if (!state.current) return

    if (state.phase === "prompt") {
      const shown = requireKana(state.current.id)
      if (state.attempts === 0) {
        countWriteSession()
        touchDay()
      }
      recordWriteAnswer({
        kanaId: shown.id,
        mistakes: 0,
        assisted: prompt.current.assisted,
        outline: prompt.current.outline,
        skipped: true,
        ms: Date.now() - state.shownAt,
      })
      sessionStore.setState((prev) => ({
        ...prev,
        attempts: prev.attempts + 1,
        streak: 0,
      }))
    }
    advance()
  }, [advance])

  /** Stroke data failed to load — move on without scoring anything. */
  const skipUnloadable = useCallback(() => {
    advance()
  }, [advance])

  const finish = useCallback(() => {
    // Write keeps its own streak record — a run of traced characters and a
    // run of read ones are not comparable, so the reading records are never
    // touched here. Same ≥5 floor as the reading drill's record badge.
    const { bestStreak } = sessionStore.state
    const newRecord =
      bestStreak >= 5 && bestStreak > writingStore.state.records.bestSessionStreak
    sessionStore.setState((prev) => ({ ...prev, newRecord }))
    recordWriteSessionStreak(bestStreak)
    endSession()
    playEffect("sessionEnd")
  }, [])

  const restart = useCallback(() => {
    startSession()
    advance()
  }, [advance])

  return {
    session,
    settings,
    progression,
    writing,
    kana,
    pool,
    outline,
    markAssisted,
    strokeCorrect,
    strokeMistake,
    complete,
    skip,
    skipUnloadable,
    finish,
    restart,
  }
}
