import { useEffect, useRef, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, Flag, Keyboard, PartyPopper, Pencil } from "lucide-react"
import { useSelector } from "@tanstack/react-store"
import { AnimatePresence, motion } from "motion/react"
import { useTranslation } from "react-i18next"
import { useReward } from "react-rewards"

import { Button, buttonVariants } from "@/components/ui/button"
import { DrillCard } from "@/components/drill-card"
import { SessionSummary } from "@/components/session-summary"
import { WriteDrillCard } from "@/components/write-drill-card"
import { useDrill } from "@/hooks/use-drill"
import { useKeyboardInset } from "@/hooks/use-keyboard-inset"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { lessonAt, lessonById } from "@/lib/journey"
import { lessonOf, progressionStore } from "@/stores/progression.store"
import { preloadEffects } from "@/lib/sound"
import { formatPercent } from "@/lib/stats"
import { cn } from "@/lib/utils"
import type { ExerciseType } from "@/lib/types"

export const Route = createFileRoute("/practice")({ component: Practice })

/**
 * The drill fills the viewport below the nav (3.5rem plus its hairline border,
 * plus the notch inset it absorbs — a pixel over and the page becomes
 * scrollable, which on iOS means rubber-banding and a jittering toolbar) so the
 * kana sits dead centre. `--keyboard-inset` is 0 until a
 * soft keyboard comes up; then it is the height that keyboard covers, and the
 * same figure becomes a hard cap — the column shrinks into the strip that is
 * still on screen instead of hanging behind the keys.
 *
 * Literal class strings, one per line: Tailwind scans the source text, so an
 * interpolated template would compile to nothing.
 */
const FULL_HEIGHT = [
  "min-h-[calc(100dvh-3.5rem-1px-env(safe-area-inset-top)-var(--keyboard-inset,0px))]",
  "kb-open:h-[calc(100dvh-3.5rem-1px-env(safe-area-inset-top)-var(--keyboard-inset,0px))]",
  "kb-open:min-h-0",
  "kb-open:overflow-hidden",
].join(" ")

/**
 * One drill, two kinds of prompt: reading (type the rōmaji) and writing
 * (trace the kana). The session mixes them; which types are served is a
 * settings choice, not a mode.
 */
function Practice() {
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
    writeOutline,
    setInput,
    submit,
    skip,
    finish,
    restart,
    markAssisted,
    strokeCorrect,
    strokeMistake,
    completeWrite,
    skipUnloadable,
  } = useDrill()
  const { t } = useTranslation()
  const recordStreak = useSelector(
    progressionStore,
    (s) => s.records.bestSessionStreak
  )
  const keyboardOpen = useKeyboardInset()

  // The layout now fits above the keyboard on its own, so any scrolling iOS did
  // to chase the focused field is stale — and leaves the nav off screen.
  useEffect(() => {
    if (keyboardOpen) window.scrollTo({ top: 0 })
  }, [keyboardOpen])

  // The user clicked their way here, so the AudioContext can unlock and the
  // clips can be fetched before the first answer needs one.
  useEffect(() => {
    preloadEffects()
  }, [])

  // A heads-up the moment the prompt type flips: the next stretch runs on the
  // other input device (keyboard ↔ pointer), and silently swapping the card
  // is easy to miss mid-flow.
  const [deviceSwitch, setDeviceSwitch] = useState<{
    exercise: ExerciseType
    at: number
  } | null>(null)
  const prevExerciseRef = useRef<ExerciseType | null>(null)
  useEffect(() => {
    prevExerciseRef.current = null
    setDeviceSwitch(null)
  }, [session.id])
  useEffect(() => {
    if (!session.current) return
    const prev = prevExerciseRef.current
    prevExerciseRef.current = session.exercise
    if (prev !== null && prev !== session.exercise) {
      setDeviceSwitch({ exercise: session.exercise, at: session.shownAt })
    }
  }, [session.exercise, session.shownAt, session.current])

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
          {settings.practiceReading
            ? t("practice.emptyBody")
            : t("writePractice.emptyBody")}
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
  const isWritePrompt = session.exercise === "write"

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

          {deviceSwitch !== null && (
            <DeviceSwitchPill
              key={deviceSwitch.at}
              exercise={deviceSwitch.exercise}
            />
          )}

          {kana ? (
            isWritePrompt ? (
              <WriteDrillCard
                kana={kana}
                session={session}
                settings={settings}
                outline={writeOutline}
                recordStreak={recordStreak}
                onCorrectStroke={strokeCorrect}
                onMistake={strokeMistake}
                onComplete={completeWrite}
                onAssist={markAssisted}
                onLoadError={skipUnloadable}
              />
            ) : (
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
            )
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              {t("common.loading")}
            </div>
          )}

          {/* Everything that is not the drill lives down here, out of the way.
              Phones get a centred stat strip with the actions full-width under
              it; from sm up it is the classic left-stats / right-buttons row.
              With the keyboard up the room is measured in tens of pixels, so
              the stats step aside and only the two actions stay — kept clear of
              the bottom edge, where Safari parks its floating address pill on
              top of the page. */}
          <footer className="mx-auto flex w-full max-w-4xl flex-col gap-3 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground kb-open:pt-2 kb-open:pb-14 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6 sm:gap-y-2 sm:pt-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-2 tabular-nums kb-open:hidden sm:items-center sm:justify-start sm:gap-x-4 sm:gap-y-1">
              {settings.sessionLimitEnabled && (
                <SessionClock
                  startedAt={session.startedAt}
                  minutes={settings.sessionMinutes}
                />
              )}
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
              {!isWritePrompt && (
                <>
                  <kbd className="rounded border px-1 py-0.5">Enter</kbd>{" "}
                  {t("practice.confirm")} ·{" "}
                </>
              )}
              <kbd className="rounded border px-1 py-0.5">Esc</kbd>{" "}
              {t("practice.end")}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="max-sm:h-10 max-sm:flex-1 max-sm:bg-secondary max-sm:text-foreground"
                onClick={skip}
              >
                {t("practice.skip")}
                <ArrowRight className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="max-sm:h-10 max-sm:flex-1 max-sm:bg-secondary max-sm:text-foreground"
                onClick={finish}
              >
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

/**
 * Announces that the drill just switched between reading and writing — i.e.
 * between keyboard and pointer. Transient like the unlock banner, and sits a
 * step below it so the two never cover each other.
 */
function DeviceSwitchPill({ exercise }: { exercise: ExerciseType }) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 2500)
    return () => clearTimeout(id)
  }, [])

  const Icon = exercise === "write" ? Pencil : Keyboard
  return (
    <div className="pointer-events-none fixed inset-x-0 top-28 z-20 flex justify-center px-4">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: -12, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-sm text-primary shadow-sm backdrop-blur"
          >
            <Icon className="size-4" />
            {t(
              exercise === "write"
                ? "practice.nowWriting"
                : "practice.nowReading"
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Time left in the pomodoro session. Purely informative — the session itself
 * ends at the next prompt boundary after the clock hits zero, so the current
 * character is never cut off mid-answer.
 */
function SessionClock({
  startedAt,
  minutes,
}: {
  startedAt: number
  minutes: number
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const remaining = Math.max(0, startedAt + minutes * 60_000 - now)
  const mm = Math.floor(remaining / 60_000)
  const ss = Math.floor((remaining % 60_000) / 1000)

  return (
    <Metric
      label={t("practice.timeLeft")}
      value={`${mm}:${String(ss).padStart(2, "0")}`}
      highlight={remaining === 0}
    />
  )
}

/** One session figure. Phones stack the value over a tiny label (the strip is
    centred there); sm+ reads label-then-value inline, as before. */
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
    <span className="flex flex-col-reverse items-center gap-0.5 sm:flex-row sm:items-baseline sm:gap-1.5">
      <span className="text-[10px] sm:text-xs">{label}</span>
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
