import { MotionConfig } from "motion/react"
import { I18nextProvider } from "react-i18next"
import { AppTourProvider } from "@/components/app-tour"
import i18n from "@/lib/i18n"

/**
 * App-wide providers, mounted in the root route's component (not the shell)
 * so the build-time shell render stays minimal.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <MotionConfig reducedMotion="user">
        <AppTourProvider>{children}</AppTourProvider>
      </MotionConfig>
    </I18nextProvider>
  )
}
