import { useEffect } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { authStore, signOut } from "@/stores/auth.store"

export const Route = createFileRoute("/account")({ component: AccountPage })

function AccountPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { status, user } = useSelector(authStore, (s) => s)

  useEffect(() => {
    if (status === "signedOut") void navigate({ to: "/auth/login" })
  }, [status, navigate])

  if (status !== "signedIn" || !user) {
    return (
      <main className="mx-auto max-w-sm px-4 py-12">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </main>
    )
  }

  const provider = user.app_metadata.provider ?? "email"
  const since = user.created_at
    ? new Date(user.created_at).toLocaleDateString(i18n.language)
    : null

  const handleSignOut = async () => {
    // Local stores are untouched: the device keeps its data and the app
    // falls back to guest mode.
    await signOut()
    void navigate({ to: "/" })
  }

  return (
    <main className="mx-auto max-w-sm space-y-6 px-4 py-12">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("account.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("account.subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{user.email}</CardTitle>
          <CardDescription>
            {t(
              provider === "google"
                ? "account.providerGoogle"
                : "account.providerEmail"
            )}
            {since ? ` · ${t("account.since", { date: since })}` : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Separator />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void handleSignOut()}
          >
            <LogOut />
            {t("account.signOut")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("account.signOutNote")}
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
