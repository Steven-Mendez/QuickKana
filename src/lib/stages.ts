import { getKana } from "@/lib/kana"
import { isWritable } from "@/lib/kana/strokes"
import { FAMILIARITY_ATTEMPTS, isMastered } from "@/lib/journey"
import { lessonNeeds } from "@/lib/gate"
import { needsOutline } from "@/lib/writing"
import type { Lesson } from "@/lib/journey"
import type {
  CharStat,
  ExerciseType,
  Settings,
  WriteCharStat,
} from "@/lib/types"

/**
 * How a lesson is worked through, in the order the characters are actually
 * learned rather than at random:
 *
 * 1. `read` — meet them and learn to recognize them. Reading only, nothing but
 *    the new section: five first sightings buried in forty review kana are not
 *    an introduction.
 * 2. `trace` — meet the strokes, over the guide. Writing only, same section.
 * 3. `recall` — the hard version of both: the guide is gone by now (a couple of
 *    clean traces retire it), so writing is from memory, and reading is mixed
 *    back in with review while the section keeps the weight.
 * 4. `review` — the section is learned; what is left is everything that came
 *    before it, weighted toward whatever has slipped. The unlock waits here.
 *
 * Derived from the stats, never stored: the stage survives reloads for free,
 * and a section that collapses during review drops back to the stage that
 * fixes it.
 */
export type LessonStage = "read" | "trace" | "recall" | "review"

export interface LessonStageState {
  stage: LessonStage
  /** The lesson's characters this stage is still waiting on. */
  pending: Array<string>
}

/** Exercise types the drill may serve during a stage. */
export const STAGE_EXERCISES: Record<LessonStage, Array<ExerciseType>> = {
  read: ["read"],
  trace: ["write"],
  recall: ["read", "write"],
  review: ["read", "write"],
}

/** Stages that work the new section alone, with review held back. */
export const isNarrowStage = (stage: LessonStage): boolean =>
  stage === "read" || stage === "trace"

const writablesOf = (lesson: Lesson): Array<string> =>
  lesson.ids.filter((id) => {
    const kana = getKana(id)
    return !!kana && isWritable(kana)
  })

export function lessonStage(
  lesson: Lesson,
  readStats: Record<string, CharStat>,
  writeStats: Record<string, WriteCharStat>,
  settings: Settings
): LessonStageState {
  // 1. Recognition, at the same bar the drill has always used for "met it":
  // read right a few times, not merely shown.
  if (settings.practiceReading) {
    const pending = lesson.ids.filter(
      (id) => !isMastered(readStats[id], FAMILIARITY_ATTEMPTS)
    )
    if (pending.length > 0) return { stage: "read", pending }
  }

  // 2. The strokes, while the guide is still on. `needsOutline` is what puts it
  // there, so the stage ends exactly when the guide does.
  if (settings.practiceWriting) {
    const pending = writablesOf(lesson).filter((id) =>
      needsOutline(writeStats[id])
    )
    if (pending.length > 0) return { stage: "trace", pending }
  }

  // 3. Whatever the unlock still owes on the section itself — in practice the
  // writes from memory, since the guide has just been retired.
  const needs = lessonNeeds(lesson, readStats, writeStats, settings)
  const pending = lesson.ids.filter(
    (id) => needs.read.includes(id) || needs.write.includes(id)
  )
  if (pending.length > 0) return { stage: "recall", pending }

  return { stage: "review", pending: [] }
}
