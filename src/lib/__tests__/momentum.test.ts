import { describe, expect, it } from "vitest"
import {
  LESSON_BOOST,
  LESSON_BOOST_MAX,
  MASTERY_ATTEMPTS_FLOOR,
  PASSES_FLOOR,
  PASSES_FULL,
  isPushingPace,
  lessonBoost,
  momentum,
  requiredAttempts,
} from "@/lib/momentum"
import { LESSON_MASTERY, isMastered } from "@/lib/journey"
import { MASTERY_ATTEMPTS, mastery } from "@/lib/stats"
import { emptyCharStat } from "@/lib/scheduler"

/** A five-character section, the most common size in both tracks. */
const SIZE = 5

/** A character answered `attempts` times, every one of them correct. */
const perfect = (attempts: number) => ({
  ...emptyCharStat(),
  attempts,
  correct: attempts,
})

describe("momentum", () => {
  it("stays at zero for the first clean pass through the section", () => {
    expect(momentum(0, SIZE)).toBe(0)
    expect(momentum(SIZE * PASSES_FLOOR, SIZE)).toBe(0)
  })

  it("reaches full strength after the last clean pass, and holds", () => {
    expect(momentum(SIZE * PASSES_FULL, SIZE)).toBe(1)
    expect(momentum(SIZE * PASSES_FULL * 10, SIZE)).toBe(1)
  })

  it("reads the same in passes whatever the section size", () => {
    // A run of ten means something very different across three characters
    // than across five, so the scale follows the section.
    for (const size of [3, 4, 5, 6]) {
      expect(momentum(size * PASSES_FLOOR, size)).toBe(0)
      expect(momentum(size * PASSES_FULL, size)).toBe(1)
      expect(momentum(size * 2, size)).toBeCloseTo(0.5)
    }
  })

  it("does not let a big section be paced by a small one's run", () => {
    // Fifteen in a row is three passes through five characters but only two
    // and a half through six — the bigger section is not done proving itself.
    expect(momentum(15, 5)).toBe(1)
    expect(momentum(15, 6)).toBeLessThan(1)
  })
})

describe("lessonBoost", () => {
  it("uses the cold boost with no streak behind it", () => {
    expect(lessonBoost(0, SIZE)).toBe(LESSON_BOOST)
  })

  it("hands the draw to the new characters at full momentum", () => {
    expect(lessonBoost(SIZE * PASSES_FULL, SIZE)).toBe(LESSON_BOOST_MAX)
  })

  it("never goes backwards as the streak grows", () => {
    for (let streak = 1; streak <= 40; streak++) {
      expect(lessonBoost(streak, SIZE)).toBeGreaterThanOrEqual(
        lessonBoost(streak - 1, SIZE)
      )
    }
  })
})

describe("requiredAttempts", () => {
  it("asks for the full exposure quota from a cold start", () => {
    expect(requiredAttempts(0, SIZE)).toBe(MASTERY_ATTEMPTS)
  })

  it("eases down to the floor, and no further", () => {
    expect(requiredAttempts(SIZE * PASSES_FULL, SIZE)).toBe(
      MASTERY_ATTEMPTS_FLOOR
    )
    expect(requiredAttempts(SIZE * PASSES_FULL * 4, SIZE)).toBe(
      MASTERY_ATTEMPTS_FLOOR
    )
  })

  it("turns five clean sightings into three at full momentum", () => {
    const cold = (attempts: number) =>
      isMastered(perfect(attempts), requiredAttempts(0, SIZE))
    const hot = (attempts: number) =>
      isMastered(perfect(attempts), requiredAttempts(SIZE * PASSES_FULL, SIZE))

    expect(cold(4)).toBe(false)
    expect(cold(5)).toBe(true)

    expect(hot(2)).toBe(false)
    expect(hot(3)).toBe(true)
  })

  it("costs as many answers as the shortcut it grants", () => {
    // Full momentum needs PASSES_FULL faultless laps of the section, which is
    // exactly the per-character quota it then drops to: the accelerator can
    // never open a lesson on less work than it asks for up front.
    expect(PASSES_FULL).toBe(MASTERY_ATTEMPTS_FLOOR)
  })

  it("never discounts accuracy, however long the run behind it", () => {
    // Missed four times in ten. Shortening the exposure quota cannot make a
    // 60% character learned — momentum buys repetitions, not a lower standard.
    const shaky = { ...emptyCharStat(), attempts: 10, correct: 6 }
    expect(
      isMastered(shaky, requiredAttempts(SIZE * PASSES_FULL * 4, SIZE))
    ).toBe(false)
    expect(
      mastery(shaky, requiredAttempts(SIZE * PASSES_FULL, SIZE))
    ).toBeLessThan(LESSON_MASTERY)
  })
})

describe("isPushingPace", () => {
  it("stays quiet until the pace change is big enough to mention", () => {
    expect(isPushingPace(SIZE * PASSES_FLOOR, SIZE)).toBe(false)
    expect(isPushingPace(SIZE * PASSES_FULL, SIZE)).toBe(true)
  })
})
