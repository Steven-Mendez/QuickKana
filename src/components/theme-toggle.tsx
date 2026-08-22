import { Monitor, Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme"
import type { ThemePreference } from "@/lib/types"

const ORDER: Array<ThemePreference> = ["system", "light", "dark"]
const ICONS = { system: Monitor, light: Sun, dark: Moon }

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()
  const Icon = ICONS[theme]
  const label = t(`theme.${theme}`)

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() =>
        setTheme(
          ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] as ThemePreference
        )
      }
    >
      <Icon className="size-4" />
    </Button>
  )
}
