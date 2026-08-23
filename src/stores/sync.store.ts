import { createStore } from "@tanstack/store"

export type SyncStatus =
  /** No session: everything is local, nothing to sync. */
  | "guest"
  /** Import/pull or a flush is in progress. */
  | "syncing"
  /** Everything acked by the server. */
  | "synced"
  /** Data waiting in the outbox. */
  | "pending"
  /** Offline with data waiting. */
  | "offline"
  /** Last operation failed; will retry with backoff. */
  | "error"

export interface SyncState {
  status: SyncStatus
  pendingCount: number
  lastSyncAt: number | null
}

export const syncStore = createStore<SyncState>({
  status: "guest",
  pendingCount: 0,
  lastSyncAt: null,
})
