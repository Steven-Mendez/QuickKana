import { useState } from "react"
import { Trash2 } from "lucide-react"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { clearAllStorage } from "@/lib/storage"
import { deleteRemoteData } from "@/lib/sync/engine"
import { authStore } from "@/stores/auth.store"
import { resetProgress } from "@/stores/progress.store"
import { resetProgression } from "@/stores/progression.store"
import { resetSelection } from "@/stores/selection.store"
import { resetSettings } from "@/stores/settings.store"
import { resetWriting } from "@/stores/writing.store"

export function ResetDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const signedIn = useSelector(authStore, (s) => s.status === "signedIn")
  // Defaults to on: leaving server data alive would just restore it on the
  // next pull, which reads as "reset didn't work".
  const [alsoRemote, setAlsoRemote] = useState(true)
  const [busy, setBusy] = useState(false)
  const [remoteError, setRemoteError] = useState(false)

  const resetLocal = () => {
    // Storage first, then the stores. Persisting is debounced, but each store
    // emits its *new* default on reset, so the pending write can only ever
    // re-save defaults — no timing assumption needed for old data to stay gone.
    clearAllStorage()
    resetProgress()
    resetProgression()
    resetSelection()
    resetSettings()
    resetWriting()
  }

  const reset = async () => {
    setRemoteError(false)
    if (signedIn && alsoRemote) {
      setBusy(true)
      try {
        await deleteRemoteData()
      } catch {
        // Keep local data too: a half-reset (local gone, cloud alive) would
        // resurrect on the next pull and confuse more than it helps.
        setRemoteError(true)
        setBusy(false)
        return
      }
      setBusy(false)
    }
    resetLocal()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive">
            <Trash2 className="size-4" />
            {t("reset.trigger")}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("reset.title")}</DialogTitle>
          <DialogDescription>{t("reset.desc")}</DialogDescription>
        </DialogHeader>

        {signedIn ? (
          <div className="flex items-center justify-between gap-4 py-1">
            <div className="space-y-0.5">
              <Label htmlFor="reset-remote">{t("reset.remoteTitle")}</Label>
              <p className="text-xs text-muted-foreground">
                {t("reset.remoteDesc")}
              </p>
            </div>
            <Switch
              id="reset-remote"
              checked={alsoRemote}
              onCheckedChange={setAlsoRemote}
            />
          </div>
        ) : null}

        {remoteError ? (
          <p role="alert" className="text-sm text-destructive">
            {t("reset.remoteError")}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose
            render={<Button variant="outline">{t("reset.cancel")}</Button>}
          />
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => void reset()}
          >
            {t("reset.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
