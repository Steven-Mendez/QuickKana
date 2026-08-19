import { useMemo } from "react"
import { Link } from "@tanstack/react-router"
import {
  Flame,
  GraduationCap,
  PartyPopper,
  RotateCcw,
  Trophy,
} from "lucide-react"
import { useSelector } from "@tanstack/react-store"

import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { lessonById } from "@/lib/journey"
import { SCRIPT_LABELS, displayPair, getKana } from "@/lib/kana"
import { formatDuration, formatPercent } from "@/lib/stats"
import { historyStore, progressStore } from "@/stores/progress.store"
import { progressionStore } from "@/stores/progression.store"
import { cn } from "@/lib/utils"
import type { SessionState } from "@/lib/types"

interface SessionSummaryProps {
  session: SessionState
  onRestart: () => void
}

export function SessionSummary({ session, onRestart }: SessionSummaryProps) {
  const progression = useSelector(progressionStore, (s) => s)
  const accuracy = session.attempts > 0 ? session.correct / session.attempts : 0

  // Only this session's attempts, so the summary reflects what just happened
  // rather than the all-time totals shown on /stats.
  const misses = useMemo(() => {
    const counts = new Map<string, number>()
    for (const record of historyStore.state) {
      if (record.sessionId !== session.id || record.correct) continue
      counts.set(record.id, (counts.get(record.id) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [session.id])

  const graduated = useMemo(
    () =>
      [...new Set(session.graduated)]
        .map((id) => progressStore.state.groups[id])
        .filter((group) => group !== undefined),
    [session.graduated]
  )

  const unlocked = useMemo(
    () =>
      [...new Set(session.unlocked)]
        .map(lessonById)
        .filter((lesson) => lesson !== undefined),
    [session.unlocked]
  )

  const elapsed = Date.now() - session.startedAt
  const avgMs = session.attempts > 0 ? elapsed / session.attempts : 0
  const isRecordStreak =
    session.bestStreak > 0 &&
    session.bestStreak >= progression.records.bestSessionStreak

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <header className="text-center">
        <p className="text-sm text-muted-foreground">Session complete</p>
        <p
          className={cn(
            "mt-1 text-6xl font-semibold tabular-nums",
            accuracy >= 0.9
              ? "text-emerald-600 dark:text-emerald-400"
              : accuracy < 0.6 && session.attempts > 0
                ? "text-destructive"
                : undefined
          )}
        >
          {session.attempts > 0 ? formatPercent(accuracy) : "—"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.correct} of {session.attempts} characters in{" "}
          {formatDuration(elapsed)}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label="Attempts" value={String(session.attempts)} />
        <Figure
          label="Best streak"
          value={String(session.bestStreak)}
          badge={isRecordStreak ? "record" : undefined}
        />
        <Figure label="Per character" value={formatDuration(avgMs)} />
        <Figure
          label="Day streak"
          value={String(progression.day.streak)}
          icon={<Flame className="size-3" />}
        />
      </div>

      {unlocked.length > 0 && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <PartyPopper className="size-4" />
              {unlocked.length === 1 ? "Lesson unlocked" : "Lessons unlocked"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {unlocked.map((lesson) => (
                <span
                  key={lesson.id}
                  className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-1.5 text-sm"
                >
                  <span className="text-muted-foreground">
                    {SCRIPT_LABELS[lesson.script]} · {lesson.label}
                  </span>
                  <span className="font-jp text-base">
                    {lesson.chars.join(" ")}
                  </span>
                </span>
              ))}
            </div>
          </section>
        </>
      )}

      {graduated.length > 0 && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <GraduationCap className="size-4" />
              Confusion groups mastered
            </h3>
            <div className="flex flex-wrap gap-2">
              {graduated.map((group) => (
                <Badge key={group.id} className="font-jp">
                  {displayPair(group.members)}
                </Badge>
              ))}
            </div>
          </section>
        </>
      )}

      {misses.length > 0 && (
        <>
          <Separator />
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Hardest characters</h3>
            <div className="flex flex-wrap gap-2">
              {misses.map(([id, count]) => {
                const kana = getKana(id)
                if (!kana) return null
                return (
                  <Badge key={id} variant="outline" className="gap-1.5">
                    <span className="font-jp text-base">{kana.char}</span>
                    <span className="text-muted-foreground">{kana.romaji}</span>
                    <span className="tabular-nums">×{count}</span>
                  </Badge>
                )
              })}
            </div>
          </section>
        </>
      )}

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Button onClick={onRestart}>
          <RotateCcw className="size-4" />
          Another session
        </Button>
        <Link to="/stats" className={buttonVariants({ variant: "outline" })}>
          View stats
        </Link>
        <Link to="/" className={buttonVariants({ variant: "ghost" })}>
          {progression.mode === "journey"
            ? "View my journey"
            : "Change selection"}
        </Link>
      </div>
    </main>
  )
}

function Figure({
  label,
  value,
  badge,
  icon,
}: {
  label: string
  value: string
  badge?: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 flex items-baseline gap-1.5 text-xl font-semibold tabular-nums">
        {value}
        {badge && (
          <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
            <Trophy className="size-3" />
            {badge}
          </span>
        )}
      </p>
    </div>
  )
}
