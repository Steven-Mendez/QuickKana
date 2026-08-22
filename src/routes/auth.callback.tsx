import { createFileRoute } from "@tanstack/react-router"
import { createServerSupabase } from "@/lib/supabase/server"

/** Only same-origin paths; anything else falls back to home. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/"
  return raw
}

const redirectTo = (location: string) =>
  new Response(null, { status: 303, headers: { Location: location } })

/**
 * OAuth (PKCE) landing: exchanges the ?code for a session and sets the auth
 * cookies on the redirect response.
 */
export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get("code")
        const next = safeNext(url.searchParams.get("next"))

        if (code) {
          const { supabase, applyCookies } = createServerSupabase(request)
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) return applyCookies(redirectTo(next))
        }
        return redirectTo("/auth/login?error=callback")
      },
    },
  },
})
