import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client"

interface CallbackSearch {
  code?: string
}

/**
 * OAuth (PKCE) landing, resolved in the browser: the production deploy is a
 * static SPA (vercel.json rewrites everything to the shell), so there is no
 * server to exchange the code — the browser client does it with the
 * code_verifier it stored when the flow started.
 */
export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  component: CallbackPage,
})

function CallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { code } = Route.useSearch()

  useEffect(() => {
    let cancelled = false
    const fail = () => {
      if (!cancelled) {
        void navigate({
          to: "/auth/login",
          search: { error: "callback" },
          replace: true,
        })
      }
    }
    const done = () => {
      if (!cancelled) void navigate({ to: "/", replace: true })
    }

    const run = async () => {
      if (!code || !isSupabaseConfigured()) return fail()
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return done()
      // detectSessionInUrl may have already consumed the code at boot; if a
      // session exists the sign-in actually succeeded.
      const { data } = await supabase.auth.getSession()
      return data.session ? done() : fail()
    }
    void run()
    return () => {
      cancelled = true
    }
    // Deliberately mount-only: the link params never change in-page.
  }, [])

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
    </main>
  )
}
