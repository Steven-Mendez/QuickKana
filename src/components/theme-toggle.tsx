import { Monitor, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/use-theme"
import type { ThemePreference } from "@/lib/types"

const ORDER: Array<ThemePreference> = ["system", "light", "dark"]
const ICONS = { system: Monitor, light: Sun, dark: Moon }
const LABELS = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = ICONS[theme]

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={LABELS[theme]}
      title={LABELS[theme]}
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
