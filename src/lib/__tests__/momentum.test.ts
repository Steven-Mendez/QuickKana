import { describe, expect, it } from "vitest"
import {
  LESSON_BOOST,
  LESSON_BOOST_MAX,
  MASTERY_ATTEMPTS_FLOOR,
  MOMENTUM_CEILING,
  MOMENTUM_FLOOR,
  isPushingPace,
  lessonBoost,
  momentum,
  requiredAttempts,
} from "@/lib/momentum"
import { LESSON_MASTERY, isMastered } from "@/lib/journey"
import { MASTERY_ATTEMPTS, mastery } from "@/lib/stats"
import { emptyCharStat } from "@/lib/scheduler"

/** A character answered `attempts` times, every one of them correct. */
const perfect = (attempts: number) => ({
  ...emptyCharStat(),
  attempts,
  correct: attempts,
})

describe("momentum", () => {
  it("stays at zero until the streak is worth reading as evidence", () => {
    expect(momentum(0)).toBe(0)
    expect(momentum(MOMENTUM_FLOOR)).toBe(0)
  })

  it("ramps between the floor and the ceiling and then holds", () => {
    const half = (MOMENTUM_FLOOR + MOMENTUM_CEILING) / 2
    expect(momentum(half)).toBeCloseTo(0.5)
    expect(momentum(MOMENTUM_CEILING)).toBe(1)
    expect(momentum(MOMENTUM_CEILING * 10)).toBe(1)
  })
})

describe("lessonBoost", () => {
  it("uses the cold boost with no streak behind it", () => {
    expect(lessonBoost(0)).toBe(LESSON_BOOST)
  })

  it("hands the draw to the new characters at full momentum", () => {
    expect(lessonBoost(MOMENTUM_CEILING)).toBe(LESSON_BOOST_MAX)
  })

  it("never goes backwards as the streak grows", () => {
    for (let streak = 1; streak <= 40; streak++) {
      expect(lessonBoost(streak)).toBeGreaterThanOrEqual(
        lessonBoost(streak - 1)
      )
    }
  })
})

describe("requiredAttempts", () => {
  it("asks for the full exposure quota from a cold start", () => {
    expect(requiredAttempts(0)).toBe(MASTERY_ATTEMPTS)
  })

  it("eases down to the floor, and no further", () => {
    expect(requiredAttempts(MOMENTUM_CEILING)).toBe(MASTERY_ATTEMPTS_FLOOR)
    expect(requiredAttempts(MOMENTUM_CEILING * 4)).toBe(MASTERY_ATTEMPTS_FLOOR)
  })

  it("turns five clean sightings into three at full momentum", () => {
    const cold = (attempts: number) =>
      isMastered(perfect(attempts), requiredAttempts(0))
    const hot = (attempts: number) =>
      isMastered(perfect(attempts), requiredAttempts(MOMENTUM_CEILING))

    expect(cold(4)).toBe(false)
    expect(cold(5)).toBe(true)

    expect(hot(2)).toBe(false)
    expect(hot(3)).toBe(true)
  })

  it("never discounts accuracy, however long the run behind it", () => {
    // Missed four times in ten. Shortening the exposure quota cannot make a
    // 60% character learned — momentum buys repetitions, not a lower standard.
    const shaky = { ...emptyCharStat(), attempts: 10, correct: 6 }
    expect(isMastered(shaky, requiredAttempts(MOMENTUM_CEILING * 4))).toBe(
      false
    )
    expect(mastery(shaky, requiredAttempts(MOMENTUM_CEILING))).toBeLessThan(
      LESSON_MASTERY
    )
  })
})

describe("isPushingPace", () => {
  it("stays quiet until the pace change is big enough to mention", () => {
    expect(isPushingPace(MOMENTUM_FLOOR)).toBe(false)
    expect(isPushingPace(MOMENTUM_CEILING)).toBe(true)
  })
})
