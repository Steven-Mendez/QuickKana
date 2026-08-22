import { Volume2, VolumeX } from "lucide-react"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { settingsStore, updateSettings } from "@/stores/settings.store"

export function SoundToggle() {
  const soundEnabled = useSelector(settingsStore, (s) => s.soundEnabled)
  const { t } = useTranslation()
  const label = soundEnabled ? t("sound.mute") : t("sound.unmute")
  const Icon = soundEnabled ? Volume2 : VolumeX

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() => updateSettings({ soundEnabled: !soundEnabled })}
    >
      <Icon className="size-4" />
    </Button>
  )
}
