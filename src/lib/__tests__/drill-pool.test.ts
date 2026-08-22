import { describe, expect, it } from "vitest"
import { guidedPool } from "@/lib/drill-pool"
import { FAMILIARITY_ATTEMPTS, lessonAt, poolUpTo } from "@/lib/journey"
import { LESSON_BOOST_MAX, lessonBoost } from "@/lib/momentum"
import { emptyCharStat } from "@/lib/scheduler"
import { MASTERY_ATTEMPTS } from "@/lib/stats"
import type { CharStat } from "@/lib/types"

/** Every id answered correctly `attempts` times and never missed. */
const clean = (
  ids: Array<string>,
  attempts: number
): Record<string, CharStat> =>
  Object.fromEntries(
    ids.map((id) => [id, { ...emptyCharStat(), attempts, correct: attempts }])
  )

const mastered = (ids: Array<string>): Record<string, CharStat> =>
  clean(ids, MASTERY_ATTEMPTS)

describe("guidedPool", () => {
  it("narrows to the new section alone while it is still being met", () => {
    const lesson = lessonAt("hiragana", 2)
    const stats = mastered(poolUpTo("hiragana", 1))

    const pool = guidedPool("hiragana", 2, stats, 0)

    expect(pool.phase).toBe("focus")
    expect(pool.ids).toEqual(lesson.ids)
    expect(pool.boost).toBeUndefined()
  })

  it("brings the whole unlocked pool back once the section is familiar", () => {
    const lesson = lessonAt("hiragana", 2)
    const stats = {
      ...mastered(poolUpTo("hiragana", 1)),
      ...clean(lesson.ids, FAMILIARITY_ATTEMPTS),
    }

    const pool = guidedPool("hiragana", 2, stats, 4)

    expect(pool.phase).toBe("mix")
    expect(pool.ids).toEqual(poolUpTo("hiragana", 2))
    expect(pool.boost?.ids).toEqual(new Set(lesson.ids))
    expect(pool.boost?.factor).toBe(lessonBoost(4, lesson.ids.length))
  })

  it("moves the boost to slipped review once the lesson itself is learned", () => {
    const lesson = lessonAt("hiragana", 2)
    const earlier = poolUpTo("hiragana", 1)
    const rusty = earlier[0] as string
    const stats = {
      ...mastered(earlier),
      ...mastered(lesson.ids),
      [rusty]: { ...emptyCharStat(), attempts: 10, correct: 4 },
    }

    const pool = guidedPool("hiragana", 2, stats, 0)

    expect(pool.phase).toBe("mix")
    expect(pool.boost?.ids).toEqual(new Set([rusty]))
    expect(pool.boost?.factor).toBe(LESSON_BOOST_MAX)
  })

  it("treats the first lesson like any other: focus is the same pool anyway", () => {
    const pool = guidedPool("hiragana", 0, {}, 0)

    expect(pool.phase).toBe("focus")
    expect(pool.ids).toEqual(poolUpTo("hiragana", 0))
  })

  it("narrows back to the section when one of its characters collapses", () => {
    const lesson = lessonAt("hiragana", 2)
    const stats = {
      ...mastered(poolUpTo("hiragana", 1)),
      ...mastered(lesson.ids),
      [lesson.ids[0] as string]: {
        ...emptyCharStat(),
        attempts: 8,
        correct: 4,
      },
    }

    expect(guidedPool("hiragana", 2, stats, 0).phase).toBe("focus")
    expect(guidedPool("hiragana", 2, stats, 0).ids).toEqual(lesson.ids)
  })
})
