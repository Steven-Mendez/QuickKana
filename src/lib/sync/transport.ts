import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import type { InflightBatch } from "./types"

export type PushResult =
  | { ok: true; status: "applied" | "duplicate" }
  | { ok: false; reason: "network" | "auth" | "server" }

/**
 * Ships one batch to the sync_push RPC over raw fetch. Raw on purpose:
 * supabase-js can't set `keepalive`, and the pagehide flush needs it so the
 * request survives the tab closing. Retrying the same batchId is safe —
 * the RPC is idempotent per batch.
 */
export async function pushBatch(
  batch: InflightBatch,
  options: { keepalive?: boolean } = {}
): Promise<PushResult> {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, reason: "auth" }

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/sync_push`,
      {
        method: "POST",
        keepalive: options.keepalive ?? false,
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          batch_id: batch.batchId,
          events: batch.events,
          aggregates: batch.aggregates,
        }),
      }
    )
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: "auth" }
    }
    if (!response.ok) return { ok: false, reason: "server" }
    const body = (await response.json()) as { status?: string }
    return {
      ok: true,
      status: body.status === "duplicate" ? "duplicate" : "applied",
    }
  } catch {
    return { ok: false, reason: "network" }
  }
}
