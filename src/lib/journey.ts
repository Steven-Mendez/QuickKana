import { ROWS_BY_SCRIPT, SCRIPTS } from "@/lib/kana"
import { mastery } from "@/lib/stats"
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

/** Mastery a character must reach before its lesson counts as learned. */
export const LESSON_MASTERY = 0.75

export const isMastered = (stat: CharStat | undefined): boolean =>
  (mastery(stat) ?? 0) >= LESSON_MASTERY

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
  charStats: Record<string, CharStat>
): boolean => lesson.ids.every((id) => isMastered(charStats[id]))

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
