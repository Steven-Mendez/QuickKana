import {
  isLessonComplete,
  lessonAt,
  lessonPhase,
  poolUpTo,
  retention,
} from "@/lib/journey"
import { LESSON_BOOST_MAX, lessonBoost } from "@/lib/momentum"
import type { LessonPhase } from "@/lib/journey"
import type { Boost } from "@/lib/scheduler"
import type { CharStat, Script } from "@/lib/types"

export interface GuidedPool {
  ids: Array<string>
  boost?: Boost
  phase: LessonPhase
}

/**
 * What the guided mode draws from, in two phases per lesson.
 *
 * While the new section is still being met ("focus"), the pool is the section
 * and nothing else: mixing forty review kana into the first sightings of five
 * new ones buries them, however hard their weights are boosted. Once every new
 * character has been read right a few times ("mix"), the whole unlocked pool
 * returns and the lesson only has to earn its unlock against real review.
 *
 * In mix, `lessonStreak` decides how hard the lesson is weighted: the better
 * the user is doing *on the new characters*, the less of the session is spent
 * re-confirming the ones already answered right a dozen times over.
 *
 * Once the section is learned the weight moves to whatever review has slipped,
 * because that is now the only thing standing between the user and the next
 * lesson. Without this the drill would spend its boost drilling five kana that
 * are already mastered while the characters actually blocking the unlock
 * surfaced once every forty prompts.
 */
export function guidedPool(
  script: Script,
  index: number,
  charStats: Record<string, CharStat>,
  lessonStreak: number
): GuidedPool {
  const lesson = lessonAt(script, index)

  if (lessonPhase(lesson, charStats) === "focus") {
    // No boost: with every candidate boosted alike the factor cancels out.
    return { ids: lesson.ids, phase: "focus" }
  }

  const ids = poolUpTo(script, lesson.index)
  const blocking = isLessonComplete(lesson, charStats)
    ? retention(script, lesson.index, charStats).slipped
    : []

  return {
    ids,
    phase: "mix",
    boost: blocking.length
      ? { ids: new Set(blocking), factor: LESSON_BOOST_MAX }
      : {
          ids: new Set(lesson.ids),
          factor: lessonBoost(lessonStreak, lesson.ids.length),
        },
  }
}
