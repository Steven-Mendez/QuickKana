import { activeGroups, pairMisses } from "@/lib/confusion"
import type {
  Burst,
  CharStat,
  ConfusionGroup,
  Pick,
  ProgressState,
  Settings,
} from "@/lib/types"

export const MIN_WEIGHT = 0.5
export const MAX_WEIGHT = 8
/** Unseen kana start slightly above 1 so they are not crowded out at first. */
export const NEW_WEIGHT = 1.5

export const emptyCharStat = (): CharStat => ({
  attempts: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  totalMs: 0,
  lastSeenAt: 0,
  weight: NEW_WEIGHT,
})

/** Correct answers taper the weight down; misses spike it. */
export const nextWeight = (weight: number, correct: boolean): number =>
  correct
    ? Math.max(MIN_WEIGHT, weight * 0.85)
    : Math.min(MAX_WEIGHT, weight * 2 + 1)

type Rng = () => number

function pickRandom<T>(items: Array<T>, rng: Rng): T {
  // Callers always pass a non-empty array; the index is bounded by construction.
  return items[Math.floor(rng() * items.length)] as T
}

function shuffle<T>(items: Array<T>, rng: Rng): Array<T> {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = out[i] as T
    out[i] = out[j] as T
    out[j] = swap
  }
  return out
}

function weightedPick(
  ids: Array<string>,
  weightOf: (id: string) => number,
  rng: Rng
): string {
  const total = ids.reduce((sum, id) => sum + weightOf(id), 0)
  if (total <= 0) return pickRandom(ids, rng)

  let roll = rng() * total
  for (const id of ids) {
    roll -= weightOf(id)
    if (roll <= 0) return id
  }
  return ids[ids.length - 1] as string
}

/** Drops the previous kana from the candidates unless it is the only one left. */
const excludeLast = (ids: Array<string>, lastShownId: string | null) => {
  if (!lastShownId || ids.length < 2) return ids
  const filtered = ids.filter((id) => id !== lastShownId)
  return filtered.length > 0 ? filtered : ids
}

/** Swaps neighbours apart so the same kana never appears twice in a row. */
function dedupeAdjacent(seq: Array<string>): Array<string> {
  const out = [...seq]
  for (let i = 1; i < out.length; i++) {
    if (out[i] !== out[i - 1]) continue
    const swapWith = out.findIndex(
      (id, j) => j > i && id !== out[i - 1] && id !== out[i + 1]
    )
    if (swapWith !== -1) {
      const swap = out[i] as string
      out[i] = out[swapWith] as string
      out[swapWith] = swap
    }
  }
  return out
}

/**
 * Builds the forced sequence for one confusion group.
 *
 * The anchor is the most entangled member, and every other member is paired
 * directly with it so the two appear back to back — seeing し immediately
 * after つ is what forces the discrimination, which raising their individual
 * weights in the general pool would never do.
 *
 * The order of the pairs and the order inside each pair are both randomised:
 * a strict つ,し,つ,し alternation is trivially answerable from the pattern
 * rather than from actually reading the character.
 */
export function buildBurst(
  group: ConfusionGroup,
  pool: Set<string>,
  matrix: ProgressState["matrix"],
  rng: Rng = Math.random
): Array<string> {
  const members = group.members.filter((id) => pool.has(id))
  if (members.length < 2) return []

  const entanglement = (id: string) =>
    members.reduce(
      (sum, other) =>
        other === id ? sum : sum + pairMisses(matrix, id, other),
      0
    )

  const anchor = [...members].sort(
    (a, b) => entanglement(b) - entanglement(a) || a.localeCompare(b)
  )[0] as string
  const others = members.filter((id) => id !== anchor)

  // With only two characters, any repeat-free sequence *is* a strict
  // alternation, so the only thing left to randomise is which side starts.
  if (others.length === 1) {
    const other = others[0] as string
    return rng() < 0.5
      ? [anchor, other, anchor, other]
      : [other, anchor, other, anchor]
  }

  const pairs = others.map((other) =>
    rng() < 0.5 ? [anchor, other] : [other, anchor]
  )

  return dedupeAdjacent(shuffle(pairs, rng).flat())
}

/** Mutable bits of the session the scheduler reads and advances. */
export interface SchedulerState {
  lastShownId: string | null
  burst: Burst | null
  sinceBurst: number
}

export interface SchedulerResult {
  pick: Pick | null
  state: SchedulerState
}

/**
 * Multiplies the pool weight of a subset of the kana. The guided mode uses it
 * so the lesson being introduced dominates the draw while everything unlocked
 * earlier keeps turning up for review.
 */
export interface Boost {
  ids: Set<string>
  factor: number
}

/**
 * Chooses the next kana.
 *
 * Two mechanisms run together: the per-character weight decides how often a
 * kana turns up in the general pool, while active confusion groups periodically
 * take over with a short burst that puts the confused characters side by side.
 * The cooldown between bursts keeps the groups from monopolising the session.
 */
export function nextKana(
  state: SchedulerState,
  pool: Array<string>,
  progress: ProgressState,
  settings: Settings,
  rng: Rng = Math.random,
  boost?: Boost
): SchedulerResult {
  if (pool.length === 0) return { pick: null, state }

  if (!settings.focusMode) {
    const id = pickRandom(excludeLast(pool, state.lastShownId), rng)
    return {
      pick: { id, source: { type: "pool" } },
      state: { lastShownId: id, burst: null, sinceBurst: 0 },
    }
  }

  const poolSet = new Set(pool)

  // 1. A burst is in flight — serve the next item from it.
  if (state.burst && state.burst.queue.length > 0) {
    const queue = [...state.burst.queue]
    let id = queue.shift() as string

    // Rotate rather than repeat, so a burst never shows the same kana twice
    // in a row after the general pool served that same kana just before.
    if (id === state.lastShownId && queue.length > 0) {
      queue.push(id)
      id = queue.shift() as string
    }

    const burst: Burst = { ...state.burst, queue }
    return {
      pick: { id, source: { type: "group", groupId: burst.groupId } },
      state: { lastShownId: id, burst, sinceBurst: state.sinceBurst },
    }
  }

  // 2. The burst just drained — clear it and restart the cooldown.
  const sinceBurst = state.burst ? 0 : state.sinceBurst

  // 3. Start a new burst if a drillable group is waiting and the cooldown is up.
  const drillable = activeGroups(progress.groups).filter(
    (group) => group.members.filter((id) => poolSet.has(id)).length >= 2
  )

  if (drillable.length > 0 && sinceBurst >= settings.burstCooldown) {
    const chosen = weightedPick(
      drillable.map((group) => group.id),
      (id) => Math.max(1, progress.groups[id]?.totalMisses ?? 1),
      rng
    )
    const chosenGroup = progress.groups[chosen]
    const queue = chosenGroup
      ? buildBurst(chosenGroup, poolSet, progress.matrix, rng)
      : []

    if (queue.length > 0) {
      return nextKana(
        {
          lastShownId: state.lastShownId,
          burst: { groupId: chosen, queue },
          sinceBurst: 0,
        },
        pool,
        progress,
        settings,
        rng,
        boost
      )
    }
  }

  // 4. Otherwise draw from the general pool, weighted by per-character weight.
  const candidates = excludeLast(pool, state.lastShownId)
  const id = weightedPick(
    candidates,
    (kanaId) =>
      (progress.charStats[kanaId]?.weight ?? NEW_WEIGHT) *
      (boost?.ids.has(kanaId) ? boost.factor : 1),
    rng
  )

  return {
    pick: { id, source: { type: "pool" } },
    state: { lastShownId: id, burst: null, sinceBurst: sinceBurst + 1 },
  }
}
