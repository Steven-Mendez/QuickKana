import { MASTERY_ATTEMPTS } from "@/lib/stats"

/**
 * The streak read as evidence, not just as a score.
 *
 * A long run of correct answers means one of two things: the characters are
 * fresh, or the user already knew them. Either way the drill has stopped
 * teaching and is only confirming, and the right answer to that is to move on
 * — show more of what is new, and stop holding the next lesson back.
 *
 * The regulator is the streak itself. One miss drops it to zero and the pace
 * returns to the textbook default, so the drill only accelerates for exactly
 * as long as the user is keeping up with it.
 */

/** Correct answers in a row before the pace starts to pick up at all. */
export const MOMENTUM_FLOOR = 5

/** Streak at which the push is at full strength. */
export const MOMENTUM_CEILING = 25

/** 0–1: how strongly the session is saying "I know this already, move on". */
export function momentum(streak: number): number {
  const span = MOMENTUM_CEILING - MOMENTUM_FLOOR
  return Math.max(0, Math.min(1, (streak - MOMENTUM_FLOOR) / span))
}

/** How much more often the lesson being introduced shows up, from a cold start. */
export const LESSON_BOOST = 3

/**
 * ...and at full momentum, where the new characters all but take the draw over.
 *
 * Review never stops entirely: mastered kana keep their floor weight, so a
 * boosted lesson takes roughly four fifths of the picks rather than all of
 * them. Nothing unlocked earlier gets a chance to rot.
 */
export const LESSON_BOOST_MAX = 12

export const lessonBoost = (streak: number): number =>
  LESSON_BOOST + (LESSON_BOOST_MAX - LESSON_BOOST) * momentum(streak)

/**
 * The fewest sightings the confidence ramp will ever settle for. Three is
 * enough to tell recognition from a lucky guess, and momentum never buys less
 * than that.
 */
export const MASTERY_ATTEMPTS_FLOOR = 3

/**
 * How much exposure a character needs before its accuracy counts toward the
 * unlock. Momentum shortens this and *only* this: the accuracy bar itself
 * (`LESSON_MASTERY`) never moves, so a character missed a third of the time
 * stays unlearned however long the run behind it.
 *
 * With a clean record that is five sightings cold and three at full momentum —
 * the difference between a lesson that drags on and one that gets out of the
 * way of the characters the user has not met yet.
 */
export const requiredAttempts = (streak: number): number =>
  MASTERY_ATTEMPTS -
  (MASTERY_ATTEMPTS - MASTERY_ATTEMPTS_FLOOR) * momentum(streak)

/**
 * Momentum high enough to be worth telling the user about. Below this the pace
 * change is real but too small to be worth a line on screen.
 */
const VISIBLE_AT = 0.34

export const isPushingPace = (streak: number): boolean =>
  momentum(streak) >= VISIBLE_AT
