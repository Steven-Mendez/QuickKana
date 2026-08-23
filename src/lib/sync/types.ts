/** Shapes shared by the sync queue, batch builder and transport. */

export interface AttemptEvent {
  id: string
  modality: "reading" | "writing"
  syllabary: "hiragana" | "katakana"
  kana: string
  expected: string
  answer: string
  is_correct: boolean
  confused_with: string | null
  is_typo: boolean
  response_ms: number
  session_id: string
  payload: Record<string, unknown> | null
  client_created_at: string
}

export interface StatDelta {
  d_attempts: number
  d_correct: number
  d_total_ms: number
}

export interface WriteStatDelta extends StatDelta {
  d_stroke_mistakes: number
  d_memory_correct: number
}

/**
 * Everything accumulated since the last acked push. Counters are deltas —
 * the server adds them — while point-in-time values (weight, streak) are
 * snapshotted from the stores at batch-build time.
 */
export interface PendingState {
  events: Array<AttemptEvent>
  charStats: Record<string, StatDelta>
  writingCharStats: Record<string, WriteStatDelta>
  /** canonical `${a}|${b}` (a < b) → delta. */
  confusionPairs: Record<string, { d_count: number; last_at: string }>
  /** `${kana}\n${typed}` → delta. */
  typos: Record<string, number>
  dReadingSessions: number
  dWritingSessions: number
  groupsDirty: boolean
  progressionDirty: boolean
  settingsDirty: boolean
}

/** A batch that was built and sent but not yet acknowledged. Retried with
 * the same id until the server answers `applied` or `duplicate`. */
export interface InflightBatch {
  batchId: string
  events: Array<AttemptEvent>
  aggregates: Record<string, unknown>
}

export interface QueueState {
  version: 1
  /** Owner account; a different signed-in user drops the queue. */
  userId: string | null
  pending: PendingState
  inflight: InflightBatch | null
}

export const emptyPending = (): PendingState => ({
  events: [],
  charStats: {},
  writingCharStats: {},
  confusionPairs: {},
  typos: {},
  dReadingSessions: 0,
  dWritingSessions: 0,
  groupsDirty: false,
  progressionDirty: false,
  settingsDirty: false,
})

export const hasPendingData = (pending: PendingState): boolean =>
  pending.events.length > 0 ||
  Object.keys(pending.charStats).length > 0 ||
  Object.keys(pending.writingCharStats).length > 0 ||
  Object.keys(pending.confusionPairs).length > 0 ||
  Object.keys(pending.typos).length > 0 ||
  pending.dReadingSessions > 0 ||
  pending.dWritingSessions > 0 ||
  pending.groupsDirty ||
  pending.progressionDirty ||
  pending.settingsDirty
