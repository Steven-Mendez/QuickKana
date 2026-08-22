import { useMemo } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"
import { Flame, Play, Target, Trophy } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TourAutoLauncher } from "@/components/app-tour"
import { JourneyPanel } from "@/components/journey-panel"
import { KanaSelector } from "@/components/kana-selector"
import { activeGroups } from "@/lib/confusion"
import { lessonAt, poolUpTo } from "@/lib/journey"
import { SCRIPT_LABELS, displayPair } from "@/lib/kana"
import { formatPercent } from "@/lib/stats"
import { progressStore } from "@/stores/progress.store"
import { lessonOf, progressionStore, setMode } from "@/stores/progression.store"
import { selectedIds, selectionStore } from "@/stores/selection.store"
import { startSession } from "@/stores/session.store"
import type { PracticeMode } from "@/stores/progression.store"

export const Route = createFileRoute("/")({ component: Home })

function Home() {
  const { t } = useTranslation()
  const selection = useSelector(selectionStore, (s) => s)
  const progress = useSelector(progressStore, (s) => s)
  const progression = useSelector(progressionStore, (s) => s)

  const groups = useMemo(() => activeGroups(progress.groups), [progress.groups])

  // What "Practice" would actually drill, which is not the same question in
  // the two modes — guided practice ignores the selector entirely.
  const track = progression.track
  const lesson = lessonOf(progression, track)
  const pool =
    progression.mode === "journey"
      ? poolUpTo(track, lesson)
      : selectedIds(selection)

  const accuracy =
    progress.totals.attempts > 0
      ? progress.totals.correct / progress.totals.attempts
      : null

  return (
    <main className="mx-auto max-w-4xl px-4 pt-8 pb-28">
      <TourAutoLauncher />
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("home.title")}
          </h1>
          <p className="max-w-lg text-sm text-muted-foreground">
            {t("home.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {progression.day.streak > 0 && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-1 text-sm text-orange-600 dark:text-orange-400"
              title={t("home.bestDays", { count: progression.day.best })}
            >
              <Flame className="size-4" />
              <span className="font-medium tabular-nums">
                {progression.day.streak}
              </span>
              {t("home.day", { count: progression.day.streak })}
            </span>
          )}
          {progress.totals.attempts > 0 && (
            <dl className="flex gap-5 text-sm">
              <Figure
                label={t("home.accuracy")}
                value={accuracy === null ? "—" : formatPercent(accuracy)}
              />
              <Figure
                label={t("home.attempts")}
                value={String(progress.totals.attempts)}
              />
              {progression.records.bestSessionStreak > 0 && (
                <Figure
                  label={t("home.bestStreak")}
                  value={String(progression.records.bestSessionStreak)}
                  icon={<Trophy className="size-3" />}
                />
              )}
            </dl>
          )}
        </div>
      </header>

      {groups.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Target className="size-3.5" />
            {t("home.targeted")}
          </span>
          {groups.map((group) => (
            <span
              key={group.id}
              className="rounded-md bg-background/70 px-2 py-0.5 font-jp text-sm"
            >
              {displayPair(group.members)}
            </span>
          ))}
          <Link
            to="/stats"
            className="ms-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            {t("home.viewDetails")}
          </Link>
        </div>
      )}

      <Tabs
        value={progression.mode}
        onValueChange={(value) => setMode(value as PracticeMode)}
        className="mt-6"
      >
        <TabsList data-tour="mode-tabs">
          <TabsTrigger value="journey">{t("home.tabJourney")}</TabsTrigger>
          <TabsTrigger value="free">{t("home.tabFree")}</TabsTrigger>
        </TabsList>

        <TabsContent value="journey" className="mt-5">
          <JourneyPanel />
        </TabsContent>

        <TabsContent value="free" className="mt-5">
          <KanaSelector />
        </TabsContent>
      </Tabs>

      {/* Floating bar: the pool count and the way out are always reachable,
          however far down the tables the user has scrolled. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 flex justify-center px-4 pb-5">
        <div
          data-tour="practice-cta"
          className="pointer-events-auto flex items-center gap-3 rounded-full border bg-background/90 py-1.5 ps-5 pe-1.5 shadow-lg backdrop-blur"
        >
          <span className="text-sm text-muted-foreground tabular-nums">
            {progression.mode === "journey" ? (
              <>
                {t("home.barLesson", {
                  script: SCRIPT_LABELS[track],
                  number: lesson + 1,
                })}{" "}
                <span className="font-jp">
                  {lessonAt(track, lesson).chars.join("")}
                </span>
              </>
            ) : pool.length === 0 ? (
              t("home.noneSelected")
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {pool.length}
                </span>{" "}
                {t("home.character", { count: pool.length })}
              </>
            )}
          </span>
          {pool.length === 0 ? (
            <Button className="rounded-full" disabled>
              <Play className="size-4" />
              {t("home.practice")}
            </Button>
          ) : (
            <Link
              to="/practice"
              onClick={startSession}
              className={buttonVariants({ className: "rounded-full" })}
            >
              <Play className="size-4" />
              {t("home.practice")}
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}

function Figure({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <div className="text-end">
      <dt className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
