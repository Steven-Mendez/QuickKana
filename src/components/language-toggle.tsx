import { Languages } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/hooks/use-language"
import type { LanguagePreference } from "@/lib/types"

const ORDER: Array<LanguagePreference> = ["system", "en", "es"]

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage()
  const { t } = useTranslation()
  const label = t(`language.${language}`)

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() =>
        setLanguage(
          ORDER[(ORDER.indexOf(language) + 1) % ORDER.length] ?? "system"
        )
      }
    >
      <Languages className="size-4" />
      <span className="sr-only">{label}</span>
    </Button>
  )
}
