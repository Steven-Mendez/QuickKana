import { describe, expect, it } from "vitest"
import { MIN_READ_SEEN, charReady, lessonNeeds } from "@/lib/gate"
import { lessonAt } from "@/lib/journey"
import { emptyCharStat } from "@/lib/scheduler"
import { emptyWriteCharStat } from "@/lib/writing"
import { DEFAULT_SETTINGS } from "@/stores/settings.store"
import type { CharStat, Settings, WriteCharStat } from "@/lib/types"

const LESSON = lessonAt("hiragana", 0)

const settings = (patch: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  practiceReading: true,
  practiceWriting: true,
  ...patch,
})

const read = (attempts: number): CharStat => ({
  ...emptyCharStat(),
  attempts,
  correct: attempts,
})

const written = (patch: Partial<WriteCharStat>): WriteCharStat => ({
  ...emptyWriteCharStat(),
  ...patch,
})

const readAll = (attempts: number): Record<string, CharStat> =>
  Object.fromEntries(LESSON.ids.map((id) => [id, read(attempts)]))

const writtenAll = (
  patch: Partial<WriteCharStat>
): Record<string, WriteCharStat> =>
  Object.fromEntries(LESSON.ids.map((id) => [id, written(patch)]))

describe("lessonNeeds", () => {
  it("owes both exercises on an untouched lesson", () => {
    const needs = lessonNeeds(LESSON, {}, {}, settings())
    expect(needs.read).toEqual(LESSON.ids)
    expect(needs.write).toEqual(LESSON.ids)
  })

  it("clears reading at the exposure floor and keeps owing the writing", () => {
    const needs = lessonNeeds(LESSON, readAll(MIN_READ_SEEN), {}, settings())
    expect(needs.read).toEqual([])
    expect(needs.write).toEqual(LESSON.ids)
  })

  it("is not satisfied by tracing — only by a write from memory", () => {
    const traced = lessonNeeds(
      LESSON,
      readAll(MIN_READ_SEEN),
      writtenAll({ attempts: 4, correct: 4, memoryCorrect: 0 }),
      settings()
    )
    expect(traced.write).toEqual(LESSON.ids)

    const fromMemory = lessonNeeds(
      LESSON,
      readAll(MIN_READ_SEEN),
      writtenAll({ attempts: 4, correct: 4, memoryCorrect: 1 }),
      settings()
    )
    expect(fromMemory.write).toEqual([])
  })

  it("accepts a clean guided write when the outline is forced on", () => {
    const needs = lessonNeeds(
      LESSON,
      readAll(MIN_READ_SEEN),
      writtenAll({ attempts: 2, correct: 2, memoryCorrect: 0 }),
      settings({ writeAlwaysOutline: true })
    )
    expect(needs.write).toEqual([])
  })

  it("names only the characters still owing, not the whole lesson", () => {
    const stats = writtenAll({ attempts: 4, correct: 4, memoryCorrect: 1 })
    const stuck = LESSON.ids[2] as string
    stats[stuck] = written({ attempts: 4, correct: 4, memoryCorrect: 0 })

    const needs = lessonNeeds(LESSON, readAll(MIN_READ_SEEN), stats, settings())
    expect(needs.write).toEqual([stuck])
  })

  it("owes nothing at all when either exercise is switched off", () => {
    for (const off of [
      { practiceWriting: false },
      { practiceReading: false },
    ]) {
      const needs = lessonNeeds(LESSON, {}, {}, settings(off))
      expect(needs).toEqual({ read: [], write: [] })
    }
  })
})

describe("charReady", () => {
  const id = LESSON.ids[0] as string

  it("agrees with lessonNeeds on every character", () => {
    const readStats = readAll(MIN_READ_SEEN)
    const writeStats = writtenAll({ memoryCorrect: 1, attempts: 3, correct: 3 })
    const stuck = LESSON.ids[1] as string
    writeStats[stuck] = written({ attempts: 3, correct: 3, memoryCorrect: 0 })
    const config = settings()

    const needs = lessonNeeds(LESSON, readStats, writeStats, config)
    for (const each of LESSON.ids) {
      const owing = needs.read.includes(each) || needs.write.includes(each)
      expect(charReady(each, readStats, writeStats, config)).toBe(!owing)
    }
  })

  it("holds a character back below the read floor even once it is written", () => {
    expect(
      charReady(
        id,
        { [id]: read(MIN_READ_SEEN - 1) },
        { [id]: written({ attempts: 3, correct: 3, memoryCorrect: 1 }) },
        settings()
      )
    ).toBe(false)
  })

  it("waves everything through when a single exercise type is on", () => {
    expect(charReady(id, {}, {}, settings({ practiceWriting: false }))).toBe(
      true
    )
  })
})
