import { ROWS_BY_SCRIPT, SCRIPTS } from "@/lib/kana"
import { MASTERY_ATTEMPTS, mastery } from "@/lib/stats"
import type { CharStat, Kana, KanaCategory, KanaRow, Script } from "@/lib/types"

export interface Lesson {
  /** Position inside its own track, not across both. */
  index: number
  id: string
  /** Row names the lesson introduces, e.g. `ka` or `wa · n`. */
  label: string
  script: Script
  category: KanaCategory
  ids: Array<string>
  chars: Array<string>
}

/** A lesson never introduces fewer than this many characters. */
const MIN_LESSON_SIZE = 3

const CATEGORY_ORDER: Array<KanaCategory> = ["gojuon", "dakuten", "digraph"]

const cellsOf = (row: KanaRow): Array<Kana> =>
  row.cells.filter((cell): cell is Kana => cell !== null)

/**
 * One lesson per row of a syllabary's tables, in the order a textbook teaches
 * them: あ行 through ん, then dakuten, then digraphs.
 *
 * Rows too small to be worth a lesson of their own (わ has two characters, ん
 * has one) are folded into the following row, so no step is a single card.
 */
function buildTrack(script: Script): Array<Lesson> {
  const lessons: Array<Lesson> = []
  let buffer: Array<KanaRow> = []

  const flush = (category: KanaCategory) => {
    if (buffer.length === 0) return
    const cells = buffer.flatMap(cellsOf)
    lessons.push({
      index: lessons.length,
      id: `${script}:${buffer.map((row) => row.rowId).join("+")}`,
      label: buffer.map((row) => row.label).join(" · "),
      script,
      category,
      ids: cells.map((cell) => cell.id),
      chars: cells.map((cell) => cell.char),
    })
    buffer = []
  }

  for (const category of CATEGORY_ORDER) {
    for (const row of ROWS_BY_SCRIPT[script]) {
      if (row.category !== category) continue
      buffer.push(row)
      if (buffer.flatMap(cellsOf).length >= MIN_LESSON_SIZE) flush(category)
    }
    flush(category)
  }

  return lessons
}

/**
 * Two independent curricula, one per syllabary. Courses disagree about which
 * one comes first — and plenty of learners arrive already knowing hiragana —
 * so neither track gates the other: each keeps its own position.
 */
export const TRACKS: Record<Script, Array<Lesson>> = {
  hiragana: buildTrack("hiragana"),
  katakana: buildTrack("katakana"),
}

export const ALL_LESSONS: Array<Lesson> = SCRIPTS.flatMap(
  (script) => TRACKS[script]
)

const BY_ID = new Map(ALL_LESSONS.map((lesson) => [lesson.id, lesson]))

export const lessonById = (id: string): Lesson | undefined => BY_ID.get(id)

export const trackLength = (script: Script): number => TRACKS[script].length

export const lastLessonOf = (script: Script): number =>
  TRACKS[script].length - 1

/**
 * Mastery a character must reach before its lesson counts as learned. This bar
 * never moves: whatever else changes, a character still has to be read right
 * about three times in four.
 *
 * What a good session does buy is exposure — `attemptsNeeded` shrinks when the
 * streak already proves the point, so the same accuracy clears the same bar on
 * fewer sightings. See `requiredAttempts` in `momentum.ts`.
 */
export const LESSON_MASTERY = 0.75

export const isMastered = (
  stat: CharStat | undefined,
  attemptsNeeded = MASTERY_ATTEMPTS
): boolean => (mastery(stat, attemptsNeeded) ?? 0) >= LESSON_MASTERY

export const lessonAt = (script: Script, index: number): Lesson =>
  TRACKS[script][Math.max(0, Math.min(lastLessonOf(script), index))] as Lesson

/**
 * Everything unlocked so far in one track. Old lessons stay in the pool on
 * purpose: the point of the guided mode is that あ keeps showing up while you
 * learn ら, so nothing quietly rots while you move forward.
 */
export const poolUpTo = (script: Script, index: number): Array<string> =>
  TRACKS[script]
    .slice(0, Math.min(lastLessonOf(script), index) + 1)
    .flatMap((lesson) => lesson.ids)

export interface LessonProgress {
  mastered: Array<string>
  pending: Array<string>
  ratio: number
}

export function lessonProgress(
  lesson: Lesson,
  charStats: Record<string, CharStat>
): LessonProgress {
  const mastered = lesson.ids.filter((id) => isMastered(charStats[id]))
  return {
    mastered,
    pending: lesson.ids.filter((id) => !isMastered(charStats[id])),
    ratio: lesson.ids.length === 0 ? 1 : mastered.length / lesson.ids.length,
  }
}

export const isLessonComplete = (
  lesson: Lesson,
  charStats: Record<string, CharStat>,
  attemptsNeeded = MASTERY_ATTEMPTS
): boolean =>
  lesson.ids.every((id) => isMastered(charStats[id], attemptsNeeded))

/**
 * Share of the earlier characters that has to still hold up before a track
 * moves on.
 *
 * Not 100%: in a pool of forty kana there is always one having a bad day, and
 * blocking the whole curriculum on it would turn the journey into a grind. Not
 * much lower either — the point of the gate is that a section is only passed
 * when the user knows it *and* still reads everything that came before, which
 * is the difference between learning a syllabary and speed-running a list.
 */
export const RETENTION = 0.9

export interface Retention {
  /** Earlier characters still at or above the mastery bar. */
  held: number
  total: number
  ratio: number
  /** Earlier characters that have fallen below it, weakest first. */
  slipped: Array<string>
}

/**
 * How well everything unlocked *before* `index` is holding up.
 *
 * Always measured against the standard bar, never the eased one: a good run on
 * the new section is evidence about that section and nothing else, and letting
 * it discount the review check is exactly the hole this gate exists to close.
 */
export function retention(
  script: Script,
  index: number,
  charStats: Record<string, CharStat>
): Retention {
  const earlier = poolUpTo(script, index - 1)
  const slipped = earlier
    .filter((id) => !isMastered(charStats[id]))
    .sort((a, b) => (mastery(charStats[a]) ?? 0) - (mastery(charStats[b]) ?? 0))
  const held = earlier.length - slipped.length

  return {
    held,
    total: earlier.length,
    // The first lesson of a track has nothing behind it to forget.
    ratio: earlier.length === 0 ? 1 : held / earlier.length,
    slipped,
  }
}

export const holdsUp = (value: Retention): boolean => value.ratio >= RETENTION

/** One track's completion, counting characters rather than lessons. */
export function trackProgress(
  script: Script,
  index: number,
  charStats: Record<string, CharStat>
): { mastered: number; unlocked: number; total: number } {
  const unlocked = poolUpTo(script, index)
  const total = TRACKS[script].reduce(
    (sum, lesson) => sum + lesson.ids.length,
    0
  )
  return {
    mastered: unlocked.filter((id) => isMastered(charStats[id])).length,
    unlocked: unlocked.length,
    total,
  }
}
