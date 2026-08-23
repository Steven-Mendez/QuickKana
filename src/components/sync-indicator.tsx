import {
  Check,
  CloudOff,
  CloudUpload,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"
import { authStore } from "@/stores/auth.store"
import { syncStore } from "@/stores/sync.store"
import { cn } from "@/lib/utils"

/**
 * Discreet sync state, only rendered while signed in. Guests sync nothing,
 * so showing them a cloud icon would only raise questions.
 */
export function SyncIndicator({ className }: { className?: string }) {
  const { t } = useTranslation()
  const signedIn = useSelector(authStore, (s) => s.status === "signedIn")
  const { status, pendingCount } = useSelector(syncStore, (s) => s)

  if (!signedIn || status === "guest") return null

  const view = {
    syncing: { icon: RefreshCw, key: "sync.syncing", spin: true },
    synced: { icon: Check, key: "sync.synced", spin: false },
    pending: { icon: CloudUpload, key: "sync.pending", spin: false },
    offline: { icon: CloudOff, key: "sync.offline", spin: false },
    error: { icon: TriangleAlert, key: "sync.error", spin: false },
  }[status]
  const Icon = view.icon
  const label = t(view.key as "sync.synced", { count: pendingCount })

  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "flex items-center gap-1 px-1.5 text-muted-foreground",
        status === "error" && "text-destructive",
        className
      )}
    >
      <Icon className={cn("size-4", view.spin && "animate-spin")} />
    </span>
  )
}
