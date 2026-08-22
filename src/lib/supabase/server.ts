import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
} from "@supabase/ssr"
import type { Database } from "@/types/database.types"

/**
 * Request-scoped Supabase client for server route handlers (OAuth callback,
 * email confirm). Cookies written by the auth client are collected and must
 * be attached to whatever Response the handler returns via `applyCookies` —
 * TanStack Start's header helpers can't append multiple Set-Cookie values,
 * so the handler owns the Response instead.
 */
export function createServerSupabase(request: Request) {
  const pending: Array<string> = []

  const supabase = createServerClient<Database>(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get("cookie") ?? "")
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            pending.push(serializeCookieHeader(name, value, options))
          }
        },
      },
    }
  )

  const applyCookies = (response: Response): Response => {
    for (const cookie of pending) {
      response.headers.append("Set-Cookie", cookie)
    }
    return response
  }

  return { supabase, applyCookies }
}
