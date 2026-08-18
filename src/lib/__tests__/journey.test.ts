import { describe, expect, it } from "vitest"
import {
  LESSON_MASTERY,
  TRACKS,
  isLessonComplete,
  lastLessonOf,
  lessonAt,
  lessonById,
  lessonProgress,
  poolUpTo,
  trackProgress,
} from "@/lib/journey"
import { ALL_KANA, kanaId } from "@/lib/kana"
import { emptyCharStat } from "@/lib/scheduler"
import { MASTERY_ATTEMPTS } from "@/lib/stats"
import type { CharStat } from "@/lib/types"

/** A character answered `attempts` times, all correct. */
const solid = (attempts = MASTERY_ATTEMPTS): CharStat => ({
  ...emptyCharStat(),
  attempts,
  correct: attempts,
  totalMs: attempts * 800,
})

const statsFor = (ids: Array<string>): Record<string, CharStat> =>
  Object.fromEntries(ids.map((id) => [id, solid()]))

describe("curriculum", () => {
  it("gives each syllabary its own track, starting at あ and ア", () => {
    expect(lessonAt("hiragana", 0).chars).toEqual([
      "あ",
      "い",
      "う",
      "え",
      "お",
    ])
    expect(lessonAt("katakana", 0).chars).toEqual([
      "ア",
      "イ",
      "ウ",
      "エ",
      "オ",
    ])
  })

  it("covers every character exactly once across both tracks", () => {
    const ids = [...TRACKS.hiragana, ...TRACKS.katakana].flatMap(
      (lesson) => lesson.ids
    )
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(ALL_KANA.length)
  })

  it("keeps a track to a single script", () => {
    for (const lesson of TRACKS.katakana) {
      expect(lesson.script).toBe("katakana")
    }
  })

  it("gives both tracks the same shape, since the tables mirror each other", () => {
    expect(TRACKS.hiragana.length).toBe(TRACKS.katakana.length)
    expect(TRACKS.hiragana.map((lesson) => lesson.label)).toEqual(
      TRACKS.katakana.map((lesson) => lesson.label)
    )
  })

  it("never introduces a lesson of fewer than three characters", () => {
    for (const lesson of [...TRACKS.hiragana, ...TRACKS.katakana]) {
      expect(lesson.ids.length).toBeGreaterThanOrEqual(3)
    }
  })

  it("folds わ and ん into one lesson", () => {
    const lesson = TRACKS.hiragana.find((item) => item.label === "wa · n")
    expect(lesson?.chars).toEqual(["わ", "を", "ん"])
  })

  it("resolves a lesson back from its id", () => {
    const lesson = lessonAt("katakana", 3)
    expect(lessonById(lesson.id)).toBe(lesson)
    expect(lessonById("nope")).toBeUndefined()
  })
})

describe("poolUpTo", () => {
  it("keeps every unlocked character in the pool, not just the newest", () => {
    const pool = poolUpTo("hiragana", 2)
    expect(pool).toContain(kanaId("hiragana", "あ"))
    expect(pool).toContain(lessonAt("hiragana", 2).ids[0])
    expect(pool.length).toBe(
      lessonAt("hiragana", 0).ids.length +
        lessonAt("hiragana", 1).ids.length +
        lessonAt("hiragana", 2).ids.length
    )
  })

  it("never mixes in the other syllabary", () => {
    expect(
      poolUpTo("hiragana", lastLessonOf("hiragana")).every((id) =>
        id.startsWith("hiragana:")
      )
    ).toBe(true)
  })

  it("clamps past the end of a track", () => {
    expect(poolUpTo("katakana", 9999).length).toBe(
      ALL_KANA.filter((kana) => kana.script === "katakana").length
    )
  })
})

describe("lesson completion", () => {
  it("needs every character of the lesson mastered", () => {
    const lesson = lessonAt("hiragana", 0)
    const partial = statsFor(lesson.ids.slice(0, -1))

    expect(isLessonComplete(lesson, partial)).toBe(false)
    expect(lessonProgress(lesson, partial).pending).toEqual([
      lesson.ids[lesson.ids.length - 1],
    ])

    expect(isLessonComplete(lesson, statsFor(lesson.ids))).toBe(true)
  })

  it("does not count a character answered right only once or twice", () => {
    const lesson = lessonAt("hiragana", 0)
    const shaky = Object.fromEntries(
      lesson.ids.map((id) => [id, solid(2)])
    ) as Record<string, CharStat>

    expect(isLessonComplete(lesson, shaky)).toBe(false)
    expect(lessonProgress(lesson, shaky).ratio).toBe(0)
  })

  it("does not count a character that is often wrong, however many attempts", () => {
    const lesson = lessonAt("hiragana", 0)
    const sloppy = Object.fromEntries(
      lesson.ids.map((id) => [
        id,
        { ...emptyCharStat(), attempts: 20, correct: 10 },
      ])
    ) as Record<string, CharStat>

    // 50% accuracy is below the mastery bar no matter how much exposure.
    expect(LESSON_MASTERY).toBeGreaterThan(0.5)
    expect(isLessonComplete(lesson, sloppy)).toBe(false)
  })
})

describe("trackProgress", () => {
  it("counts mastered characters among the unlocked ones of that track", () => {
    const stats = statsFor(lessonAt("hiragana", 0).ids)
    const progress = trackProgress("hiragana", 1, stats)

    expect(progress.mastered).toBe(lessonAt("hiragana", 0).ids.length)
    expect(progress.unlocked).toBe(
      lessonAt("hiragana", 0).ids.length + lessonAt("hiragana", 1).ids.length
    )
    expect(progress.total).toBe(
      ALL_KANA.filter((kana) => kana.script === "hiragana").length
    )
  })

  it("ignores progress made in the other syllabary", () => {
    const stats = statsFor(lessonAt("hiragana", 0).ids)
    expect(trackProgress("katakana", 0, stats).mastered).toBe(0)
  })
})
