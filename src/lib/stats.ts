import { ALL_KANA, getKana } from "@/lib/kana"
import type { CharStat, ProgressState } from "@/lib/types"

export interface ConfusionPair {
  shownId: string
  answeredId: string
  count: number
  /** Share of this character's recorded confusions that go to this answer. */
  share: number
}

/** Every recorded confusion, ordered by frequency. */
export function confusionPairs(progress: ProgressState): Array<ConfusionPair> {
  const pairs: Array<ConfusionPair> = []

  for (const [shownId, row] of Object.entries(progress.matrix)) {
    const rowTotal = Object.values(row).reduce((sum, n) => sum + n, 0)
    for (const [answeredId, count] of Object.entries(row)) {
      if (count <= 0) continue
      pairs.push({
        shownId,
        answeredId,
        count,
        share: rowTotal > 0 ? count / rowTotal : 0,
      })
    }
  }

  return pairs.sort((a, b) => b.count - a.count)
}

export interface CharRow {
  id: string
  char: string
  romaji: string
  attempts: number
  correct: number
  accuracy: number
  avgMs: number
  /** The kana this one is most often mistaken for, if any. */
  topConfusion: { id: string; char: string; count: number } | null
  confusionTotal: number
  stat: CharStat
}

/** Per-character rows for the stats table, restricted to kana actually drilled. */
export function charRows(progress: ProgressState): Array<CharRow> {
  const rows: Array<CharRow> = []

  for (const [id, stat] of Object.entries(progress.charStats)) {
    const kana = getKana(id)
    if (!kana || stat.attempts === 0) continue

    const row = progress.matrix[id] ?? {}
    const entries = Object.entries(row).sort((a, b) => b[1] - a[1])
    const top = entries[0]
    const topKana = top ? getKana(top[0]) : undefined

    rows.push({
      id,
      char: kana.char,
      romaji: kana.romaji,
      attempts: stat.attempts,
      correct: stat.correct,
      accuracy: stat.correct / stat.attempts,
      avgMs: stat.totalMs / stat.attempts,
      topConfusion:
        top && topKana
          ? { id: top[0], char: topKana.char, count: top[1] }
          : null,
      confusionTotal: entries.reduce((sum, [, n]) => sum + n, 0),
      stat,
    })
  }

  return rows.sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
}

export interface Heatmap {
  ids: Array<string>
  chars: Array<string>
  /** `cells[row][col]` = times the row kana was answered as the column kana. */
  cells: Array<Array<number>>
  max: number
}

/**
 * Builds a square heatmap over the most error-prone characters. A full
 * 208×208 grid would be unreadable, so it is trimmed to the kana carrying the
 * most confusions — which are exactly the ones worth looking at.
 */
export function heatmap(
  progress: ProgressState,
  limit: number,
  restrictTo?: Set<string>
): Heatmap {
  const involvement = new Map<string, number>()
  const bump = (id: string, n: number) =>
    involvement.set(id, (involvement.get(id) ?? 0) + n)

  for (const [shownId, row] of Object.entries(progress.matrix)) {
    for (const [answeredId, count] of Object.entries(row)) {
      if (
        restrictTo &&
        (!restrictTo.has(shownId) || !restrictTo.has(answeredId))
      ) {
        continue
      }
      bump(shownId, count)
      bump(answeredId, count)
    }
  }

  const ids = [...involvement.entries()]
    .filter(([id]) => getKana(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id)
    .sort()

  const cells = ids.map((shownId) =>
    ids.map((answeredId) =>
      shownId === answeredId ? 0 : (progress.matrix[shownId]?.[answeredId] ?? 0)
    )
  )

  return {
    ids,
    chars: ids.map((id) => getKana(id)?.char ?? "?"),
    cells,
    max: Math.max(0, ...cells.flat()),
  }
}

/**
 * Attempts before a character's accuracy is taken at face value. Three correct
 * answers in a row are encouraging but they are not proof, so mastery ramps up
 * with exposure instead of jumping to 100% on the first hit.
 */
export const MASTERY_ATTEMPTS = 6

/**
 * How learned a character is, 0–1, or `null` if it was never drilled.
 *
 * `attemptsNeeded` is how much exposure the confidence ramp asks for. The
 * unlock check lowers it when the session streak has already supplied the
 * evidence — accuracy is never discounted, only the number of repetitions it
 * has to be demonstrated over.
 */
export function mastery(
  stat: CharStat | undefined,
  attemptsNeeded = MASTERY_ATTEMPTS
): number | null {
  if (!stat || stat.attempts === 0) return null
  const accuracy = stat.correct / stat.attempts
  const confidence = Math.min(1, stat.attempts / Math.max(1, attemptsNeeded))
  return accuracy * confidence
}

/**
 * Average mastery across the whole syllabary — never-drilled kana count as
 * zero, so this is "how much of the kana do I know", not "how well am I doing
 * on what I happen to have practised".
 */
export function overallMastery(charStats: Record<string, CharStat>): number {
  const total = ALL_KANA.reduce(
    (sum, kana) => sum + (mastery(charStats[kana.id]) ?? 0),
    0
  )
  return total / ALL_KANA.length
}

/** Characters at or above the mastery bar, across the whole syllabary. */
export function masteredCount(
  charStats: Record<string, CharStat>,
  threshold: number
): number {
  return ALL_KANA.filter(
    (kana) => (mastery(charStats[kana.id]) ?? 0) >= threshold
  ).length
}

export const TOTAL_KANA = ALL_KANA.length

export const formatMs = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`

export const formatDuration = (ms: number): string => {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export const formatPercent = (value: number): string =>
  `${Math.round(value * 100)}%`
