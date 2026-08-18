import { useEffect } from "react"
import { useSelector } from "@tanstack/react-store"
import { settingsStore, updateSettings } from "@/stores/settings.store"
import { STORAGE_KEYS, savePersisted } from "@/lib/storage"
import type { ThemePreference } from "@/lib/types"

const applyTheme = (preference: ThemePreference) => {
  if (typeof document === "undefined") return
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
}

/**
 * Keeps the `.dark` class in sync with the preference. Mirrors the value into
 * its own storage key so the inline boot script can read it before React runs.
 */
export function useTheme() {
  const theme = useSelector(settingsStore, (s) => s.theme)

  useEffect(() => {
    applyTheme(theme)
    savePersisted(STORAGE_KEYS.theme, theme)

    if (theme !== "system") return
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [theme])

  return {
    theme,
    setTheme: (next: ThemePreference) => updateSettings({ theme: next }),
  }
}
