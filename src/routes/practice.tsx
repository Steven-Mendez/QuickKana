import { useEffect, useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { ArrowRight, Flag, PartyPopper } from "lucide-react"
import { useSelector } from "@tanstack/react-store"

import { Button, buttonVariants } from "@/components/ui/button"
import { DrillCard } from "@/components/drill-card"
import { SessionSummary } from "@/components/session-summary"
import { useDrill } from "@/hooks/use-drill"
import { lessonById } from "@/lib/journey"
import { progressionStore } from "@/stores/progression.store"
import { formatPercent } from "@/lib/stats"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/practice")({ component: Practice })

/** Fills the viewport below the 3.5rem nav so the kana can sit dead centre. */
const FULL_HEIGHT = "min-h-[calc(100dvh-3.5rem)]"

function Practice() {
  const {
    session,
    settings,
    kana,
    pool,
    limitMs,
    activeGroup,
    setInput,
    submit,
    skip,
    finish,
    restart,
  } = useDrill()
  const recordStreak = useSelector(
    progressionStore,
    (s) => s.records.bestSessionStreak
  )

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
        <h1 className="text-xl font-semibold">No characters selected</h1>
        <p className="text-sm text-muted-foreground">
          Pick at least one to get started practicing.
        </p>
        <Link to="/" className={buttonVariants()}>
          Go to selector
        </Link>
      </main>
    )
  }

  if (session.ended) {
    return <SessionSummary session={session} onRestart={restart} />
  }

  const justUnlocked = session.unlocked[session.unlocked.length - 1]

  const accuracy = session.attempts > 0 ? session.correct / session.attempts : 0

  return (
    <main className={cn("flex flex-col px-4", FULL_HEIGHT)}>
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
          onInput={setInput}
          onSubmit={submit}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {/* Everything that is not the drill lives down here, out of the way. */}
      <footer className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5 text-xs text-muted-foreground">
        <div className="flex items-center gap-4 tabular-nums">
          <Metric
            label="Correct"
            value={`${session.correct}/${session.attempts}`}
          />
          <Metric
            label="Accuracy"
            value={session.attempts > 0 ? formatPercent(accuracy) : "—"}
          />
          <Metric label="Best streak" value={String(session.bestStreak)} />
        </div>

        <div className="hidden lg:block">
          <kbd className="rounded border px-1 py-0.5">Enter</kbd> confirm ·{" "}
          <kbd className="rounded border px-1 py-0.5">Esc</kbd> end
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={skip}>
            Skip
            <ArrowRight className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={finish}>
            <Flag className="size-3.5" />
            Finish
          </Button>
        </div>
      </footer>
    </main>
  )
}

/**
 * Shows up for a few seconds when a lesson unlocks mid-drill. It is deliberately
 * transient: the drill should not stop for it, and the summary repeats it at
 * the end anyway.
 */
function UnlockBanner({ lessonId }: { lessonId: string }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(id)
  }, [])

  const next = lessonById(lessonId)
  if (!visible || !next) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-20 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-600 shadow-sm backdrop-blur dark:text-emerald-400">
        <PartyPopper className="size-4" />
        Lesson {next.index + 1} unlocked ·{" "}
        <span className="font-jp">{next.chars.join(" ")}</span>
      </div>
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
