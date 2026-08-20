import { beforeEach, describe, expect, it } from "vitest"
import {
  advanceLesson,
  dayKey,
  progressionStore,
  recordSessionResult,
  resetProgression,
  setLesson,
  touchDay,
} from "@/stores/progression.store"
import { TRACKS, lessonAt } from "@/lib/journey"
import { PASSES_FULL } from "@/lib/momentum"
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

const DAY = 24 * 60 * 60 * 1000
/** Midday, so adding or subtracting a day can never cross a DST edge. */
const noon = (offsetDays: number) =>
  new Date(2026, 0, 10 + offsetDays, 12).getTime()

beforeEach(() => {
  resetProgression()
})

describe("advanceLesson", () => {
  it("stays put while any character of the lesson is unmastered", () => {
    const lesson = lessonAt("hiragana", 0)
    expect(
      advanceLesson("hiragana", mastered(lesson.ids.slice(0, -1)))
    ).toBeNull()
    expect(progressionStore.state.lessons.hiragana).toBe(0)
  })

  it("unlocks the next lesson once the current one is fully mastered", () => {
    const unlocked = advanceLesson(
      "hiragana",
      mastered(lessonAt("hiragana", 0).ids),
      0,
      5000
    )

    expect(unlocked).toBe(TRACKS.hiragana[1]?.id)
    expect(progressionStore.state.lessons.hiragana).toBe(1)
    expect(progressionStore.state.unlockedAt["hiragana:1"]).toBe(5000)
  })

  it("only unlocks one lesson at a time, even with later ones already learned", () => {
    const stats = {
      ...mastered(lessonAt("hiragana", 0).ids),
      ...mastered(lessonAt("hiragana", 1).ids),
      ...mastered(lessonAt("hiragana", 2).ids),
    }

    expect(advanceLesson("hiragana", stats)).toBe(TRACKS.hiragana[1]?.id)
    expect(progressionStore.state.lessons.hiragana).toBe(1)
  })

  it("advances the two syllabaries independently", () => {
    advanceLesson("katakana", mastered(lessonAt("katakana", 0).ids))

    expect(progressionStore.state.lessons.katakana).toBe(1)
    expect(progressionStore.state.lessons.hiragana).toBe(0)
  })

  it("does not advance a track on the other track's mastery", () => {
    expect(
      advanceLesson("katakana", mastered(lessonAt("hiragana", 0).ids))
    ).toBeNull()
  })

  it("unlocks on fewer repetitions when the section's own streak vouches for them", () => {
    const lesson = lessonAt("katakana", 0)
    const seen = clean(lesson.ids, 3)

    // Three clean sightings each: short of the cold bar, enough once the user
    // has read the whole section faultlessly three times over.
    expect(advanceLesson("katakana", seen)).toBeNull()
    expect(
      advanceLesson("katakana", seen, lesson.ids.length * PASSES_FULL)
    ).toBe(TRACKS.katakana[1]?.id)
  })

  it("never unlocks a lesson the user is actually missing, streak or not", () => {
    const lesson = lessonAt("katakana", 0)
    const shaky = Object.fromEntries(
      lesson.ids.map((id) => [
        id,
        { ...emptyCharStat(), attempts: 10, correct: 6 },
      ])
    )

    expect(
      advanceLesson("katakana", shaky, lesson.ids.length * PASSES_FULL * 4)
    ).toBeNull()
    expect(progressionStore.state.lessons.katakana).toBe(0)
  })
})

describe("touchDay", () => {
  it("starts a streak on the first day of practice", () => {
    expect(touchDay(noon(0))).toEqual({ streak: 1, isNew: true })
    expect(progressionStore.state.day.last).toBe(dayKey(noon(0)))
  })

  it("does not count a second session on the same day", () => {
    touchDay(noon(0))
    expect(touchDay(noon(0) + 3 * 60 * 60 * 1000)).toEqual({
      streak: 1,
      isNew: false,
    })
  })

  it("extends the streak on consecutive days", () => {
    touchDay(noon(0))
    touchDay(noon(1))
    expect(touchDay(noon(2)).streak).toBe(3)
    expect(progressionStore.state.day.best).toBe(3)
  })

  it("restarts the streak after a missed day but keeps the record", () => {
    touchDay(noon(0))
    touchDay(noon(1))
    expect(touchDay(noon(0) + 3 * DAY).streak).toBe(1)
    expect(progressionStore.state.day.best).toBe(2)
  })
})

describe("records", () => {
  it("keeps the best session streak", () => {
    recordSessionResult({ attempts: 20, correct: 18, bestStreak: 7 })
    recordSessionResult({ attempts: 20, correct: 20, bestStreak: 3 })
    expect(progressionStore.state.records.bestSessionStreak).toBe(7)
  })

  it("ignores the accuracy of a session too short to mean anything", () => {
    recordSessionResult({ attempts: 2, correct: 2, bestStreak: 2 })
    expect(progressionStore.state.records.bestAccuracy).toBe(0)
  })
})

describe("setLesson", () => {
  it("clamps manual jumps to the track and leaves the other alone", () => {
    setLesson("hiragana", -5)
    expect(progressionStore.state.lessons.hiragana).toBe(0)

    setLesson("hiragana", 9999)
    expect(progressionStore.state.lessons.hiragana).toBe(
      TRACKS.hiragana.length - 1
    )
    expect(progressionStore.state.lessons.katakana).toBe(0)
  })
})
