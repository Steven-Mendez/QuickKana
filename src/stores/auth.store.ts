import { createStore } from "@tanstack/store"
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export type AuthStatus = "loading" | "signedIn" | "signedOut"

export interface AuthState {
  status: AuthStatus
  user: User | null
}

/**
 * Session state, client-only. Starts as "loading" until the browser client
 * answers; SSR and guests-without-env simply stay signed out. Nothing in
 * the app *requires* a session — this store only lights up the sync layer
 * and the account UI.
 */
export const authStore = createStore<AuthState>({
  status: "loading",
  user: null,
})

let started = false

/** Idempotent; called once from Providers on the client. */
export function startAuthListener(): void {
  if (started || typeof window === "undefined") return
  started = true

  if (!isSupabaseConfigured()) {
    authStore.setState(() => ({ status: "signedOut", user: null }))
    return
  }

  const supabase = getSupabaseBrowserClient()

  // getUser() validates against the server instead of trusting the cached
  // session; fine at boot since it runs once.
  void supabase.auth.getUser().then(({ data }) => {
    authStore.setState(() => ({
      status: data.user ? "signedIn" : "signedOut",
      user: data.user,
    }))
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    authStore.setState(() => ({
      status: session?.user ? "signedIn" : "signedOut",
      user: session?.user ?? null,
    }))
  })
}

export async function signOut(): Promise<void> {
  await getSupabaseBrowserClient().auth.signOut()
}
