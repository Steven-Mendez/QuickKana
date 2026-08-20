import { MASTERY_ATTEMPTS } from "@/lib/stats"

/**
 * The streak read as evidence, not just as a score.
 *
 * A long run of correct answers means one of two things: the characters are
 * fresh, or the user already knew them. Either way the drill has stopped
 * teaching and is only confirming, and the right answer to that is to move on
 * — show more of what is new, and stop holding the next lesson back.
 *
 * The streak that counts here is the one *inside the lesson being introduced*,
 * never the session's overall run. Once a track is a dozen lessons deep most
 * answers are review of characters the user learned days ago, and a streak fed
 * by those says nothing about あいうえお — it would pin the pace at maximum
 * from the first prompt and unlock sections the user never actually read.
 *
 * The regulator is the streak itself. One miss inside the section drops it to
 * zero and the pace returns to the textbook default, so the drill only
 * accelerates for exactly as long as the user is keeping up with it.
 */

/** Clean passes through the section before the pace picks up at all. */
export const PASSES_FLOOR = 1

/** ...and before the push is at full strength. */
export const PASSES_FULL = 3

/**
 * 0–1: how strongly the section is saying "I know these already, move on".
 *
 * Scaled by how many characters the section holds, because a run of ten means
 * something very different across three characters than across five. In passes
 * rather than answers it reads the same at every size: one clean lap to start
 * picking up, three to be at full speed.
 */
export function momentum(streak: number, lessonSize: number): number {
  const size = Math.max(1, lessonSize)
  const floor = size * PASSES_FLOOR
  const span = size * (PASSES_FULL - PASSES_FLOOR)
  return Math.max(0, Math.min(1, (streak - floor) / span))
}

/** How much more often the lesson being introduced shows up, from a cold start. */
export const LESSON_BOOST = 3

/**
 * ...and at full momentum, where the new characters all but take the draw over.
 *
 * Review never stops entirely: mastered kana keep their floor weight, so a
 * boosted lesson takes roughly three quarters of the picks rather than all of
 * them. Nothing unlocked earlier gets a chance to rot.
 */
export const LESSON_BOOST_MAX = 12

export const lessonBoost = (streak: number, lessonSize: number): number =>
  LESSON_BOOST +
  (LESSON_BOOST_MAX - LESSON_BOOST) * momentum(streak, lessonSize)

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
 * With a clean record that is five sightings cold and three at full momentum,
 * which lines up with what the streak had to be worth to get there: three
 * faultless passes through the section is three sightings of each character.
 */
export const requiredAttempts = (streak: number, lessonSize: number): number =>
  MASTERY_ATTEMPTS -
  (MASTERY_ATTEMPTS - MASTERY_ATTEMPTS_FLOOR) * momentum(streak, lessonSize)

/**
 * Momentum high enough to be worth telling the user about. Below this the pace
 * change is real but too small to be worth a line on screen.
 */
const VISIBLE_AT = 0.34

export const isPushingPace = (streak: number, lessonSize: number): boolean =>
  momentum(streak, lessonSize) >= VISIBLE_AT
