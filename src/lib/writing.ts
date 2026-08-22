import { nextWeight } from "@/lib/scheduler"
import type { WriteCharStat } from "@/lib/types"

export const emptyWriteCharStat = (): WriteCharStat => ({
  attempts: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  totalMs: 0,
  lastSeenAt: 0,
  weight: 1.5,
  strokeMistakes: 0,
  memoryCorrect: 0,
})

/** Clean guided completions before the outline goes away for a character. */
export const GUIDED_COMPLETIONS = 2

/**
 * Whether a character is still traced over the guide. Deliberately quick to
 * graduate — a couple of clean traces — because the lesson gate only accepts
 * writes from memory, and the guide has to get out of the way for those to
 * happen at all.
 */
export const needsOutline = (stat: WriteCharStat | undefined): boolean =>
  (stat?.correct ?? 0) < GUIDED_COMPLETIONS

export interface WriteAttempt {
  /** Wrong strokes drawn before the character was completed. */
  mistakes: number
  /** The stroke-order demo ran on this prompt (Show me, or the intro demo). */
  assisted: boolean
  /** The outline guide was visible — tracing, rather than writing from memory. */
  outline: boolean
  /** The character was skipped without completing it. */
  skipped: boolean
}

export interface WriteOutcome {
  /** Counts toward accuracy. */
  correct: boolean
  /** How the mastery streak moves. */
  streak: "advance" | "hold" | "reset"
}

/**
 * What one Write attempt is worth.
 *
 * - Skipping is a plain miss.
 * - An assisted attempt (the demo ran) never moves the streak in either
 *   direction: copying strokes just shown is no evidence of recall, but it is
 *   the intended way to meet a character, so it must not punish either. It
 *   still counts toward accuracy so a session's numbers include it.
 * - With the outline visible, a clean run advances the streak. Exactly one
 *   wrong stroke holds the streak instead of resetting it — a tracing slip on
 *   a guided attempt says "not solid yet", not "forgotten". Two or more reset.
 * - From memory the bar is strict: clean advances, any mistake resets.
 */
export function scoreWriteAttempt(attempt: WriteAttempt): WriteOutcome {
  if (attempt.skipped) return { correct: false, streak: "reset" }

  const clean = attempt.mistakes === 0
  if (attempt.assisted) return { correct: clean, streak: "hold" }
  if (clean) return { correct: true, streak: "advance" }
  if (attempt.outline && attempt.mistakes === 1) {
    return { correct: false, streak: "hold" }
  }
  return { correct: false, streak: "reset" }
}

/** Folds one attempt into a character's stats. */
export function applyWriteAttempt(
  stat: WriteCharStat,
  attempt: WriteAttempt,
  ms: number,
  now: number
): WriteCharStat {
  const outcome = scoreWriteAttempt(attempt)
  const streak =
    outcome.streak === "advance"
      ? stat.streak + 1
      : outcome.streak === "hold"
        ? stat.streak
        : 0

  // Only an unaided, clean, from-memory completion counts as "can write it".
  const fromMemory =
    outcome.correct && !attempt.assisted && !attempt.outline && !attempt.skipped

  return {
    // The store backfills the field on load, so it is always a number here.
    memoryCorrect: stat.memoryCorrect + (fromMemory ? 1 : 0),
    attempts: stat.attempts + 1,
    correct: stat.correct + (outcome.correct ? 1 : 0),
    streak,
    bestStreak: Math.max(stat.bestStreak, streak),
    totalMs: stat.totalMs + ms,
    lastSeenAt: now,
    // Any wrong stroke raises the character's frequency in the drill; clean
    // completions taper it — the same curve the reading drill uses.
    weight: nextWeight(stat.weight, outcome.correct),
    strokeMistakes: stat.strokeMistakes + (attempt.skipped ? 0 : attempt.mistakes),
  }
}
