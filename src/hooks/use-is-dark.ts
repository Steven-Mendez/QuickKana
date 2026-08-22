import { useSyncExternalStore } from "react"

/**
 * Whether the app is currently rendered dark, following the `.dark` class
 * that `useTheme` keeps on <html>. For the few places that need a resolved
 * color as a plain value — hanzi-writer paints its SVG with concrete color
 * strings, CSS variables never reach it.
 */
export function useIsDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange)
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      })
      return () => observer.disconnect()
    },
    () => document.documentElement.classList.contains("dark"),
    () => false
  )
}
