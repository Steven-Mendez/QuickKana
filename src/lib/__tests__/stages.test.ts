import { describe, expect, it } from "vitest"
import { STAGE_EXERCISES, isNarrowStage, lessonStage } from "@/lib/stages"
import { FAMILIARITY_ATTEMPTS, lessonAt } from "@/lib/journey"
import { GUIDED_COMPLETIONS, emptyWriteCharStat } from "@/lib/writing"
import { emptyCharStat } from "@/lib/scheduler"
import { DEFAULT_SETTINGS } from "@/stores/settings.store"
import type { CharStat, Settings, WriteCharStat } from "@/lib/types"

const LESSON = lessonAt("hiragana", 0)

const settings = (patch: Partial<Settings> = {}): Settings => ({
  ...DEFAULT_SETTINGS,
  practiceReading: true,
  practiceWriting: true,
  ...patch,
})

const readAll = (attempts: number): Record<string, CharStat> =>
  Object.fromEntries(
    LESSON.ids.map((id) => [
      id,
      { ...emptyCharStat(), attempts, correct: attempts },
    ])
  )

const writeAll = (
  patch: Partial<WriteCharStat>
): Record<string, WriteCharStat> =>
  Object.fromEntries(
    LESSON.ids.map((id) => [id, { ...emptyWriteCharStat(), ...patch }])
  )

/** Read enough to be recognized, traced enough to retire the guide. */
const recognized = readAll(FAMILIARITY_ATTEMPTS)
const traced = writeAll({
  attempts: GUIDED_COMPLETIONS,
  correct: GUIDED_COMPLETIONS,
})

describe("lessonStage", () => {
  it("starts on reading, with every character waiting", () => {
    const state = lessonStage(LESSON, {}, {}, settings())
    expect(state.stage).toBe("read")
    expect(state.pending).toEqual(LESSON.ids)
  })

  it("stays on reading while any character is still unrecognized", () => {
    const stats = readAll(FAMILIARITY_ATTEMPTS)
    const cold = LESSON.ids[3] as string
    stats[cold] = { ...emptyCharStat(), attempts: 1, correct: 1 }

    const state = lessonStage(LESSON, stats, {}, settings())
    expect(state.stage).toBe("read")
    expect(state.pending).toEqual([cold])
  })

  it("moves to tracing once the section is recognized", () => {
    const state = lessonStage(LESSON, recognized, {}, settings())
    expect(state.stage).toBe("trace")
    expect(state.pending).toEqual(LESSON.ids)
  })

  it("moves to recall when the guide has been retired", () => {
    const state = lessonStage(LESSON, recognized, traced, settings())
    expect(state.stage).toBe("recall")
    // Traced, never written from memory: that is exactly what recall is for.
    expect(state.pending).toEqual(LESSON.ids)
  })

  it("narrows recall to the characters still owing a write from memory", () => {
    const stats = writeAll({ attempts: 3, correct: 3, memoryCorrect: 1 })
    const stuck = LESSON.ids[1] as string
    stats[stuck] = { ...emptyWriteCharStat(), attempts: 3, correct: 3 }

    const state = lessonStage(LESSON, recognized, stats, settings())
    expect(state.stage).toBe("recall")
    expect(state.pending).toEqual([stuck])
  })

  it("reaches review once the section owes nothing", () => {
    const done = writeAll({ attempts: 3, correct: 3, memoryCorrect: 1 })
    const state = lessonStage(LESSON, recognized, done, settings())
    expect(state.stage).toBe("review")
    expect(state.pending).toEqual([])
  })

  it("drops back to the stage that fixes a section that collapsed", () => {
    const done = writeAll({ attempts: 3, correct: 3, memoryCorrect: 1 })
    const rusty = { ...recognized }
    rusty[LESSON.ids[0] as string] = {
      ...emptyCharStat(),
      attempts: 10,
      correct: 3,
    }

    const state = lessonStage(LESSON, rusty, done, settings())
    expect(state.stage).toBe("read")
    expect(state.pending).toEqual([LESSON.ids[0]])
  })

  it("skips the writing stages when writing is off", () => {
    const state = lessonStage(
      LESSON,
      recognized,
      {},
      settings({ practiceWriting: false })
    )
    expect(state.stage).toBe("review")
  })

  it("skips the reading stage when reading is off", () => {
    const state = lessonStage(
      LESSON,
      {},
      {},
      settings({ practiceReading: false })
    )
    expect(state.stage).toBe("trace")
  })
})

describe("stage rules", () => {
  it("serves one exercise while introducing, both once they mix", () => {
    expect(STAGE_EXERCISES.read).toEqual(["read"])
    expect(STAGE_EXERCISES.trace).toEqual(["write"])
    expect(STAGE_EXERCISES.recall).toEqual(["read", "write"])
    expect(STAGE_EXERCISES.review).toEqual(["read", "write"])
  })

  it("holds review back only while the section is being introduced", () => {
    expect(isNarrowStage("read")).toBe(true)
    expect(isNarrowStage("trace")).toBe(true)
    expect(isNarrowStage("recall")).toBe(false)
    expect(isNarrowStage("review")).toBe(false)
  })
})
