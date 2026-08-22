import { createStore } from "@tanstack/store"
import { STORAGE_KEYS, loadPersisted, persist } from "@/lib/storage"
import {
  applyWriteAttempt,
  emptyWriteCharStat,
  scoreWriteAttempt,
} from "@/lib/writing"
import type { WriteAttempt } from "@/lib/writing"
import type { ProgressState, WriteCharStat, WritingState } from "@/lib/types"

/**
 * The Write mode's persisted progress. Deliberately its own store under its
 * own key: reading progress is never touched, so existing users upgrade
 * without any migration — this key simply starts empty.
 */
export const emptyWriting = (): WritingState => ({
  version: 1,
  charStats: {},
  totals: { attempts: 0, correct: 0, sessions: 0, totalMs: 0 },
})

const isWriting = (value: unknown): value is WritingState =>
  typeof value === "object" &&
  value !== null &&
  (value as { version?: unknown }).version === 1

const stored = loadPersisted<Partial<WritingState>>(
  STORAGE_KEYS.writing,
  emptyWriting(),
  isWriting
)

// Merged over the defaults so a field added in a later version simply appears
// with its default instead of coming back `undefined` — including fields
// added to the per-character stats, which are backfilled one by one.
export const writingStore = createStore<WritingState>({
  ...emptyWriting(),
  ...stored,
  charStats: Object.fromEntries(
    Object.entries(stored.charStats ?? {}).map(([id, stat]) => [
      id,
      // A stat saved by an older build may miss recently added fields.
      { ...emptyWriteCharStat(), ...(stat as Partial<WriteCharStat>) },
    ])
  ),
  totals: { ...emptyWriting().totals, ...stored.totals },
})

// Written on every completed character, so the writes are debounced.
persist(writingStore, STORAGE_KEYS.writing, 400)

export interface WriteAnswerInput extends WriteAttempt {
  kanaId: string
  ms: number
}

/** Commits one Write attempt. Returns whether it counted as correct. */
export function recordWriteAnswer(
  input: WriteAnswerInput,
  now = Date.now()
): boolean {
  const outcome = scoreWriteAttempt(input)

  writingStore.setState((prev) => ({
    ...prev,
    charStats: {
      ...prev.charStats,
      [input.kanaId]: applyWriteAttempt(
        prev.charStats[input.kanaId] ?? emptyWriteCharStat(),
        input,
        input.ms,
        now
      ),
    },
    totals: {
      ...prev.totals,
      attempts: prev.totals.attempts + 1,
      correct: prev.totals.correct + (outcome.correct ? 1 : 0),
      totalMs: prev.totals.totalMs + input.ms,
    },
  }))

  return outcome.correct
}

export const countWriteSession = () =>
  writingStore.setState((prev) => ({
    ...prev,
    totals: { ...prev.totals, sessions: prev.totals.sessions + 1 },
  }))

export const resetWriting = () => writingStore.setState(() => emptyWriting())

/**
 * The writing stats dressed as a `ProgressState`, which is all the scheduler
 * needs to reuse its per-character weighting unchanged. Groups stay empty on
 * purpose: confusion pairing is a reading concept — mixing up two similar
 * shapes while *typing* says nothing about drawing them — so the Write drill
 * never serves bursts.
 */
export const writingAsProgress = (state: WritingState): ProgressState => ({
  version: 1,
  charStats: state.charStats,
  matrix: {},
  typos: {},
  groups: {},
  totals: state.totals,
})
