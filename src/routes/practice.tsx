import { useEffect, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, Flag, PartyPopper } from "lucide-react"
import { useSelector } from "@tanstack/react-store"
import { AnimatePresence, motion } from "motion/react"
import { useTranslation } from "react-i18next"
import { useReward } from "react-rewards"

import { Button, buttonVariants } from "@/components/ui/button"
import { DrillCard } from "@/components/drill-card"
import { SessionSummary } from "@/components/session-summary"
import { WritePractice } from "@/components/write-practice"
import { useDrill } from "@/hooks/use-drill"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { lessonAt, lessonById } from "@/lib/journey"
import { lessonOf, progressionStore } from "@/stores/progression.store"
import { preloadEffects } from "@/lib/sound"
import { formatPercent } from "@/lib/stats"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/practice")({ component: Practice })

/** Fills the viewport below the 3.5rem nav so the kana can sit dead centre. */
const FULL_HEIGHT = "min-h-[calc(100dvh-3.5rem)]"

/**
 * Same route for both drills; which one runs is a persisted preference. The
 * split into two components matters: each drill's hook wires its own effects
 * and timers, so they must never be mounted at the same time.
 */
function Practice() {
  const drillMode = useSelector(progressionStore, (s) => s.drillMode)
  return drillMode === "write" ? <WritePractice /> : <ReadPractice />
}

function ReadPractice() {
  const {
    session,
    settings,
    progression,
    kana,
    pool,
    limitMs,
    activeGroup,
    pushingPace,
    journeyPhase,
    setInput,
    submit,
    skip,
    finish,
    restart,
  } = useDrill()
  const { t } = useTranslation()
  const recordStreak = useSelector(
    progressionStore,
    (s) => s.records.bestSessionStreak
  )

  // The user clicked their way here, so the AudioContext can unlock and the
  // clips can be fetched before the first answer needs one.
  useEffect(() => {
    preloadEffects()
  }, [])

  // Esc ends the session from anywhere, including while the input has focus.
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
          {t("practice.emptyBody")}
        </p>
        <Link to="/" className={buttonVariants()}>
          {t("practice.emptyCta")}
        </Link>
      </main>
    )
  }

  const justUnlocked = session.unlocked[session.unlocked.length - 1]

  // While a new section is being introduced the pool is that section alone, and
  // the footer says so — otherwise the sudden absence of review looks broken.
  const focusLesson =
    journeyPhase === "focus" && progression.mode === "journey"
      ? lessonAt(progression.track, lessonOf(progression, progression.track))
      : null

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
          {justUnlocked !== undefined && (
            <UnlockBanner key={justUnlocked} lessonId={justUnlocked} />
          )}

          {kana ? (
            <DrillCard
              kana={kana}
              session={session}
              settings={settings}
              activeGroup={activeGroup}
              limitMs={limitMs}
              recordStreak={recordStreak}
              pushingPace={pushingPace}
              onInput={setInput}
              onSubmit={submit}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          )}

          {/* Everything that is not the drill lives down here, out of the way. */}
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
              {focusLesson && (
                <Metric
                  label={t("practice.learning")}
                  value={focusLesson.label}
                  highlight
                />
              )}
            </div>

            <div className="hidden lg:block">
              <kbd className="rounded border px-1 py-0.5">Enter</kbd>{" "}
              {t("practice.confirm")} ·{" "}
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

/**
 * Shows up for a few seconds when a lesson unlocks mid-drill. It is deliberately
 * transient: the drill should not stop for it, and the summary repeats it at
 * the end anyway.
 */
function UnlockBanner({ lessonId }: { lessonId: string }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(true)
  const reducedMotion = usePrefersReducedMotion()
  // react-rewards ignores prefers-reduced-motion, hence the manual gate below.
  const { reward } = useReward("reward-unlock", "confetti", {
    spread: 70,
    elementCount: 60,
    lifetime: 120,
  })

  useEffect(() => {
    if (!reducedMotion) reward()
    const id = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(id)
    // Mount-only on purpose: the banner is keyed by lesson, one burst each.
  }, [])

  const next = lessonById(lessonId)
  if (!next) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex justify-center px-4">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: -16, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-600 shadow-sm backdrop-blur dark:text-emerald-400"
          >
            <span id="reward-unlock" aria-hidden />
            <PartyPopper className="size-4" />
            {t("practice.unlockBanner", { number: next.index + 1 })}{" "}
            <span className="font-jp">{next.chars.join(" ")}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span>{label}</span>
      <span
        className={cn(
          "text-sm font-medium text-foreground",
          highlight && "text-primary"
        )}
      >
        {value}
      </span>
    </span>
  )
}
