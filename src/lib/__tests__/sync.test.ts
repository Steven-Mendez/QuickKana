import { beforeEach, describe, expect, it } from "vitest"
import {
  clearQueue,
  collectReadingAnswer,
  collectSessionEnd,
  collectWriteAnswer,
  queueStore,
  setQueueUser,
} from "@/lib/sync/queue"
import { buildAggregates } from "@/lib/sync/batch"
import { buildSnapshot } from "@/lib/sync/import"
import { emptyPending, hasPendingData } from "@/lib/sync/types"
import {
  emptyProgress,
  progressStore,
  recordAnswer,
} from "@/stores/progress.store"
import { DEFAULT_SETTINGS } from "@/stores/settings.store"

const answer = (
  over: Partial<Parameters<typeof collectReadingAnswer>[0]> = {}
) => ({
  kanaId: "hiragana:つ",
  expected: "tsu",
  typed: "shi",
  correct: false,
  confusedWith: "hiragana:し",
  ms: 1200,
  sessionId: "s-test",
  ...over,
})

describe("sync queue", () => {
  beforeEach(() => {
    setQueueUser("user-1")
    clearQueue()
    progressStore.setState(() => emptyProgress())
  })

  it("collects nothing while signed out", () => {
    setQueueUser(null)
    collectReadingAnswer(answer())
    expect(hasPendingData(queueStore.state.pending)).toBe(false)
  })

  it("accumulates deltas and canonicalizes confusion pairs", () => {
    collectReadingAnswer(answer())
    // Opposite direction of the same confusion: same canonical pair.
    collectReadingAnswer(
      answer({
        kanaId: "hiragana:し",
        expected: "shi",
        typed: "tsu",
        confusedWith: "hiragana:つ",
      })
    )
    collectReadingAnswer(
      answer({ correct: true, confusedWith: null, typed: "tsu" })
    )

    const pending = queueStore.state.pending
    expect(pending.events).toHaveLength(3)
    expect(pending.charStats["hiragana:つ"]).toEqual({
      d_attempts: 2,
      d_correct: 1,
      d_total_ms: 2400,
    })
    expect(Object.keys(pending.confusionPairs)).toEqual([
      "hiragana:し|hiragana:つ",
    ])
    expect(pending.confusionPairs["hiragana:し|hiragana:つ"]?.d_count).toBe(2)
  })

  it("keeps typos out of the confusion pairs", () => {
    collectReadingAnswer(
      answer({ confusedWith: null, typed: "zzz", correct: false })
    )
    const pending = queueStore.state.pending
    expect(Object.keys(pending.confusionPairs)).toHaveLength(0)
    expect(pending.typos["hiragana:つ\nzzz"]).toBe(1)
    expect(pending.events[0]?.is_typo).toBe(true)
  })

  it("counts sessions per modality", () => {
    collectSessionEnd("reading")
    collectSessionEnd("writing")
    collectSessionEnd("reading")
    expect(queueStore.state.pending.dReadingSessions).toBe(2)
    expect(queueStore.state.pending.dWritingSessions).toBe(1)
  })

  it("drops the queue when a different user signs in", () => {
    collectReadingAnswer(answer())
    expect(hasPendingData(queueStore.state.pending)).toBe(true)
    setQueueUser("user-2")
    expect(hasPendingData(queueStore.state.pending)).toBe(false)
    expect(queueStore.state.userId).toBe("user-2")
  })

  it("keeps the queue when the same user signs back in", () => {
    collectReadingAnswer(answer())
    setQueueUser(null)
    setQueueUser("user-1")
    expect(queueStore.state.pending.events).toHaveLength(1)
  })

  it("collects writing attempts with stroke payload", () => {
    collectWriteAnswer({
      kanaId: "katakana:ア",
      expected: "a",
      correct: true,
      mistakes: 0,
      assisted: false,
      outline: false,
      skipped: false,
      fromMemory: true,
      ms: 4000,
      sessionId: "s-test",
    })
    const pending = queueStore.state.pending
    expect(pending.writingCharStats["katakana:ア"]).toEqual({
      d_attempts: 1,
      d_correct: 1,
      d_total_ms: 4000,
      d_stroke_mistakes: 0,
      d_memory_correct: 1,
    })
    expect(pending.events[0]?.modality).toBe("writing")
    expect(pending.events[0]?.syllabary).toBe("katakana")
    expect(pending.events[0]?.payload).toMatchObject({ from_memory: true })
  })
})

describe("buildAggregates", () => {
  beforeEach(() => {
    setQueueUser("user-1")
    clearQueue()
    progressStore.setState(() => emptyProgress())
  })

  it("ships deltas plus point-in-time values from the store", () => {
    // Route a real answer through the store so weight/streak exist.
    recordAnswer(
      {
        kanaId: "hiragana:つ",
        expected: "tsu",
        typed: "tsu",
        correct: true,
        confusedWith: null,
        ms: 900,
        sessionId: "s-test",
      },
      DEFAULT_SETTINGS
    )

    const aggregates = buildAggregates(queueStore.state.pending) as {
      char_stats: Array<Record<string, unknown>>
    }
    expect(aggregates.char_stats).toHaveLength(1)
    const stat = aggregates.char_stats[0]!
    expect(stat.kana).toBe("hiragana:つ")
    expect(stat.d_attempts).toBe(1)
    expect(stat.d_correct).toBe(1)
    expect(stat.streak).toBe(1)
    expect(stat.weight).toBe(
      progressStore.state.charStats["hiragana:つ"]!.weight
    )
  })

  it("emits nothing for an empty pending state", () => {
    expect(buildAggregates(emptyPending())).toEqual({})
  })
})

describe("buildSnapshot", () => {
  it("folds the directional matrix into canonical pairs", () => {
    progressStore.setState(() => ({
      ...emptyProgress(),
      matrix: {
        "hiragana:つ": { "hiragana:し": 2 },
        "hiragana:し": { "hiragana:つ": 3 },
      },
    }))
    const snapshot = buildSnapshot() as {
      confusion_pairs: Array<{ kana_a: string; kana_b: string; count: number }>
    }
    expect(snapshot.confusion_pairs).toEqual([
      {
        kana_a: "hiragana:し",
        kana_b: "hiragana:つ",
        count: 5,
        last_at: expect.any(String),
      },
    ])
  })
})
