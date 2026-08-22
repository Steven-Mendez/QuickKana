import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { useTour } from "@reactour/tour"
import { useTranslation } from "react-i18next"
import { useReward } from "react-rewards"
import { ChevronRight, Route, Sparkles, Target, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { resolveLanguage } from "@/lib/i18n"
import { STORAGE_KEYS, loadPersisted, savePersisted } from "@/lib/storage"
import { cn } from "@/lib/utils"
import { updateSettings } from "@/stores/settings.store"
import type { ResolvedLanguage } from "@/lib/i18n"

type Step = "language" | "intro"

/**
 * Step 1 predates the language choice, so its strings are deliberately shown
 * in both languages at once instead of going through i18n.
 */
const LANGUAGE_OPTIONS: Array<{
  value: ResolvedLanguage
  badge: string
  name: string
  hint: string
}> = [
  { value: "en", badge: "EN", name: "English", hint: "Continue in English" },
  { value: "es", badge: "ES", name: "Español", hint: "Continuar en español" },
]

/** Ambient decoration behind both steps; purely visual, hence aria-hidden. */
const FLOATING_KANA: Array<{
  char: string
  className: string
  duration: number
  delay: number
}> = [
  { char: "あ", className: "top-5 start-5 text-2xl", duration: 5, delay: 0 },
  { char: "ア", className: "top-9 end-7 text-lg", duration: 6, delay: 0.8 },
  {
    char: "ね",
    className: "bottom-20 start-4 text-xl",
    duration: 7,
    delay: 0.4,
  },
  { char: "カ", className: "top-1/2 end-4 text-sm", duration: 5.5, delay: 1.2 },
  {
    char: "ゆ",
    className: "bottom-6 end-10 text-2xl",
    duration: 6.5,
    delay: 0.2,
  },
]

/**
 * First-run onboarding: picks the language before anything else, then a short
 * intro that can hand off to the reactour walkthrough. Re-armed by the full
 * data reset (same `qk:` prefix) and by "replay the intro" in settings.
 */
export function WelcomeDialog() {
  const { t } = useTranslation()
  const { setIsOpen: setTourOpen } = useTour()
  const reducedMotion = usePrefersReducedMotion()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("language")

  // react-rewards ignores prefers-reduced-motion, hence the manual gate below.
  const { reward } = useReward("reward-welcome", "confetti", {
    spread: 70,
    elementCount: 50,
    lifetime: 120,
    zIndex: 60,
  })

  // Opened in an effect, not initial state, so the build-time shell render
  // and the first client render agree on "closed".
  useEffect(() => {
    if (loadPersisted<boolean>(STORAGE_KEYS.welcomeSeen, false)) return
    setOpen(true)
  }, [])

  const finish = (startTour: boolean) => {
    savePersisted(STORAGE_KEYS.welcomeSeen, true)
    if (!startTour) savePersisted(STORAGE_KEYS.tourSeen, true)
    setOpen(false)
    if (startTour) {
      // Wait out the dialog's closing animation so the tour mask measures a
      // home screen that is actually visible.
      window.setTimeout(() => setTourOpen(true), 200)
    }
  }

  const chooseLanguage = (language: ResolvedLanguage) => {
    updateSettings({ language })
    setStep("intro")
    if (!reducedMotion) window.setTimeout(reward, 150)
  }

  // The browser's own language goes first — it's the likeliest pick.
  const options =
    resolveLanguage("system") === "es"
      ? [...LANGUAGE_OPTIONS].reverse()
      : LANGUAGE_OPTIONS

  const features = [
    {
      icon: <Route className="size-4" />,
      title: t("welcome.featureJourneyTitle"),
      desc: t("welcome.featureJourneyDesc"),
    },
    {
      icon: <Target className="size-4" />,
      title: t("welcome.featureConfusionTitle"),
      desc: t("welcome.featureConfusionDesc"),
    },
    {
      icon: <Zap className="size-4" />,
      title: t("welcome.featurePaceTitle"),
      desc: t("welcome.featurePaceDesc"),
    },
  ]

  return (
    <Dialog
      open={open}
      disablePointerDismissal
      onOpenChange={(next) => {
        // Only Escape lands here (backdrop is non-dismissible): full skip.
        if (!next) finish(false)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden p-0 sm:max-w-md"
      >
        <div className="relative px-6 pt-10 pb-6">
          <div
            aria-hidden
            className="pointer-events-none absolute start-1/2 -top-20 h-44 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
          />
          {FLOATING_KANA.map(({ char, className, duration, delay }) => (
            <motion.span
              key={char}
              aria-hidden
              className={cn(
                "pointer-events-none absolute font-jp text-primary/15 select-none",
                className
              )}
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration,
                delay,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {char}
            </motion.span>
          ))}
          <span
            id="reward-welcome"
            aria-hidden
            className="absolute start-1/2 top-1/3"
          />

          <AnimatePresence mode="wait" initial={false}>
            {step === "language" ? (
              <motion.div
                key="language"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="relative text-center"
              >
                <motion.p
                  aria-hidden
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  className="bg-gradient-to-br from-primary to-chart-5 bg-clip-text font-jp text-6xl font-semibold text-transparent"
                >
                  ようこそ
                </motion.p>
                <DialogTitle className="mt-4 text-lg font-semibold">
                  Welcome · Bienvenido
                </DialogTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose your language · Elige tu idioma
                </p>

                <div className="mt-6 grid gap-2.5 text-start">
                  {options.map((option, index) => (
                    <motion.button
                      key={option.value}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + index * 0.08 }}
                      onClick={() => chooseLanguage(option.value)}
                      className="group flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors outline-none hover:border-primary/50 hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {option.badge}
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">
                          {option.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="relative"
              >
                <div className="text-center">
                  <p
                    aria-hidden
                    className="bg-gradient-to-br from-primary to-chart-5 bg-clip-text font-jp text-3xl font-semibold text-transparent"
                  >
                    はじめまして
                  </p>
                  <DialogTitle className="mt-3 text-lg font-semibold">
                    {t("welcome.title")}
                  </DialogTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("welcome.subtitle")}
                  </p>
                </div>

                <ul className="mt-6 space-y-3">
                  {features.map((feature, index) => (
                    <motion.li
                      key={feature.title}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {feature.icon}
                      </span>
                      <span>
                        <span className="block text-sm font-medium">
                          {feature.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {feature.desc}
                        </span>
                      </span>
                    </motion.li>
                  ))}
                </ul>

                <div className="mt-7 grid gap-2">
                  <Button onClick={() => finish(true)}>
                    <Sparkles className="size-4" />
                    {t("welcome.startTour")}
                  </Button>
                  <Button variant="ghost" onClick={() => finish(false)}>
                    {t("welcome.skip")}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 flex justify-center gap-1.5">
            {(["language", "intro"] as const).map((dot) => (
              <span
                key={dot}
                aria-hidden
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  dot === step
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
