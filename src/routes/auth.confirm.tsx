import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client"
import type { EmailOtpType } from "@supabase/supabase-js"

const OTP_TYPES: ReadonlyArray<string> = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]

const isOtpType = (value: string | undefined): value is EmailOtpType =>
  value !== undefined && OTP_TYPES.includes(value)

interface ConfirmSearch {
  token_hash?: string
  type?: string
}

/**
 * Email link landing (confirmation, recovery, email change), resolved in
 * the browser — the production deploy is a static SPA with no server.
 * The email templates must point here with
 * ?token_hash={{ .TokenHash }}&type=… — see docs/supabase.md.
 */
export const Route = createFileRoute("/auth/confirm")({
  validateSearch: (search: Record<string, unknown>): ConfirmSearch => ({
    token_hash:
      typeof search.token_hash === "string" ? search.token_hash : undefined,
    type: typeof search.type === "string" ? search.type : undefined,
  }),
  component: ConfirmPage,
})

function ConfirmPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token_hash: tokenHash, type } = Route.useSearch()

  useEffect(() => {
    let cancelled = false
    const finish = (ok: boolean) => {
      if (cancelled) return
      if (ok) void navigate({ to: "/", replace: true })
      else {
        void navigate({
          to: "/auth/login",
          search: { error: "confirm" },
          replace: true,
        })
      }
    }

    const run = async () => {
      if (!tokenHash || !isOtpType(type) || !isSupabaseConfigured()) {
        return finish(false)
      }
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      })
      if (!error) return finish(true)
      // An already-used link on a browser that is signed in is a success.
      const { data } = await supabase.auth.getSession()
      finish(Boolean(data.session))
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
