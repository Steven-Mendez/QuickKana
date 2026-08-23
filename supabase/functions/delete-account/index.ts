// Deletes the calling user's account. The service-role admin client only
// ever exists here, server-side; every table row falls via the
// `on delete cascade` FKs to auth.users.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

export default {
  // auth: "user" — a valid user JWT is required; RLS-scoped and admin
  // clients arrive pre-built in ctx.
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const userId = ctx.userClaims?.id
    if (!userId) {
      return Response.json({ error: "unauthorized" }, { status: 401 })
    }

    const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ status: "deleted" })
  }),
}
