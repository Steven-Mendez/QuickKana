import { useEffect } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowRight, Flag } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useTranslation } from "react-i18next"

import { Button, buttonVariants } from "@/components/ui/button"
import { SessionSummary } from "@/components/session-summary"
import { WriteDrillCard } from "@/components/write-drill-card"
import { useWriteDrill } from "@/hooks/use-write-drill"
import { preloadEffects } from "@/lib/sound"
import { formatPercent } from "@/lib/stats"
import { cn } from "@/lib/utils"

/** Fills the viewport below the 3.5rem nav so the canvas can sit centred. */
const FULL_HEIGHT = "min-h-[calc(100dvh-3.5rem)]"

/**
 * The Write drill screen — mirror of the reading one: prompt and canvas in
 * the middle, the same metrics and controls in the footer. The timed mode
 * deliberately does not apply here, so there is no countdown.
 */
export function WritePractice() {
  const {
    session,
    settings,
    writing,
    kana,
    pool,
    outline,
    markAssisted,
    strokeCorrect,
    strokeMistake,
    complete,
    skip,
    skipUnloadable,
    finish,
    restart,
  } = useWriteDrill()
  const { t } = useTranslation()

  useEffect(() => {
    preloadEffects()
  }, [])

  // Esc ends the session from anywhere, same as the reading drill.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !session.ended) finish()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [finish, session.ended])

  if (pool.length === 0) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">{t("practice.emptyTitle")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("writePractice.emptyBody")}
        </p>
        <Link to="/" className={buttonVariants()}>
          {t("practice.emptyCta")}
        </Link>
      </main>
    )
  }

  const accuracy = session.attempts > 0 ? session.correct / session.attempts : 0

  return (
    <AnimatePresence mode="wait" initial={false}>
      {session.ended ? (
        <motion.div
          key="summary"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <SessionSummary session={session} onRestart={restart} />
        </motion.div>
      ) : (
        <motion.main
          key="drill"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={cn("flex flex-col px-4", FULL_HEIGHT)}
        >
          {kana ? (
            <WriteDrillCard
              kana={kana}
              session={session}
              settings={settings}
              outline={outline}
              recordStreak={writing.records.bestSessionStreak}
              onCorrectStroke={strokeCorrect}
              onMistake={strokeMistake}
              onComplete={complete}
              onAssist={markAssisted}
              onLoadError={skipUnloadable}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          )}

          <footer className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5 text-xs text-muted-foreground">
            <div className="flex items-center gap-4 tabular-nums">
              <Metric
                label={t("practice.correct")}
                value={`${session.correct}/${session.attempts}`}
              />
              <Metric
                label={t("practice.accuracy")}
                value={session.attempts > 0 ? formatPercent(accuracy) : "—"}
              />
              <Metric
                label={t("practice.bestStreak")}
                value={String(session.bestStreak)}
              />
            </div>

            <div className="hidden lg:block">
              <kbd className="rounded border px-1 py-0.5">Esc</kbd>{" "}
              {t("practice.end")}
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={skip}>
                {t("practice.skip")}
                <ArrowRight className="size-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={finish}>
                <Flag className="size-3.5" />
                {t("practice.finish")}
              </Button>
            </div>
          </footer>
        </motion.main>
      )}
    </AnimatePresence>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span>{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </span>
  )
}
