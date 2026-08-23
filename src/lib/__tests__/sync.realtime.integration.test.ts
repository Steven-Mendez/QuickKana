// @vitest-environment node
/**
 * Realtime E2E against the LOCAL stack: a sync_push by one device raises a
 * postgres_changes event for another subscriber of the same account.
 * Runs in the node environment (jsdom's Event class breaks undici's
 * WebSocket) with a plain supabase-js client — the app's engine wires the
 * exact same channel/filter.
 *
 *   SUPABASE_IT=1 pnpm test sync.realtime
 */
import { describe, expect, it } from "vitest"
import { createClient } from "@supabase/supabase-js"

const RUN = process.env.SUPABASE_IT === "1"
const URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321"
const KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"

describe.runIf(RUN)("realtime sync (local stack)", () => {
  it("delivers another device's push as a change event", async () => {
    const supabase = createClient(URL, KEY, {
      auth: { persistSession: false },
    })
    const email = `rt-${Date.now().toString(36)}@test.local`
    const { data, error } = await supabase.auth.signUp({
      email,
      password: "secret123456",
    })
    if (error || !data.session || !data.user) throw new Error("signup failed")
    const { session, user } = data
    await supabase.realtime.setAuth(session.access_token)

    const event = new Promise<{ table: string }>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("no realtime event within 10s")),
        10_000
      )
      supabase
        .channel(`it:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "char_stats",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            clearTimeout(timeout)
            resolve(payload)
          }
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            // "Device B" pushes once we're listening.
            void fetch(`${URL}/rest/v1/rpc/sync_push`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: KEY,
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                batch_id: crypto.randomUUID(),
                events: [],
                aggregates: {
                  char_stats: [
                    {
                      kana: "hiragana:あ",
                      d_attempts: 1,
                      d_correct: 1,
                      d_total_ms: 500,
                      streak: 1,
                      best_streak: 1,
                      weight: 1,
                    },
                  ],
                },
              }),
            })
          }
          if (status === "CHANNEL_ERROR") {
            clearTimeout(timeout)
            reject(new Error("realtime channel error"))
          }
        })
    })

    await expect(event).resolves.toMatchObject({ table: "char_stats" })
    await supabase.removeAllChannels()
  }, 20_000)
})
