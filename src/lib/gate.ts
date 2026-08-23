import { isWritable } from "@/lib/kana/strokes"
import { getKana } from "@/lib/kana"
import type { Lesson } from "@/lib/journey"
import type { CharStat, Settings, WriteCharStat } from "@/lib/types"

/** Read sightings a lesson character needs before its lesson can pass. */
export const MIN_READ_SEEN = 2

/**
 * What a lesson still owes the unlock gate, per exercise type.
 *
 * With both types on, mastery alone does not pass a lesson: each character must
 * have been read a couple of times AND written cleanly from memory — no
 * outline, no demo. (With "always show outline" forced on, memory attempts can
 * never happen, so a clean guided write counts instead.) Turning either type
 * off drops its half of the requirement entirely.
 */
export interface LessonNeeds {
  /** Lesson characters still short of the read exposure the gate asks for. */
  read: Array<string>
  /** Lesson characters never yet written the way the gate asks for. */
  write: Array<string>
}

export const NO_NEEDS: LessonNeeds = { read: [], write: [] }

export function lessonNeeds(
  lesson: Lesson,
  readStats: Record<string, CharStat>,
  writeStats: Record<string, WriteCharStat>,
  settings: Settings
): LessonNeeds {
  if (!settings.practiceReading || !settings.practiceWriting) return NO_NEEDS

  const read: Array<string> = []
  const write: Array<string> = []

  for (const id of lesson.ids) {
    if ((readStats[id]?.attempts ?? 0) < MIN_READ_SEEN) read.push(id)

    const kana = getKana(id)
    if (!kana || !isWritable(kana)) continue
    const stat = writeStats[id]
    const written = settings.writeAlwaysOutline
      ? (stat?.correct ?? 0)
      : (stat?.memoryCorrect ?? 0)
    if (written < 1) write.push(id)
  }

  return { read, write }
}

/** The per-character veto the unlock applies on top of the mastery bar. */
export const charReady = (
  id: string,
  readStats: Record<string, CharStat>,
  writeStats: Record<string, WriteCharStat>,
  settings: Settings
): boolean => {
  if (!settings.practiceReading || !settings.practiceWriting) return true
  if ((readStats[id]?.attempts ?? 0) < MIN_READ_SEEN) return false

  const kana = getKana(id)
  if (!kana || !isWritable(kana)) return true
  const stat = writeStats[id]
  const written = settings.writeAlwaysOutline
    ? (stat?.correct ?? 0)
    : (stat?.memoryCorrect ?? 0)
  return written >= 1
}
