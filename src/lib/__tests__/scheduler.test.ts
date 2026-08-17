import { describe, expect, it } from "vitest"
import { buildBurst, nextKana, nextWeight } from "@/lib/scheduler"
import type { SchedulerState } from "@/lib/scheduler"
import { groupIdOf, recordConfusion } from "@/lib/confusion"
import { emptyProgress } from "@/stores/progress.store"
import { DEFAULT_SETTINGS } from "@/stores/settings.store"
import type { ProgressState, Settings } from "@/lib/types"

const TSU = "hiragana:つ"
const SHI = "hiragana:し"
const KA = "hiragana:か"
const SA = "hiragana:さ"
const TA = "hiragana:た"

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  activationThreshold: 2,
  burstCooldown: 4,
}

/** Deterministic stand-in for Math.random (mulberry32) so bursts reproduce. */
const seeded = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const withConfusion = (pairs: Array<[string, string]>): ProgressState =>
  pairs.reduce<ProgressState>(
    (acc, [shown, answered]) => ({
      ...acc,
      ...recordConfusion(acc, shown, answered, settings, 1000),
    }),
    emptyProgress()
  )

const freshState = (): SchedulerState => ({
  lastShownId: null,
  burst: null,
  sinceBurst: 0,
})

describe("nextWeight", () => {
  it("spikes on a miss and tapers on a hit, within bounds", () => {
    expect(nextWeight(1, false)).toBeGreaterThan(1)
    expect(nextWeight(1, true)).toBeLessThan(1)
    expect(nextWeight(8, false)).toBeLessThanOrEqual(8)
    expect(nextWeight(0.5, true)).toBeGreaterThanOrEqual(0.5)
  })
})

describe("buildBurst", () => {
  const progress = withConfusion([
    [TSU, SHI],
    [TSU, SHI],
  ])
  const group = progress.groups[groupIdOf([TSU, SHI])]!

  it("alternates a pair without ever repeating a kana back to back", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const burst = buildBurst(
        group,
        new Set([TSU, SHI]),
        progress.matrix,
        seeded(seed)
      )
      expect(burst).toHaveLength(4)
      expect(new Set(burst)).toEqual(new Set([TSU, SHI]))
      for (let i = 1; i < burst.length; i++) {
        expect(burst[i]).not.toBe(burst[i - 1])
      }
    }
  })

  it("puts every member next to the anchor in a star group", () => {
    const star = withConfusion([
      [TSU, SHI],
      [TSU, SHI],
      [TSU, SA],
      [TSU, SA],
      [TSU, TA],
      [TSU, TA],
    ])
    const starGroup = Object.values(star.groups)[0]!
    const pool = new Set([TSU, SHI, SA, TA])

    for (let seed = 1; seed <= 30; seed++) {
      const burst = buildBurst(starGroup, pool, star.matrix, seeded(seed))
      expect(burst).toHaveLength(6)

      // TSU is the anchor: it carries every cross-miss in the group.
      for (const member of [SHI, SA, TA]) {
        const adjacentToAnchor = burst.some(
          (id, i) =>
            id === member && (burst[i - 1] === TSU || burst[i + 1] === TSU)
        )
        expect(adjacentToAnchor).toBe(true)
      }
    }
  })

  it("skips members the user has deselected", () => {
    const burst = buildBurst(group, new Set([TSU]), progress.matrix, seeded(7))
    expect(burst).toEqual([])
  })

  it("does not always produce the same order", () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, i) =>
        buildBurst(
          group,
          new Set([TSU, SHI]),
          progress.matrix,
          seeded(i + 1)
        ).join(",")
      )
    )
    expect(orders.size).toBeGreaterThan(1)
  })
})

describe("nextKana", () => {
  const pool = [TSU, SHI, KA, SA, TA]

  it("returns null when nothing is selected", () => {
    const { pick } = nextKana(
      freshState(),
      [],
      emptyProgress(),
      settings,
      seeded(1)
    )
    expect(pick).toBeNull()
  })

  it("never shows the same kana twice in a row", () => {
    let state = freshState()
    const progress = emptyProgress()
    let previous: string | null = null

    for (let i = 0; i < 200; i++) {
      const result = nextKana(state, pool, progress, settings, seeded(i + 1))
      state = result.state
      expect(result.pick!.id).not.toBe(previous)
      previous = result.pick!.id
    }
  })

  it("ignores confusion groups entirely when Focus Mode is off", () => {
    const progress = withConfusion([
      [TSU, SHI],
      [TSU, SHI],
    ])
    let state = freshState()

    for (let i = 0; i < 100; i++) {
      const result = nextKana(
        state,
        pool,
        progress,
        { ...settings, focusMode: false },
        seeded(i + 1)
      )
      state = result.state
      expect(result.pick!.source.type).toBe("pool")
      expect(state.burst).toBeNull()
    }
  })

  it("serves general-pool items before the first burst starts", () => {
    const progress = withConfusion([
      [TSU, SHI],
      [TSU, SHI],
    ])
    let state = freshState()
    const sources: Array<string> = []

    for (let i = 0; i < settings.burstCooldown; i++) {
      const result = nextKana(state, pool, progress, settings, seeded(i + 1))
      state = result.state
      sources.push(result.pick!.source.type)
    }

    expect(sources.every((s) => s === "pool")).toBe(true)
  })

  it("drills a confusion group once the cooldown elapses", () => {
    const progress = withConfusion([
      [TSU, SHI],
      [TSU, SHI],
    ])
    let state = freshState()
    const picks: Array<{ id: string; source: string }> = []

    for (let i = 0; i < 20; i++) {
      const result = nextKana(state, pool, progress, settings, seeded(i + 1))
      state = result.state
      picks.push({ id: result.pick!.id, source: result.pick!.source.type })
    }

    const grouped = picks.filter((p) => p.source === "group")
    expect(grouped.length).toBeGreaterThan(0)
    // A burst only ever serves members of its group.
    expect(grouped.every((p) => p.id === TSU || p.id === SHI)).toBe(true)

    // And the drilled characters land next to each other, which is the point.
    const adjacent = picks.some(
      (p, i) =>
        i > 0 &&
        p.source === "group" &&
        picks[i - 1]?.source === "group" &&
        p.id !== picks[i - 1]?.id
    )
    expect(adjacent).toBe(true)
  })

  it("never drills a group whose members are not selected", () => {
    const progress = withConfusion([
      [TSU, SHI],
      [TSU, SHI],
    ])
    let state = freshState()

    for (let i = 0; i < 50; i++) {
      const result = nextKana(
        state,
        [KA, SA, TA],
        progress,
        settings,
        seeded(i + 1)
      )
      state = result.state
      expect(result.pick!.source.type).toBe("pool")
      expect([KA, SA, TA]).toContain(result.pick!.id)
    }
  })

  it("favours heavier characters in the general pool", () => {
    const stat = (weight: number) => ({
      attempts: 5,
      correct: 0,
      streak: 0,
      bestStreak: 0,
      totalMs: 0,
      lastSeenAt: 0,
      weight,
    })

    const progress: ProgressState = {
      ...emptyProgress(),
      charStats: { [KA]: stat(8), [SA]: stat(0.5), [TA]: stat(0.5) },
    }

    // A two-item pool would prove nothing: excluding the previous kana leaves a
    // single candidate, so weights could never shift the distribution.
    const counts: Record<string, number> = { [KA]: 0, [SA]: 0, [TA]: 0 }
    let state = freshState()
    const rng = seeded(42)

    for (let i = 0; i < 600; i++) {
      const result = nextKana(state, [KA, SA, TA], progress, settings, rng)
      state = result.state
      counts[result.pick!.id] = (counts[result.pick!.id] ?? 0) + 1
    }

    // Never repeating the previous kana caps any single character at ~50% of a
    // three-item pool, so the heavy kana should sit near that ceiling while a
    // uniform draw would have given it 33%.
    expect(counts[KA]! / 600).toBeGreaterThan(0.44)
    expect(counts[KA]!).toBeGreaterThan(counts[SA]!)
    expect(counts[KA]!).toBeGreaterThan(counts[TA]!)
  })
})

describe("boost", () => {
  it("favours the boosted characters without dropping the rest", () => {
    const progress = emptyProgress()
    const counts: Record<string, number> = { [KA]: 0, [SA]: 0, [TA]: 0 }
    let state = freshState()
    const rng = seeded(11)

    // What guided mode does: the lesson being introduced dominates while
    // everything unlocked earlier keeps coming back for review.
    const boost = { ids: new Set([KA]), factor: 3 }

    for (let i = 0; i < 600; i++) {
      const result = nextKana(
        state,
        [KA, SA, TA],
        progress,
        settings,
        rng,
        boost
      )
      state = result.state
      counts[result.pick!.id] = (counts[result.pick!.id] ?? 0) + 1
    }

    expect(counts[KA]!).toBeGreaterThan(counts[SA]!)
    expect(counts[KA]!).toBeGreaterThan(counts[TA]!)
    expect(counts[SA]!).toBeGreaterThan(0)
    expect(counts[TA]!).toBeGreaterThan(0)
  })
})
