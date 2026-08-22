import { useEffect, useMemo } from "react"
import { Link } from "@tanstack/react-router"
import { motion } from "motion/react"
import { useTranslation } from "react-i18next"
import { useReward } from "react-rewards"
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
import { NumberTicker } from "@/components/ui/number-ticker"
import { Separator } from "@/components/ui/separator"
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion"
import { lessonById } from "@/lib/journey"
import { SCRIPT_LABELS, displayPair, getKana } from "@/lib/kana"
import { formatDuration } from "@/lib/stats"
import { historyStore, progressStore } from "@/stores/progress.store"
import { progressionStore } from "@/stores/progression.store"
import { cn } from "@/lib/utils"
import type { SessionState } from "@/lib/types"

interface SessionSummaryProps {
  session: SessionState
  onRestart: () => void
}

export function SessionSummary({ session, onRestart }: SessionSummaryProps) {
  const { t } = useTranslation()
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

  const reducedMotion = usePrefersReducedMotion()
  // react-rewards ignores prefers-reduced-motion, hence the manual gate.
  const { reward } = useReward("reward-summary", "confetti", {
    spread: 70,
    elementCount: 80,
    lifetime: 160,
  })
  const celebrate = session.newRecord || session.unlocked.length > 0

  useEffect(() => {
    if (celebrate && !reducedMotion) reward()
    // Mount-only: one burst per summary, not one per re-render.
  }, [])

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      <header className="text-center">
        <p className="text-sm text-muted-foreground">{t("summary.complete")}</p>
        <span id="reward-summary" aria-hidden className="block" />
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
          {session.attempts > 0 ? (
            <>
              <NumberTicker value={Math.round(accuracy * 100)} />%
            </>
          ) : (
            "—"
          )}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("summary.ofIn", {
            correct: session.correct,
            attempts: session.attempts,
            duration: formatDuration(elapsed),
          })}
        </p>
      </header>

      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure
            label={t("summary.attempts")}
            value={<NumberTicker value={session.attempts} />}
          />
          <Figure
            label={t("summary.bestStreak")}
            value={<NumberTicker value={session.bestStreak} />}
            badge={session.newRecord ? t("summary.record") : undefined}
          />
          <Figure label={t("summary.perChar")} value={formatDuration(avgMs)} />
          <Figure
            label={t("summary.dayStreak")}
            value={String(progression.day.streak)}
            icon={<Flame className="size-3" />}
          />
        </div>
      </Reveal>

      {unlocked.length > 0 && (
        <Reveal delay={0.12}>
          <Separator />
          <section className="mt-8 space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <PartyPopper className="size-4" />
              {t("summary.unlockedTitle", { count: unlocked.length })}
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
        </Reveal>
      )}

      {graduated.length > 0 && (
        <Reveal delay={0.18}>
          <Separator />
          <section className="mt-8 space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <GraduationCap className="size-4" />
              {t("summary.graduatedTitle")}
            </h3>
            <div className="flex flex-wrap gap-2">
              {graduated.map((group) => (
                <Badge key={group.id} className="font-jp">
                  {displayPair(group.members)}
                </Badge>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {misses.length > 0 && (
        <Reveal delay={0.24}>
          <Separator />
          <section className="mt-8 space-y-2">
            <h3 className="text-sm font-medium">{t("summary.hardest")}</h3>
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
        </Reveal>
      )}

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Button onClick={onRestart}>
          <RotateCcw className="size-4" />
          {t("summary.again")}
        </Button>
        <Link to="/stats" className={buttonVariants({ variant: "outline" })}>
          {t("summary.viewStats")}
        </Link>
        <Link to="/" className={buttonVariants({ variant: "ghost" })}>
          {progression.mode === "journey"
            ? t("summary.viewJourney")
            : t("summary.changeSelection")}
        </Link>
      </div>
    </main>
  )
}

/** Fade-and-rise on mount; the parent staggers siblings via `delay`. */
function Reveal({
  delay,
  children,
}: {
  delay: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
    >
      {children}
    </motion.div>
  )
}

function Figure({
  label,
  value,
  badge,
  icon,
}: {
  label: string
  value: React.ReactNode
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
