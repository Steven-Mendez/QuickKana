import { createFileRoute } from "@tanstack/react-router"
import { createServerSupabase } from "@/lib/supabase/server"
import type { EmailOtpType } from "@supabase/supabase-js"

const OTP_TYPES: ReadonlyArray<string> = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]

const isOtpType = (value: string | null): value is EmailOtpType =>
  value !== null && OTP_TYPES.includes(value)

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/"
  return raw
}

const redirectTo = (location: string) =>
  new Response(null, { status: 303, headers: { Location: location } })

/**
 * Email link landing (confirmation, recovery, email change). The production
 * email templates must point here with ?token_hash={{ .TokenHash }}&type=…
 * — see docs/supabase.md.
 */
export const Route = createFileRoute("/auth/confirm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const tokenHash = url.searchParams.get("token_hash")
        const type = url.searchParams.get("type")
        const next = safeNext(url.searchParams.get("next"))

        if (tokenHash && isOtpType(type)) {
          const { supabase, applyCookies } = createServerSupabase(request)
          const { error } = await supabase.auth.verifyOtp({
            type,
            token_hash: tokenHash,
          })
          if (!error) return applyCookies(redirectTo(next))
        }
        return redirectTo("/auth/login?error=confirm")
      },
    },
  },
})
