import type { Settings } from "@/lib/types"

/** However fast the ramp gets, a character always has at least this long. */
export const MIN_TIME_LIMIT = 1200

/** Each correct answer in a row shaves this much off the clock. */
const RAMP_FACTOR = 0.96

/** Streak milestones worth calling out mid-drill. */
export const STREAK_MILESTONES = [5, 10, 20, 30, 50, 75, 100]

/**
 * How long the current character gets, or `null` when the clock is off.
 *
 * With the ramp enabled the limit tightens as the streak grows, so a good run
 * gets harder instead of turning into autopilot — and one miss hands the full
 * time back.
 */
export function timeLimitFor(
  settings: Settings,
  streak: number
): number | null {
  if (!settings.timeLimitEnabled) return null
  if (!settings.speedRamp) return settings.timeLimitMs

  return Math.max(
    MIN_TIME_LIMIT,
    Math.round(settings.timeLimitMs * RAMP_FACTOR ** Math.max(0, streak))
  )
}

/** The milestone a streak just hit, or `null` if it is not on one. */
export function milestoneAt(streak: number): number | null {
  return STREAK_MILESTONES.includes(streak) ? streak : null
}

/** Highest milestone reached so far — drives how loud the counter gets. */
export function streakTier(streak: number): number {
  let tier = 0
  for (const milestone of STREAK_MILESTONES) {
    if (streak >= milestone) tier += 1
  }
  return tier
}
