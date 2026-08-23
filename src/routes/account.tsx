import { useEffect, useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"
import { LogOut, UserRoundX } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { SyncIndicator } from "@/components/sync-indicator"
import { clearAllStorage } from "@/lib/storage"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { flushNow } from "@/lib/sync/engine"
import { authStore, signOut } from "@/stores/auth.store"
import { resetProgress } from "@/stores/progress.store"
import { resetProgression } from "@/stores/progression.store"
import { resetSelection } from "@/stores/selection.store"
import { resetSettings } from "@/stores/settings.store"
import { resetWriting } from "@/stores/writing.store"
import { syncStore } from "@/stores/sync.store"

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
    // Best-effort flush first — after signOut the token is gone. Local
    // stores are untouched: the device keeps its data in guest mode.
    await flushNow({ force: true }).catch(() => undefined)
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
          <SyncStatusRow />
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
          <Separator />
          <DeleteAccount />
        </CardContent>
      </Card>
    </main>
  )
}

/** Calls the delete-account Edge Function, then wipes the device too —
 * keeping a local copy of a deleted account would defeat the point. */
function DeleteAccount() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const deleteAccount = async () => {
    setBusy(true)
    setFailed(false)
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.functions.invoke("delete-account", {
      method: "POST",
    })
    if (error) {
      setFailed(true)
      setBusy(false)
      return
    }
    await supabase.auth.signOut().catch(() => undefined)
    clearAllStorage()
    resetProgress()
    resetProgression()
    resetSelection()
    resetSettings()
    resetWriting()
    void navigate({ to: "/" })
  }

  return (
    <div className="space-y-2">
      <Dialog>
        <DialogTrigger
          render={
            <Button variant="destructive" className="w-full">
              <UserRoundX />
              {t("account.delete")}
            </Button>
          }
        />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("account.deleteTitle")}</DialogTitle>
            <DialogDescription>{t("account.deleteDesc")}</DialogDescription>
          </DialogHeader>
          {failed ? (
            <p role="alert" className="text-sm text-destructive">
              {t("account.deleteError")}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline">{t("reset.cancel")}</Button>}
            />
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void deleteAccount()}
            >
              {t("account.deleteConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SyncStatusRow() {
  const { t, i18n } = useTranslation()
  const { status, pendingCount, lastSyncAt } = useSelector(syncStore, (s) => s)

  const label = t(
    (
      {
        guest: "sync.synced",
        syncing: "sync.syncing",
        synced: "sync.synced",
        pending: "sync.pending",
        offline: "sync.offline",
        error: "sync.error",
      } as const
    )[status],
    { count: pendingCount }
  )

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2">
        <SyncIndicator />
        {label}
      </span>
      {lastSyncAt ? (
        <span className="text-xs text-muted-foreground">
          {t("sync.lastSync", {
            time: new Date(lastSyncAt).toLocaleTimeString(i18n.language, {
              hour: "2-digit",
              minute: "2-digit",
            }),
          })}
        </span>
      ) : null}
    </div>
  )
}
