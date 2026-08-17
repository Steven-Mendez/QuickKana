import { describe, expect, it } from "vitest"
import {
  applyAnswerToGroups,
  groupIdOf,
  pairMisses,
  recordConfusion,
} from "@/lib/confusion"
import { emptyProgress } from "@/stores/progress.store"
import { DEFAULT_SETTINGS } from "@/stores/settings.store"
import type { ConfusionGroup, ProgressState, Settings } from "@/lib/types"

const TSU = "hiragana:つ"
const SHI = "hiragana:し"
const SO = "katakana:ソ"
const N = "katakana:ン"

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  activationThreshold: 2,
  graduationStreak: 4,
}

/** Applies a series of confusions, threading the progress state through. */
function confuse(
  progress: ProgressState,
  pairs: Array<[string, string]>,
  overrides: Partial<Settings> = {}
): ProgressState {
  return pairs.reduce((acc, [shown, answered]) => {
    const patch = recordConfusion(
      acc,
      shown,
      answered,
      { ...settings, ...overrides },
      1000
    )
    return { ...acc, ...patch }
  }, progress)
}

/** Reads a group the test has just created, failing loudly if it is missing. */
function group(progress: ProgressState, id: string): ConfusionGroup {
  const found = progress.groups[id]
  expect(found, `expected group ${id} to exist`).toBeDefined()
  return found as ConfusionGroup
}

describe("pairMisses", () => {
  it("counts both directions as the same discrimination problem", () => {
    const progress = confuse(emptyProgress(), [
      [TSU, SHI],
      [SHI, TSU],
    ])
    expect(pairMisses(progress.matrix, TSU, SHI)).toBe(2)
    expect(pairMisses(progress.matrix, SHI, TSU)).toBe(2)
  })
})

describe("group formation", () => {
  it("does not activate a group from a single isolated miss", () => {
    const progress = confuse(emptyProgress(), [[TSU, SHI]])
    expect(Object.keys(progress.groups)).toHaveLength(0)
  })

  it("activates once the pair crosses the threshold", () => {
    const progress = confuse(emptyProgress(), [
      [TSU, SHI],
      [TSU, SHI],
    ])
    const found = group(progress, groupIdOf([TSU, SHI]))
    expect(found.status).toBe("active")
    expect(found.members.sort()).toEqual([SHI, TSU].sort())
    expect(found.totalMisses).toBe(2)
  })

  it("reaches the threshold from misses in opposite directions", () => {
    const progress = confuse(emptyProgress(), [
      [TSU, SHI],
      [SHI, TSU],
    ])
    expect(progress.groups[groupIdOf([TSU, SHI])]).toBeDefined()
  })

  it("merges D-A, D-B and D-C into a single component", () => {
    const D = "katakana:ツ"
    const progress = confuse(emptyProgress(), [
      [D, SO],
      [D, SO],
      [D, N],
      [D, N],
      [D, "katakana:シ"],
      [D, "katakana:シ"],
    ])
    const groups = Object.values(progress.groups)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.members.sort()).toEqual([D, SO, N, "katakana:シ"].sort())
  })

  it("caps an oversized component at maxGroupSize", () => {
    const extra = "katakana:ノ"
    const D = "katakana:ツ"
    const progress = confuse(
      emptyProgress(),
      [
        [D, SO],
        [D, SO],
        [D, SO],
        [D, N],
        [D, N],
        [D, N],
        [D, "katakana:シ"],
        [D, "katakana:シ"],
        [D, "katakana:シ"],
        [D, extra],
        [D, extra],
      ],
      { maxGroupSize: 3 }
    )
    const groups = Object.values(progress.groups)
    expect(groups).toHaveLength(1)
    expect(groups[0]!.members).toHaveLength(3)
    // The least entangled member is the one dropped.
    expect(groups[0]!.members).not.toContain(extra)
  })

  it("resets the streak when new members join the group", () => {
    let progress = confuse(emptyProgress(), [
      [TSU, SHI],
      [TSU, SHI],
    ])
    const pairId = groupIdOf([TSU, SHI])
    progress = {
      ...progress,
      groups: {
        ...progress.groups,
        [pairId]: { ...group(progress, pairId), streak: 3 },
      },
    }

    const grown = confuse(progress, [
      [TSU, SO],
      [TSU, SO],
    ])
    const grownGroup = Object.values(grown.groups)[0]!
    expect(grownGroup.members).toHaveLength(3)
    expect(grownGroup.streak).toBe(0)
  })
})

describe("graduation and relapse", () => {
  const base = confuse(emptyProgress(), [
    [TSU, SHI],
    [TSU, SHI],
  ])
  const pairId = groupIdOf([TSU, SHI])

  it("graduates after the configured run of correct answers", () => {
    let groups = base.groups
    let graduated: Array<string> = []

    for (let i = 0; i < settings.graduationStreak; i++) {
      const kana = i % 2 === 0 ? TSU : SHI
      const result = applyAnswerToGroups(
        groups,
        kana,
        true,
        null,
        settings,
        2000
      )
      groups = result.groups
      graduated = result.graduated
    }

    expect(groups[pairId]!.status).toBe("graduated")
    expect(graduated).toEqual([pairId])
  })

  it("resets the streak on a miss before graduating", () => {
    let groups = applyAnswerToGroups(
      base.groups,
      TSU,
      true,
      null,
      settings,
      2000
    ).groups
    expect(groups[pairId]!.streak).toBe(1)

    groups = applyAnswerToGroups(groups, TSU, false, SHI, settings, 2000).groups
    expect(groups[pairId]!.streak).toBe(0)
    expect(groups[pairId]!.status).toBe("active")
  })

  it("reactivates a graduated group when its members cross again", () => {
    const graduatedGroups = {
      [pairId]: {
        ...group(base, pairId),
        status: "graduated" as const,
        graduatedAt: 2000,
        streak: 0,
      },
    }

    const { groups } = applyAnswerToGroups(
      graduatedGroups,
      TSU,
      false,
      SHI,
      settings,
      3000
    )
    expect(groups[pairId]!.status).toBe("active")
    expect(groups[pairId]!.timesActivated).toBe(2)
  })

  it("leaves a graduated group alone when the miss is a plain typo", () => {
    const graduatedGroups = {
      [pairId]: {
        ...group(base, pairId),
        status: "graduated" as const,
        streak: 0,
      },
    }
    const { groups } = applyAnswerToGroups(
      graduatedGroups,
      TSU,
      false,
      null,
      settings,
      3000
    )
    expect(groups[pairId]!.status).toBe("graduated")
  })
})
