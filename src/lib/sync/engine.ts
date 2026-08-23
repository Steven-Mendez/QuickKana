import { authStore } from "@/stores/auth.store"
import { progressionStore } from "@/stores/progression.store"
import { settingsStore } from "@/stores/settings.store"
import { selectionStore } from "@/stores/selection.store"
import { syncStore } from "@/stores/sync.store"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { buildAggregates } from "./batch"
import { importLocalSnapshot } from "./import"
import { pullAll } from "./pull"
import { clearQueue, markDirty, queueStore, setQueueUser } from "./queue"
import { pushBatch } from "./transport"
import { emptyPending, hasPendingData } from "./types"

const FLUSH_INTERVAL_MS = 10_000
const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60_000
const REALTIME_PULL_DEBOUNCE_MS = 2_000

let started = false
let timer: ReturnType<typeof setInterval> | null = null
let flushing = false
let failures = 0
let nextAttemptAt = 0
let onboardedUserId: string | null = null
let realtimeChannel: { unsubscribe: () => unknown } | null = null
let realtimePullTimer: ReturnType<typeof setTimeout> | null = null

function updateStatus(partial?: { syncing?: boolean; error?: boolean }): void {
  const { pending, inflight } = queueStore.state
  const waiting = hasPendingData(pending) || inflight !== null
  const pendingCount = pending.events.length + (inflight?.events.length ?? 0)

  syncStore.setState((prev) => ({
    ...prev,
    pendingCount,
    status: partial?.syncing
      ? "syncing"
      : partial?.error
        ? "error"
        : !navigator.onLine && waiting
          ? "offline"
          : waiting
            ? "pending"
            : "synced",
  }))
}

/**
 * Pushes the outbox: first the inflight batch (same id — the server dedupes
 * replays), then the accumulated pending data as a fresh batch. Called on an
 * interval, on `online`, when the tab hides (with keepalive) and manually.
 */
export async function flushNow(
  options: { keepalive?: boolean; force?: boolean } = {}
): Promise<void> {
  if (flushing || authStore.state.status !== "signedIn") return
  if (!options.force && Date.now() < nextAttemptAt) return
  flushing = true

  try {
    // Re-send a batch the server may or may not have seen.
    let inflight = queueStore.state.inflight
    if (inflight) {
      const result = await pushBatch(inflight, options)
      if (!result.ok) {
        registerFailure()
        return
      }
      queueStore.setState((prev) => ({ ...prev, inflight: null }))
    }

    // Promote pending → inflight under a new batch id, then send.
    if (hasPendingData(queueStore.state.pending)) {
      queueStore.setState((prev) => ({
        ...prev,
        pending: emptyPending(),
        inflight: {
          batchId: crypto.randomUUID(),
          events: prev.pending.events,
          aggregates: buildAggregates(prev.pending),
        },
      }))
      inflight = queueStore.state.inflight
      if (inflight) {
        const result = await pushBatch(inflight, options)
        if (!result.ok) {
          registerFailure()
          return
        }
        queueStore.setState((prev) => ({ ...prev, inflight: null }))
      }
    }

    failures = 0
    nextAttemptAt = 0
    syncStore.setState((prev) => ({ ...prev, lastSyncAt: Date.now() }))
  } finally {
    flushing = false
    updateStatus()
  }
}

function registerFailure(): void {
  failures += 1
  nextAttemptAt =
    Date.now() + Math.min(BASE_BACKOFF_MS * 2 ** (failures - 1), MAX_BACKOFF_MS)
}

/** Import-if-first-login, then pull (server is the authority). */
async function onboard(userId: string): Promise<void> {
  if (onboardedUserId === userId) return
  syncStore.setState((prev) => ({ ...prev, status: "syncing" }))
  try {
    await importLocalSnapshot()
    await pullAll()
    onboardedUserId = userId
    syncStore.setState((prev) => ({ ...prev, lastSyncAt: Date.now() }))
    updateStatus()
    subscribeRealtime(userId)
  } catch {
    // Retried on the next tick; practicing meanwhile keeps queueing safely.
    registerFailure()
    updateStatus({ error: true })
  }
}

/**
 * Live multi-device updates: a change on any synced table (pushed by
 * another device — or by this one, which the debounce + idle check make a
 * cheap no-op) schedules a pull. The pull only runs while the outbox is
 * empty: replacing local state with the server's while answers are still
 * queued here would show the user a state that briefly forgets them.
 */
function subscribeRealtime(userId: string): void {
  if (realtimeChannel) return
  const supabase = getSupabaseBrowserClient()

  const schedulePull = () => {
    if (realtimePullTimer) clearTimeout(realtimePullTimer)
    realtimePullTimer = setTimeout(() => {
      realtimePullTimer = null
      const { pending, inflight } = queueStore.state
      if (hasPendingData(pending) || inflight) return
      pullAll()
        .then(() => updateStatus())
        .catch(() => undefined)
    }, REALTIME_PULL_DEBOUNCE_MS)
  }

  let channel = supabase.channel(`sync:${userId}`)
  for (const table of [
    "char_stats",
    "writing_char_stats",
    "confusion_groups",
    "progression",
    "user_settings",
  ]) {
    channel = channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
      schedulePull
    )
  }
  channel.subscribe()
  realtimeChannel = channel
}

function unsubscribeRealtime(): void {
  if (realtimePullTimer) {
    clearTimeout(realtimePullTimer)
    realtimePullTimer = null
  }
  if (realtimeChannel) {
    void realtimeChannel.unsubscribe()
    realtimeChannel = null
  }
}

function tick(): void {
  const { status, user } = authStore.state
  if (status !== "signedIn" || !user) return
  if (onboardedUserId !== user.id) {
    if (Date.now() >= nextAttemptAt) void onboard(user.id)
    return
  }
  void flushNow()
}

function handleAuthChange(): void {
  const { status, user } = authStore.state

  if (status === "signedIn" && user) {
    setQueueUser(user.id)
    void onboard(user.id)
    if (!timer) timer = setInterval(tick, FLUSH_INTERVAL_MS)
    return
  }

  if (status === "signedOut") {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    unsubscribeRealtime()
    // The queue is kept: it still belongs to the signed-out user and resumes
    // if they come back (a *different* user signing in drops it).
    setQueueUser(null)
    onboardedUserId = null
    syncStore.setState((prev) => ({
      ...prev,
      status: "guest",
      pendingCount: 0,
    }))
  }
}

/** Wires the sync engine to auth and the stores. Client-only, idempotent. */
export function startSyncEngine(): void {
  if (started || typeof window === "undefined") return
  started = true

  authStore.subscribe(handleAuthChange)
  handleAuthChange()

  // Low-frequency stores: any change marks the whole blob dirty; the next
  // flush ships a fresh snapshot (LWW server-side).
  progressionStore.subscribe(() => markDirty("progressionDirty"))
  settingsStore.subscribe(() => markDirty("settingsDirty"))
  selectionStore.subscribe(() => markDirty("settingsDirty"))

  window.addEventListener("online", () => {
    nextAttemptAt = 0
    void flushNow()
  })
  window.addEventListener("offline", () => updateStatus())
  // keepalive lets the request outlive the tab.
  window.addEventListener("pagehide", () => void flushNow({ keepalive: true }))
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      void flushNow({ keepalive: true })
    }
  })
}

/** Remote wipe for "delete everything" while signed in. */
export async function deleteRemoteData(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  clearQueue()
  const { error } = await supabase.rpc("delete_user_data")
  if (error) throw new Error(error.message)
  onboardedUserId = null // next onboard re-imports or pulls the empty state
  updateStatus()
}
