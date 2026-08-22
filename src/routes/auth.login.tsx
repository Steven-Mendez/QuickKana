import { useEffect, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { authStore } from "@/stores/auth.store"

interface LoginSearch {
  error?: string
}

export const Route = createFileRoute("/auth/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: LoginPage,
})

type Mode = "signIn" | "signUp"

function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { error: urlError } = Route.useSearch()
  const status = useSelector(authStore, (s) => s.status)

  const [mode, setMode] = useState<Mode>("signIn")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(
    urlError ? "auth.errorCallback" : null
  )
  // Sign-up succeeded but needs the confirmation email to be clicked.
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)

  useEffect(() => {
    if (status === "signedIn") void navigate({ to: "/account" })
  }, [status, navigate])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const supabase = getSupabaseBrowserClient()

    if (mode === "signIn") {
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (err) setError("auth.errorCredentials")
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      })
      if (err) {
        setError(
          err.message.toLowerCase().includes("password")
            ? "auth.errorWeakPassword"
            : "auth.errorSignUp"
        )
      } else if (!data.session) {
        setAwaitingConfirm(true)
      }
    }
    setBusy(false)
  }

  const signInWithGoogle = async () => {
    setBusy(true)
    setError(null)
    const supabase = getSupabaseBrowserClient()
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // On success the browser navigates away; only errors land back here.
    if (err) {
      setError("auth.errorGoogle")
      setBusy(false)
    }
  }

  if (awaitingConfirm) {
    return (
      <main className="mx-auto max-w-sm px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t("auth.confirmTitle")}
            </CardTitle>
            <CardDescription>
              {t("auth.confirmBody", { email })}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("auth.title")}</CardTitle>
          <CardDescription>{t("auth.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList className="w-full">
              <TabsTrigger value="signIn" className="flex-1">
                {t("auth.signIn")}
              </TabsTrigger>
              <TabsTrigger value="signUp" className="flex-1">
                {t("auth.signUp")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value={mode} className="mt-4">
              <form onSubmit={submit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="auth-email">{t("auth.email")}</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-password">{t("auth.password")}</Label>
                  <Input
                    id="auth-password"
                    type="password"
                    autoComplete={
                      mode === "signIn" ? "current-password" : "new-password"
                    }
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                {error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {t(error as "auth.errorCredentials")}
                  </p>
                ) : null}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : null}
                  {mode === "signIn" ? t("auth.signIn") : t("auth.signUp")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">
              {t("auth.or")}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => void signInWithGoogle()}
          >
            <GoogleMark />
            {t("auth.google")}
          </Button>

          <p className="text-xs text-muted-foreground">{t("auth.localNote")}</p>
        </CardContent>
      </Card>
    </main>
  )
}

/** Inline multicolor "G" so no external asset is needed. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-6-2.1-6.9-5.1L1.3 17.2C3.2 21.2 7.3 24 12 24"
      />
      <path
        fill="#FBBC05"
        d="M5.1 14.3c-.3-.8-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2z"
      />
      <path
        fill="#EA4335"
        d="M12 4.6c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.3 6.7l3.8 3C6 6.7 8.8 4.6 12 4.6"
      />
    </svg>
  )
}
