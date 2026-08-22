import { useEffect } from "react"
import { useSelector } from "@tanstack/react-store"
import i18n, { resolveLanguage } from "@/lib/i18n"
import { STORAGE_KEYS, savePersisted } from "@/lib/storage"
import { settingsStore, updateSettings } from "@/stores/settings.store"
import type { LanguagePreference } from "@/lib/types"

const apply = (pref: LanguagePreference) => {
  const resolved = resolveLanguage(pref)
  void i18n.changeLanguage(resolved)
  if (typeof document !== "undefined") {
    document.documentElement.lang = resolved
  }
  // Mirrored for the pre-paint boot script, exactly like the theme.
  savePersisted(STORAGE_KEYS.language, resolved)
}

/**
 * Keeps i18next and `<html lang>` in sync with the preference. Modeled on
 * use-theme; mounted once in the root component.
 */
export function useLanguage() {
  const language = useSelector(settingsStore, (s) => s.language)

  useEffect(() => {
    apply(language)

    if (language !== "system") return
    const onChange = () => apply("system")
    window.addEventListener("languagechange", onChange)
    return () => window.removeEventListener("languagechange", onChange)
  }, [language])

  return {
    language,
    setLanguage: (next: LanguagePreference) =>
      updateSettings({ language: next }),
  }
}
