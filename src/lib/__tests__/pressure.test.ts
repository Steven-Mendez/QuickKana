import { describe, expect, it } from "vitest"
import {
  MIN_TIME_LIMIT,
  milestoneAt,
  streakTier,
  timeLimitFor,
} from "@/lib/pressure"
import { DEFAULT_SETTINGS } from "@/stores/settings.store"
import type { Settings } from "@/lib/types"

const withClock = (patch: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  timeLimitEnabled: true,
  timeLimitMs: 5000,
  speedRamp: true,
  ...patch,
})

describe("timeLimitFor", () => {
  it("is off unless the time limit is enabled", () => {
    expect(timeLimitFor(withClock({ timeLimitEnabled: false }), 10)).toBeNull()
  })

  it("keeps a fixed limit when the ramp is off", () => {
    const settings = withClock({ speedRamp: false })
    expect(timeLimitFor(settings, 0)).toBe(5000)
    expect(timeLimitFor(settings, 40)).toBe(5000)
  })

  it("tightens the clock as the streak grows", () => {
    const settings = withClock()
    const start = timeLimitFor(settings, 0)!
    const later = timeLimitFor(settings, 10)!

    expect(start).toBe(5000)
    expect(later).toBeLessThan(start)
  })

  it("never drops below the floor, however long the run", () => {
    expect(timeLimitFor(withClock(), 500)).toBe(MIN_TIME_LIMIT)
  })

  it("hands the full time back once the streak resets", () => {
    const settings = withClock()
    expect(timeLimitFor(settings, 0)).toBe(settings.timeLimitMs)
  })

  it("treats a negative streak as no streak", () => {
    expect(timeLimitFor(withClock(), -3)).toBe(5000)
  })
})

describe("streak milestones", () => {
  it("only fires on the milestone itself", () => {
    expect(milestoneAt(5)).toBe(5)
    expect(milestoneAt(6)).toBeNull()
  })

  it("escalates the tier as milestones pile up", () => {
    expect(streakTier(0)).toBe(0)
    expect(streakTier(4)).toBe(0)
    expect(streakTier(5)).toBe(1)
    expect(streakTier(10)).toBe(2)
    expect(streakTier(100)).toBeGreaterThan(streakTier(50))
  })
})
