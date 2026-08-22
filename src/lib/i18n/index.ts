import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import { STORAGE_KEYS, loadPersisted } from "@/lib/storage"
import { settingsStore } from "@/stores/settings.store"
import { en } from "./locales/en"
import { es } from "./locales/es"
import type { LanguagePreference } from "@/lib/types"

export type ResolvedLanguage = "en" | "es"

/** `"system"` follows the browser; anything explicit wins. Build-safe: no navigator → en. */
export function resolveLanguage(pref: LanguagePreference): ResolvedLanguage {
  if (pref !== "system") return pref
  if (typeof navigator === "undefined") return "en"
  return navigator.languages.some((lang) => lang.toLowerCase().startsWith("es"))
    ? "es"
    : "en"
}

const initialLanguage = (): ResolvedLanguage => {
  // The settings store already merged localStorage at module init; the extra
  // mirror key exists for the pre-paint <html lang> script, but reading it
  // here too keeps both in agreement on the very first render.
  const pref = settingsStore.state.language
  if (pref !== "system") return pref
  return loadPersisted<ResolvedLanguage>(
    STORAGE_KEYS.language,
    resolveLanguage(pref)
  )
}

// Synchronous init with inline resources: no backend, no Suspense, and safe
// during the build-time shell render.
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: initialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

export default i18n
