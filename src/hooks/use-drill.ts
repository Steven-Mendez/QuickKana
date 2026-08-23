import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSelector } from "@tanstack/react-store"
import { getKana, requireKana, resolveTyped } from "@/lib/kana"
import { isCorrect } from "@/lib/kana/romaji"
import { isWritable, writableIds } from "@/lib/kana/strokes"
import { needsOutline } from "@/lib/writing"
import { lessonAt, lessonPhase, poolUpTo } from "@/lib/journey"
import { nextBlock } from "@/lib/blocks"
import { guidedPool } from "@/lib/drill-pool"
import { milestoneAt, timeLimitFor } from "@/lib/pressure"
import { isPushingPace } from "@/lib/momentum"
import { mergeBestMastery } from "@/lib/stats"
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
  countWriteSession,
  recordWriteAnswer,
  writingAsProgress,
  writingStore,
} from "@/stores/writing.store"
import {
  endSession,
  sessionStore,
  setInput,
  showPick,
  startSession,
} from "@/stores/session.store"
import type { Lesson } from "@/lib/journey"
import type { ExerciseType, SessionState } from "@/lib/types"

/** Failed tries (wrong strokes) before a writing prompt counts as a miss. */
export const WRITE_MAX_TRIES = 3

/** How long the completed character stays on screen before the next prompt. */
const WRITE_ADVANCE_CLEAN = 650
/** A completion with restarts holds longer so the red feedback registers. */
const WRITE_ADVANCE_MISSED = 1100
/** The reveal after the last failed try needs time to be read. */
const WRITE_ADVANCE_FAILED = 1600

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
 * The stats every journey gate is judged on: reading and writing merged,
 * best mastery per character (see `mergeBestMastery`). Either exercise moves
 * the same journey.
 */
const gateStats = () =>
  mergeBestMastery(progressStore.state.charStats, writingStore.state.charStats)

/** Read sightings a lesson character needs before its lesson can pass. */
const MIN_READ_SEEN = 2

/**
 * The extra per-character veto on the lesson gate. With both exercise types
 * on, mastery alone is not enough to pass a lesson: each character must have
 * been read (recognized) at least a couple of times AND written cleanly from
 * memory — without the outline — at least once. Tracing over the guide never
 * satisfies it; with "always show outline" forced on, a clean guided write
 * counts instead, because memory attempts can then never happen.
 */
function charReadyForUnlock(id: string): boolean {
  const config = settingsStore.state
  if (!config.practiceReading || !config.practiceWriting) return true

  const readSeen = progressStore.state.charStats[id]?.attempts ?? 0
  if (readSeen < MIN_READ_SEEN) return false

  const kana = getKana(id)
  if (!kana || !isWritable(kana)) return true

  const writeStat = writingStore.state.charStats[id]
  const written = config.writeAlwaysOutline
    ? (writeStat?.correct ?? 0)
    : (writeStat?.memoryCorrect ?? 0)
  return written >= 1
}

/**
 * Ends the session and stamps its results. Module-level (not hook-bound)
 * because `advance` also ends the session when the pomodoro clock runs out.
 */
function finishSession() {
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
}

/**
 * When the pomodoro clock has run out. Checked at prompt boundaries, so the
 * character being answered always gets resolved before the summary appears.
 */
function sessionTimeUp(): boolean {
  const config = settingsStore.state
  const state = sessionStore.state
  return (
    config.sessionLimitEnabled &&
    state.attempts > 0 &&
    Date.now() - state.startedAt >= config.sessionMinutes * 60_000
  )
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

  return guidedPool(progression.track, lesson.index, gateStats(), lessonStreak)
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

/**
 * One drill, two kinds of prompt. Reading and writing are both part of
 * learning a kana, so a session mixes them: each advance picks an exercise
 * type (either can be turned off in settings, never both) and then a
 * character from that exercise's own adaptive stats. The types come in
 * same-type blocks (see lib/blocks.ts), because reading is answered on the
 * keyboard and writing with the pointer.
 *
 * Reading keeps everything it always had — confusion bursts, lesson pacing,
 * the timed mode. Writing deliberately reuses none of those: bursts and
 * pairing are typing concepts, and a clock over handwriting punishes careful
 * strokes. What writing brings is its own scoring (see lib/writing.ts) and
 * the three-tries rule: a wrong stroke keeps the strokes already accepted
 * and costs a try, and the third wrong stroke fails the character and
 * reveals the answer.
 *
 * Both exercises move the same journey: gates are judged on the merged
 * best-of-both stats, and — when both types are on — a lesson only passes
 * once each character was also read a couple of times and written cleanly
 * from memory (see `charReadyForUnlock`).
 */
export function useDrill() {
  const session = useSelector(sessionStore, (s) => s)
  const settings = useSelector(settingsStore, (s) => s)
  const selection = useSelector(selectionStore, (s) => s)
  const progression = useSelector(progressionStore, (s) => s)
  const charStats = useSelector(progressStore, (s) => s.charStats)
  const writeCharStats = useSelector(writingStore, (s) => s.charStats)

  // Only practice.tsx's empty-pool check reads this, so the cumulative pool is
  // fine even during focus — a lesson never has fewer than three characters.
  // With reading off, only what the writing drill can serve counts.
  const pool = useMemo(() => {
    const base =
      progression.mode === "journey"
        ? poolUpTo(progression.track, lessonOf(progression, progression.track))
        : selectedIds(selection)
    return settings.practiceReading ? base : writableIds(base)
  }, [progression, selection, settings.practiceReading])

  const kana = session.current ? getKana(session.current.id) : undefined

  /**
   * Per-prompt writing bookkeeping fed by hanzi-writer callbacks. Lives
   * outside React state: stroke events must never re-render mid-trace.
   */
  const writePrompt = useRef({ mistakes: 0, assisted: false, outline: true })

  // Mirrored into state only for the canvas prop; frozen per prompt so a
  // mastery change on completion can't yank the guide off the finished glyph.
  const [writeOutline, setWriteOutline] = useState(true)

  const advance = useCallback(() => {
    // The pomodoro boundary: instead of serving another character, close the
    // session — the summary is the break.
    if (sessionTimeUp()) {
      finishSession()
      return
    }

    const state = sessionStore.state
    const config = settingsStore.state
    const { ids, boost } = currentPool(pacingStreak(state.lessonStreak))

    // Which exercise this prompt is. With both types on, they are served in
    // blocks — several same-type prompts in a row (see lib/blocks.ts) — so the
    // hand is not yanked between keyboard and pointer on every prompt. An
    // in-flight confusion burst always finishes first, without consuming the
    // block: interleaving tracing into a discrimination sequence would defeat
    // its point.
    const writablepool = writableIds(ids)
    const burstActive = !!state.burst && state.burst.queue.length > 0
    let exercise: ExerciseType
    let block = state.block
    if (!config.practiceWriting || writablepool.length === 0) {
      exercise = "read"
      block = null
    } else if (!config.practiceReading) {
      exercise = "write"
      block = null
    } else if (burstActive) {
      exercise = "read"
    } else {
      block = nextBlock(block, Math.random() < 0.5 ? "read" : "write")
      exercise = block.exercise
    }

    if (exercise === "write") {
      const { pick } = nextKana(
        { lastShownId: state.lastShownId, burst: null, sinceBurst: 0 },
        writablepool,
        writingAsProgress(writingStore.state),
        config,
        Math.random
      )

      // First time this kana is ever written — the drill demos the strokes.
      const introducing =
        !!pick && (writingStore.state.charStats[pick.id]?.attempts ?? 0) === 0
      const stat = pick ? writingStore.state.charStats[pick.id] : undefined
      const outline = config.writeAlwaysOutline || needsOutline(stat)

      writePrompt.current = { mistakes: 0, assisted: false, outline }
      setWriteOutline(outline)
      // Only lastShownId and the block move: a paused read burst must survive
      // the detour.
      sessionStore.setState((prev) => ({
        ...prev,
        lastShownId: pick?.id ?? prev.lastShownId,
        block,
      }))
      showPick(pick, introducing, "write")
      return
    }

    const { pick, state: schedulerState } = nextKana(
      {
        lastShownId: state.lastShownId,
        burst: state.burst,
        sinceBurst: state.sinceBurst,
      },
      ids,
      progressStore.state,
      config,
      Math.random,
      boost
    )

    // A kana nobody has ever answered is taught, not tested: the drill shows
    // the reading the first time it comes up.
    const introducing =
      !!pick && (progressStore.state.charStats[pick.id]?.attempts ?? 0) === 0

    sessionStore.setState((prev) => ({ ...prev, ...schedulerState, block }))
    showPick(pick, introducing, "read")
  }, [])

  // Serve the first character once a session is on screen with a non-empty pool.
  useEffect(() => {
    if (session.ended || session.current || pool.length === 0) return
    advance()
  }, [advance, pool.length, session.current, session.ended])

  const submit = useCallback(() => {
    const state = sessionStore.state
    if (!state.current || state.exercise !== "read") return

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
    const phaseBefore = lesson ? lessonPhase(lesson, gateStats()) : null

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
      lessonPhase(lesson, gateStats()) === "mix"

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
            gateStats(),
            pacingStreak(lessonStreak),
            Date.now(),
            charReadyForUnlock
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
   * you do not know yet. Reading only: the writing drill has no clock.
   */
  const timeout = useCallback(() => {
    const state = sessionStore.state
    if (!state.current || state.phase !== "prompt") return
    if (state.exercise !== "read") return

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
  // 50ms redraw never touches the rest of the drill. Never runs on a writing
  // prompt.
  const limitMs =
    session.exercise === "read" ? timeLimitFor(settings, session.streak) : null

  useEffect(() => {
    if (limitMs === null || session.phase !== "prompt" || !session.current) {
      return
    }
    const id = setTimeout(timeout, limitMs)
    return () => clearTimeout(id)
  }, [limitMs, session.phase, session.current, session.shownAt, timeout])

  // ---------------------------------------------------------------- writing

  /** The demo ran on this prompt — the attempt no longer counts for mastery. */
  const markAssisted = useCallback(() => {
    writePrompt.current.assisted = true
  }, [])

  /** Rising pitch per stroke: the little ladder is what makes it addictive. */
  const strokeCorrect = useCallback((strokeNum: number) => {
    playEffect("strokeCorrect", { rate: 1 + Math.min(strokeNum, 8) * 0.08 })
  }, [])

  /** Whether this session already counted toward writing sessions. */
  const sessionHadWriting = useRef(false)
  useEffect(() => {
    sessionHadWriting.current = false
  }, [session.id])

  const recordWritePrompt = useCallback((skipped: boolean): boolean => {
    const state = sessionStore.state
    const shown = requireKana(state.current!.id)

    if (state.attempts === 0) {
      countSession()
      touchDay()
    }
    if (!sessionHadWriting.current) {
      countWriteSession()
      sessionHadWriting.current = true
    }

    return recordWriteAnswer({
      kanaId: shown.id,
      mistakes: writePrompt.current.mistakes,
      assisted: writePrompt.current.assisted,
      outline: writePrompt.current.outline,
      skipped,
      ms: Date.now() - state.shownAt,
    })
  }, [])

  /**
   * A wrong stroke. Returns what the canvas should do next: keep quizzing so
   * the same stroke can be retried, or — after the third failure — reveal the
   * answer while the miss is recorded.
   */
  const strokeMistake = useCallback((): "retry" | "failed" => {
    const state = sessionStore.state
    if (!state.current || state.exercise !== "write") return "retry"

    writePrompt.current.mistakes += 1
    playEffect("strokeWrong")

    if (writePrompt.current.mistakes < WRITE_MAX_TRIES) return "retry"

    // Third strike: scored as a miss (streak resets — see scoreWriteAttempt),
    // the answer is revealed, and the drill moves on.
    recordWritePrompt(false)
    sessionStore.setState((prev) => ({
      ...prev,
      attempts: prev.attempts + 1,
      streak: 0,
      phase: "retry",
      missedCurrent: true,
    }))
    setTimeout(advance, WRITE_ADVANCE_FAILED)
    return "failed"
  }, [advance, recordWritePrompt])

  /** The character was completed (never reached three wrong strokes). */
  const completeWrite = useCallback(() => {
    const state = sessionStore.state
    if (!state.current || state.exercise !== "write") return
    if (state.phase !== "prompt") return

    const shown = requireKana(state.current.id)
    const lesson = currentLesson()
    const phaseBefore = lesson ? lessonPhase(lesson, gateStats()) : null

    const correct = recordWritePrompt(false)

    // Writing moves the same journey as reading: this completion may have
    // been the one that made the section familiar or cleared the unlock gate
    // (both judged on the merged best-of-both stats). Same streak hygiene as
    // the reading path — see submit() for why each reset exists.
    const enteredMix =
      lesson !== null &&
      phaseBefore === "focus" &&
      lessonPhase(lesson, gateStats()) === "mix"
    const lessonStreak = enteredMix
      ? 0
      : nextLessonStreak(state, shown.id, correct)
    const unlocked =
      correct && progressionStore.state.mode === "journey"
        ? advanceLesson(
            progressionStore.state.track,
            gateStats(),
            pacingStreak(lessonStreak),
            Date.now(),
            charReadyForUnlock
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
        lessonStreak: unlocked === null ? lessonStreak : 0,
        unlocked:
          unlocked === null ? prev.unlocked : [...prev.unlocked, unlocked],
        phase: correct ? "correct" : "retry",
        missedCurrent: !correct,
      }
    })

    // The wrong-stroke tones already played during the trace, so a missed
    // completion stays silent here.
    if (unlocked !== null) playEffect("unlock")
    else if (correct && milestoneAt(state.streak + 1) !== null) {
      playEffect("streakMilestone")
    } else if (correct) {
      playEffect("correct")
    }

    setTimeout(advance, correct ? WRITE_ADVANCE_CLEAN : WRITE_ADVANCE_MISSED)
  }, [advance, recordWritePrompt])

  /** Stroke data failed to load — move on without scoring anything. */
  const skipUnloadable = useCallback(() => {
    advance()
  }, [advance])

  // ------------------------------------------------------------------ shared

  /** Gives up on the current character and moves on, scoring it as a miss. */
  const skip = useCallback(() => {
    const state = sessionStore.state
    if (!state.current) return

    if (state.phase === "prompt") {
      if (state.exercise === "write") {
        recordWritePrompt(true)
        sessionStore.setState((prev) => ({
          ...prev,
          attempts: prev.attempts + 1,
          streak: 0,
        }))
      } else {
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
    }
    advance()
  }, [advance, recordWritePrompt])

  const finish = useCallback(() => {
    finishSession()
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
    return lessonPhase(lesson, mergeBestMastery(charStats, writeCharStats))
  }, [progression, charStats, writeCharStats])

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
    writeOutline,
    setInput,
    submit,
    skip,
    finish,
    restart,
    markAssisted,
    strokeCorrect,
    strokeMistake,
    completeWrite,
    skipUnloadable,
  }
}
