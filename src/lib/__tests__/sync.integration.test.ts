/**
 * End-to-end sync test against the LOCAL Supabase stack. Skipped unless
 * SUPABASE_IT=1 (needs `supabase start` running). Simulates two devices on
 * one account via vi.resetModules(): fresh module registry = fresh stores.
 *
 *   SUPABASE_IT=1 pnpm test sync.integration
 */
import { afterAll, describe, expect, it, vi } from "vitest"

const RUN = process.env.SUPABASE_IT === "1"
const EMAIL = `it-${Date.now().toString(36)}@test.local`
const PASSWORD = "secret123456"

/** Loads a fresh "device": clean localStorage + fresh module registry. */
async function bootDevice() {
  vi.resetModules()
  const progress = await import("@/stores/progress.store")
  const auth = await import("@/stores/auth.store")
  const queue = await import("@/lib/sync/queue")
  const engine = await import("@/lib/sync/engine")
  const importMod = await import("@/lib/sync/import")
  const pull = await import("@/lib/sync/pull")
  const client = await import("@/lib/supabase/client")
  const settings = await import("@/stores/settings.store")
  return { progress, auth, queue, engine, importMod, pull, client, settings }
}

type Device = Awaited<ReturnType<typeof bootDevice>>

async function signIn(device: Device, mode: "signUp" | "signIn") {
  const supabase = device.client.getSupabaseBrowserClient()
  const { data, error } =
    mode === "signUp"
      ? await supabase.auth.signUp({ email: EMAIL, password: PASSWORD })
      : await supabase.auth.signInWithPassword({
          email: EMAIL,
          password: PASSWORD,
        })
  if (error) throw new Error(error.message)
  const user = data.user
  if (!user) throw new Error("no user")
  device.auth.authStore.setState(() => ({ status: "signedIn", user }))
  device.queue.setQueueUser(user.id)
  return user
}

const readingAnswer = (
  device: Device,
  over: { correct?: boolean; confusedWith?: string | null } = {}
) =>
  device.progress.recordAnswer(
    {
      kanaId: "hiragana:つ",
      expected: "tsu",
      typed: over.correct === false ? "shi" : "tsu",
      correct: over.correct ?? true,
      confusedWith: over.confusedWith ?? null,
      ms: 800,
      sessionId: "s-it",
    },
    device.settings.DEFAULT_SETTINGS
  )

describe.runIf(RUN)("sync end-to-end (local stack)", () => {
  afterAll(() => {
    localStorage.clear()
  })

  it("imports once, pulls, and never double-counts across devices", async () => {
    // ---------- device A: guest practices, then signs up ----------
    localStorage.clear()
    const a = await bootDevice()
    readingAnswer(a)
    readingAnswer(a)
    readingAnswer(a, { correct: false, confusedWith: "hiragana:し" })
    const guestStats = a.progress.progressStore.state.charStats["hiragana:つ"]!
    expect(guestStats.attempts).toBe(3)

    await signIn(a, "signUp")
    expect(await a.importMod.importLocalSnapshot()).toBe("imported")
    // Second call must be a no-op (import runs exactly once).
    expect(await a.importMod.importLocalSnapshot()).toBe("skipped")

    await a.pull.pullAll()
    const pulled = a.progress.progressStore.state.charStats["hiragana:つ"]!
    expect(pulled.attempts).toBe(3)
    expect(pulled.correct).toBe(2)
    expect(pulled.weight).toBeCloseTo(guestStats.weight, 4)
    // The confusion made it through import → pull.
    expect(
      a.progress.progressStore.state.matrix["hiragana:し"]?.["hiragana:つ"] ??
        a.progress.progressStore.state.matrix["hiragana:つ"]?.["hiragana:し"]
    ).toBe(1)

    // "Airplane mode": answers queue while flush is impossible, survive a
    // failed flush, and apply exactly once when the network returns.
    readingAnswer(a)
    expect(a.queue.queueStore.state.pending.events).toHaveLength(1)
    const realFetch = globalThis.fetch
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")))
    await a.engine.flushNow()
    vi.stubGlobal("fetch", realFetch)
    // The batch moved to inflight and stayed there — nothing was lost.
    expect(a.queue.queueStore.state.inflight).not.toBeNull()

    await a.engine.flushNow({ force: true })
    expect(a.queue.queueStore.state.inflight).toBeNull()

    // Replaying the same work must not double-count: flush again (no-op)
    // and verify the server total.
    await a.engine.flushNow({ force: true })

    // ---------- device B: same account, fresh device ----------
    localStorage.clear()
    const b = await bootDevice()
    await signIn(b, "signIn")
    expect(await b.importMod.importLocalSnapshot()).toBe("skipped")
    await b.pull.pullAll()

    const statsB = b.progress.progressStore.state.charStats["hiragana:つ"]!
    expect(statsB.attempts).toBe(4) // 3 imported + 1 flushed — not 5, not 8
    expect(statsB.correct).toBe(3)

    // Device B practices and pushes; device A pulls and sees the sum.
    readingAnswer(b)
    await b.engine.flushNow()

    await a.pull.pullAll()
    expect(
      a.progress.progressStore.state.charStats["hiragana:つ"]!.attempts
    ).toBe(5)
  }, 30_000)
})
