import { createStore } from "@tanstack/store"
import { STORAGE_KEYS, loadPersisted, persist } from "@/lib/storage"
import { emptyPending } from "./types"
import type {
  AttemptEvent,
  QueueState,
  StatDelta,
  WriteStatDelta,
} from "./types"

/**
 * The persisted outbox. Guests never write here — their progress enters the
 * server through the one-shot import instead — so everything queued belongs
 * to `userId` and a different account signing in drops it wholesale.
 */

// Offline for weeks shouldn't grow storage without bound. Beyond the cap the
// oldest *events* are dropped; the aggregate deltas keep every count, so no
// progress is lost — only per-attempt history granularity.
const EVENT_CAP = 2000

const isQueue = (value: unknown): value is QueueState =>
  typeof value === "object" &&
  value !== null &&
  (value as { version?: unknown }).version === 1

const emptyQueue = (): QueueState => ({
  version: 1,
  userId: null,
  pending: emptyPending(),
  inflight: null,
})

export const queueStore = createStore<QueueState>(
  loadPersisted<QueueState>(STORAGE_KEYS.syncQueue, emptyQueue(), isQueue)
)

persist(queueStore, STORAGE_KEYS.syncQueue, 400)

/** While a pull is replacing local stores, their subscriptions must not
 * mark anything dirty — the data just came *from* the server. */
export let applyingRemote = false
export const setApplyingRemote = (value: boolean) => {
  applyingRemote = value
}

let activeUserId: string | null = null

/** Called by the engine on sign-in/sign-out. Collection is a no-op while
 * signed out; a different user's leftovers are discarded. */
export function setQueueUser(userId: string | null): void {
  activeUserId = userId
  queueStore.setState((prev) => {
    if (userId === null) return prev
    if (prev.userId === userId) return prev
    return { ...emptyQueue(), userId }
  })
}

export const isCollecting = (): boolean =>
  activeUserId !== null && !applyingRemote

const canonicalPair = (a: string, b: string): string =>
  a < b ? `${a}|${b}` : `${b}|${a}`

export interface ReadingAnswerInput {
  kanaId: string
  expected: string
  typed: string
  correct: boolean
  confusedWith: string | null
  ms: number
  sessionId: string
}

export function collectReadingAnswer(
  input: ReadingAnswerInput,
  now = Date.now()
): void {
  if (!isCollecting()) return
  const isTypo = !input.correct && !input.confusedWith && input.typed !== ""
  const iso = new Date(now).toISOString()

  const event: AttemptEvent = {
    id: crypto.randomUUID(),
    modality: "reading",
    syllabary: input.kanaId.startsWith("katakana") ? "katakana" : "hiragana",
    kana: input.kanaId,
    expected: input.expected,
    answer: input.typed,
    is_correct: input.correct,
    confused_with: input.confusedWith,
    is_typo: isTypo,
    response_ms: Math.round(input.ms),
    session_id: input.sessionId,
    payload: null,
    client_created_at: iso,
  }

  queueStore.setState((prev) => {
    const pending = prev.pending
    const stat: StatDelta = pending.charStats[input.kanaId] ?? {
      d_attempts: 0,
      d_correct: 0,
      d_total_ms: 0,
    }
    const next = {
      ...pending,
      events: [...pending.events, event].slice(-EVENT_CAP),
      charStats: {
        ...pending.charStats,
        [input.kanaId]: {
          d_attempts: stat.d_attempts + 1,
          d_correct: stat.d_correct + (input.correct ? 1 : 0),
          d_total_ms: stat.d_total_ms + Math.round(input.ms),
        },
      },
      // Any answer can activate, advance or graduate a group.
      groupsDirty: true,
    }

    if (input.confusedWith) {
      const key = canonicalPair(input.kanaId, input.confusedWith)
      const pair = pending.confusionPairs[key] ?? { d_count: 0, last_at: iso }
      next.confusionPairs = {
        ...pending.confusionPairs,
        [key]: { d_count: pair.d_count + 1, last_at: iso },
      }
    } else if (isTypo) {
      const key = `${input.kanaId}\n${input.typed}`
      next.typos = {
        ...pending.typos,
        [key]: (pending.typos[key] ?? 0) + 1,
      }
    }

    return { ...prev, pending: next }
  })
}

export interface WriteAnswerCollectInput {
  kanaId: string
  expected: string
  correct: boolean
  mistakes: number
  assisted: boolean
  outline: boolean
  skipped: boolean
  fromMemory: boolean
  ms: number
  sessionId: string
}

export function collectWriteAnswer(
  input: WriteAnswerCollectInput,
  now = Date.now()
): void {
  if (!isCollecting()) return

  const event: AttemptEvent = {
    id: crypto.randomUUID(),
    modality: "writing",
    syllabary: input.kanaId.startsWith("katakana") ? "katakana" : "hiragana",
    kana: input.kanaId,
    expected: input.expected,
    answer: "",
    is_correct: input.correct,
    confused_with: null,
    is_typo: false,
    response_ms: Math.round(input.ms),
    session_id: input.sessionId,
    payload: {
      mistakes: input.mistakes,
      assisted: input.assisted,
      outline: input.outline,
      skipped: input.skipped,
      from_memory: input.fromMemory,
    },
    client_created_at: new Date(now).toISOString(),
  }

  queueStore.setState((prev) => {
    const pending = prev.pending
    const stat: WriteStatDelta = pending.writingCharStats[input.kanaId] ?? {
      d_attempts: 0,
      d_correct: 0,
      d_total_ms: 0,
      d_stroke_mistakes: 0,
      d_memory_correct: 0,
    }
    return {
      ...prev,
      pending: {
        ...pending,
        events: [...pending.events, event].slice(-EVENT_CAP),
        writingCharStats: {
          ...pending.writingCharStats,
          [input.kanaId]: {
            d_attempts: stat.d_attempts + 1,
            d_correct: stat.d_correct + (input.correct ? 1 : 0),
            d_total_ms: stat.d_total_ms + Math.round(input.ms),
            d_stroke_mistakes:
              stat.d_stroke_mistakes + (input.skipped ? 0 : input.mistakes),
            d_memory_correct:
              stat.d_memory_correct + (input.fromMemory ? 1 : 0),
          },
        },
      },
    }
  })
}

export function collectSessionEnd(modality: "reading" | "writing"): void {
  if (!isCollecting()) return
  queueStore.setState((prev) => ({
    ...prev,
    pending: {
      ...prev.pending,
      dReadingSessions:
        prev.pending.dReadingSessions + (modality === "reading" ? 1 : 0),
      dWritingSessions:
        prev.pending.dWritingSessions + (modality === "writing" ? 1 : 0),
    },
  }))
}

export function markDirty(
  key: "progressionDirty" | "settingsDirty" | "groupsDirty"
): void {
  if (!isCollecting()) return
  queueStore.setState((prev) =>
    prev.pending[key]
      ? prev
      : { ...prev, pending: { ...prev.pending, [key]: true } }
  )
}

export function clearQueue(): void {
  queueStore.setState((prev) => ({
    ...emptyQueue(),
    userId: prev.userId,
  }))
}
