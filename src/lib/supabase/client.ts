import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database.types"

let client: SupabaseClient<Database> | null = null

/**
 * Browser-side Supabase client, one per tab. Only the publishable key ever
 * reaches the bundle — RLS is the actual protection. Must not be called
 * during SSR; auth-aware code paths are client-only by design (the whole
 * app works signed out).
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (typeof window === "undefined") {
    throw new Error("getSupabaseBrowserClient is browser-only")
  }
  client ??= createBrowserClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  )
  return client
}

/** True when the env is configured; guests on a build without Supabase
 * env vars simply never see auth UI. */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  )
}
