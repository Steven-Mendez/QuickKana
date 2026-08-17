import type { ConfusionGroup, ProgressState, Settings } from "@/lib/types"

export const groupIdOf = (members: Array<string>): string =>
  [...members].sort().join("|")

/**
 * Cross-misses between two kana, counted in both directions: mistaking つ for
 * し and し for つ are the same discrimination problem, so the graph that
 * builds confusion groups is undirected.
 */
export function pairMisses(
  matrix: ProgressState["matrix"],
  a: string,
  b: string
): number {
  return (matrix[a]?.[b] ?? 0) + (matrix[b]?.[a] ?? 0)
}

/** Every unordered pair with at least one recorded cross-miss. */
function crossPairs(
  matrix: ProgressState["matrix"]
): Array<{ a: string; b: string; misses: number }> {
  const seen = new Set<string>()
  const pairs: Array<{ a: string; b: string; misses: number }> = []

  for (const [shown, row] of Object.entries(matrix)) {
    for (const answered of Object.keys(row)) {
      if (shown === answered) continue
      const key = groupIdOf([shown, answered])
      if (seen.has(key)) continue
      seen.add(key)
      pairs.push({
        a: shown,
        b: answered,
        misses: pairMisses(matrix, shown, answered),
      })
    }
  }
  return pairs
}

/**
 * Connected components of the graph whose edges are pairs that have crossed
 * the activation threshold.
 *
 * This is what makes the "A, B and C all confused with D" case fall out for
 * free: the edges D–A, D–B and D–C form a single component {A,B,C,D}, and the
 * drill can then interleave D with each of the others.
 */
function components(
  matrix: ProgressState["matrix"],
  settings: Settings
): Array<Array<string>> {
  const adjacency = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    adjacency.get(a)!.add(b)
  }

  for (const { a, b, misses } of crossPairs(matrix)) {
    if (misses < settings.activationThreshold) continue
    link(a, b)
    link(b, a)
  }

  const visited = new Set<string>()
  const result: Array<Array<string>> = []

  for (const node of adjacency.keys()) {
    if (visited.has(node)) continue
    const stack = [node]
    const component: Array<string> = []
    visited.add(node)

    while (stack.length > 0) {
      const cur = stack.pop()!
      component.push(cur)
      for (const next of adjacency.get(cur) ?? []) {
        if (visited.has(next)) continue
        visited.add(next)
        stack.push(next)
      }
    }

    result.push(capSize(component, matrix, settings.maxGroupSize))
  }

  return result
}

/**
 * A component that grew past `maxGroupSize` would produce bursts too long to
 * be useful, so it is trimmed to the most-entangled members — those with the
 * highest total cross-miss weight inside the component.
 */
function capSize(
  component: Array<string>,
  matrix: ProgressState["matrix"],
  maxGroupSize: number
): Array<string> {
  if (component.length <= maxGroupSize) return component.sort()

  const weightOf = (id: string) =>
    component.reduce(
      (sum, other) =>
        other === id ? sum : sum + pairMisses(matrix, id, other),
      0
    )

  return [...component]
    .sort((a, b) => weightOf(b) - weightOf(a) || a.localeCompare(b))
    .slice(0, maxGroupSize)
    .sort()
}

const totalMissesOf = (
  members: Array<string>,
  matrix: ProgressState["matrix"]
): number => {
  let total = 0
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      total += pairMisses(matrix, members[i] as string, members[j] as string)
    }
  }
  return total
}

/**
 * Recomputes every confusion group from the current matrix, carrying the
 * drill state of the previous groups forward.
 *
 * State is inherited from the prior group sharing the most members. When the
 * membership actually changed the streak resets, because discriminating
 * {つ, し, ツ} is a different task from discriminating {つ, し} and progress on
 * the smaller set does not prove the larger one.
 */
export function rebuildGroups(
  progress: ProgressState,
  settings: Settings,
  now: number
): Record<string, ConfusionGroup> {
  const previous = Object.values(progress.groups)
  const next: Record<string, ConfusionGroup> = {}

  for (const members of components(progress.matrix, settings)) {
    const id = groupIdOf(members)
    const totalMisses = totalMissesOf(members, progress.matrix)

    const exact = progress.groups[id]
    if (exact) {
      next[id] = { ...exact, members, totalMisses }
      continue
    }

    const ancestor = previous
      .map((group) => ({
        group,
        overlap: group.members.filter((m) => members.includes(m)).length,
      }))
      .filter(({ overlap }) => overlap >= 2)
      .sort((a, b) => b.overlap - a.overlap)[0]?.group

    next[id] = {
      id,
      members,
      totalMisses,
      status: ancestor?.status ?? "active",
      // Membership changed, so whatever streak the ancestor had no longer
      // describes the discrimination the user now has to make.
      streak: 0,
      activatedAt: ancestor?.activatedAt ?? now,
      graduatedAt: ancestor?.graduatedAt ?? null,
      timesActivated: ancestor?.timesActivated ?? 1,
    }
  }

  // Groups whose members are no longer connected (only reachable if the
  // thresholds were raised in settings) simply disappear.
  return next
}

/**
 * Records one cross-confusion and refreshes the groups derived from it.
 * Mutates nothing — returns the fields to merge into progress.
 */
export function recordConfusion(
  progress: ProgressState,
  shownId: string,
  answeredId: string,
  settings: Settings,
  now: number
): Pick<ProgressState, "matrix" | "groups"> {
  const row = { ...(progress.matrix[shownId] ?? {}) }
  row[answeredId] = (row[answeredId] ?? 0) + 1
  const matrix = { ...progress.matrix, [shownId]: row }

  const withMatrix: ProgressState = { ...progress, matrix }
  return { matrix, groups: rebuildGroups(withMatrix, settings, now) }
}

const TYPOS_PER_CHAR = 20

/** Answers that spell no kana at all, kept out of the matrix on purpose. */
export function recordTypo(
  progress: ProgressState,
  shownId: string,
  typed: string
): ProgressState["typos"] {
  const row = { ...(progress.typos[shownId] ?? {}) }
  row[typed] = (row[typed] ?? 0) + 1

  if (Object.keys(row).length > TYPOS_PER_CHAR) {
    const trimmed = Object.entries(row)
      .sort((a, b) => b[1] - a[1])
      .slice(0, TYPOS_PER_CHAR)
    return { ...progress.typos, [shownId]: Object.fromEntries(trimmed) }
  }

  return { ...progress.typos, [shownId]: row }
}

/**
 * Advances graduation state after a first attempt.
 *
 * A correct answer on any member of an active group counts towards its streak;
 * a miss resets it. A graduated group whose members get crossed again relapses
 * straight back into active — the point is that a pair can be re-learned and
 * then forgotten.
 */
export function applyAnswerToGroups(
  groups: Record<string, ConfusionGroup>,
  kanaId: string,
  correct: boolean,
  confusedWith: string | null,
  settings: Settings,
  now: number
): { groups: Record<string, ConfusionGroup>; graduated: Array<string> } {
  const next: Record<string, ConfusionGroup> = {}
  const graduated: Array<string> = []

  for (const [id, group] of Object.entries(groups)) {
    if (!group.members.includes(kanaId)) {
      next[id] = group
      continue
    }

    if (correct) {
      if (group.status !== "active") {
        next[id] = group
        continue
      }
      const streak = group.streak + 1
      if (streak >= settings.graduationStreak) {
        graduated.push(id)
        next[id] = {
          ...group,
          status: "graduated",
          graduatedAt: now,
          streak: 0,
        }
      } else {
        next[id] = { ...group, streak }
      }
      continue
    }

    const relapsed =
      group.status === "graduated" &&
      confusedWith !== null &&
      group.members.includes(confusedWith)

    next[id] = relapsed
      ? {
          ...group,
          status: "active",
          streak: 0,
          activatedAt: now,
          timesActivated: group.timesActivated + 1,
        }
      : { ...group, streak: 0 }
  }

  return { groups: next, graduated }
}

export const activeGroups = (
  groups: Record<string, ConfusionGroup>
): Array<ConfusionGroup> =>
  Object.values(groups).filter((group) => group.status === "active")
