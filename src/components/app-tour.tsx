import { useEffect, useMemo } from "react"
import { TourProvider, useTour } from "@reactour/tour"
import { useTranslation } from "react-i18next"
import { STORAGE_KEYS, loadPersisted, savePersisted } from "@/lib/storage"
import type { StepType } from "@reactour/tour"

export function AppTourProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()

  // Three steps only, aimed at what the home screen cannot say for itself: the
  // app tracks which characters you confuse, and the pace adapts to your streaks.
  const steps = useMemo<Array<StepType>>(
    () => [
      { selector: '[data-tour="mode-tabs"]', content: t("tour.step1") },
      { selector: '[data-tour="current-lesson"]', content: t("tour.step2") },
      { selector: '[data-tour="practice-cta"]', content: t("tour.step3") },
    ],
    [t]
  )

  return (
    <TourProvider
      steps={steps}
      beforeClose={() => savePersisted(STORAGE_KEYS.tourSeen, true)}
      styles={{
        popover: (base) => ({
          ...base,
          backgroundColor: "var(--popover)",
          color: "var(--popover-foreground)",
          borderRadius: "0.75rem",
          fontSize: "0.875rem",
          maxWidth: "20rem",
          boxShadow: "0 8px 30px rgb(0 0 0 / 0.2)",
        }),
        badge: (base) => ({
          ...base,
          backgroundColor: "var(--primary)",
          color: "var(--primary-foreground)",
        }),
        dot: (base, state) => ({
          ...base,
          backgroundColor: state?.current ? "var(--primary)" : "var(--muted)",
        }),
        maskWrapper: (base) => ({
          ...base,
          color: "var(--foreground)",
          opacity: 0.3,
        }),
      }}
    >
      {children}
    </TourProvider>
  )
}

/**
 * Rendered by the home route: opens the tour once per browser, ever. A full
 * data reset wipes the flag (same `qk:` prefix), which re-arms it on purpose.
 * Waits for the welcome dialog to be done — that flow launches the tour
 * itself; this only covers a reload between welcome and tour.
 */
export function TourAutoLauncher() {
  const { setIsOpen } = useTour()

  useEffect(() => {
    if (!loadPersisted<boolean>(STORAGE_KEYS.welcomeSeen, false)) return
    if (loadPersisted<boolean>(STORAGE_KEYS.tourSeen, false)) return
    // Next frame, so every data-tour anchor exists before the mask measures.
    const frame = requestAnimationFrame(() => setIsOpen(true))
    return () => cancelAnimationFrame(frame)
  }, [setIsOpen])

  return null
}
