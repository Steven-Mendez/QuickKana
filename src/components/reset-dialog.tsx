import { useState } from "react"
import { Trash2 } from "lucide-react"
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
import { clearAllStorage } from "@/lib/storage"
import { resetProgress } from "@/stores/progress.store"
import { resetProgression } from "@/stores/progression.store"
import { resetSelection } from "@/stores/selection.store"
import { resetSettings } from "@/stores/settings.store"
import { resetWriting } from "@/stores/writing.store"

export function ResetDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const reset = () => {
    // Storage first, then the stores. Persisting is debounced, but each store
    // emits its *new* default on reset, so the pending write can only ever
    // re-save defaults — no timing assumption needed for old data to stay gone.
    clearAllStorage()
    resetProgress()
    resetProgression()
    resetSelection()
    resetSettings()
    resetWriting()
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
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline">{t("reset.cancel")}</Button>}
          />
          <Button variant="destructive" onClick={reset}>
            {t("reset.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
