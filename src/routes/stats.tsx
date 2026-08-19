import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useSelector } from "@tanstack/react-store"
import { Flame, Trophy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CharStatsTable } from "@/components/char-stats-table"
import { ConfusionHeatmap } from "@/components/confusion-heatmap"
import { ConfusionTable } from "@/components/confusion-table"
import { GroupsPanel } from "@/components/groups-panel"
import { MasteryMap } from "@/components/mastery-map"
import { LESSON_MASTERY } from "@/lib/journey"
import {
  charRows,
  confusionPairs,
  formatPercent,
  heatmap,
  masteredCount,
  overallMastery,
  TOTAL_KANA,
} from "@/lib/stats"
import { progressStore } from "@/stores/progress.store"
import { progressionStore } from "@/stores/progression.store"
import { selectedIds, selectionStore } from "@/stores/selection.store"
import { settingsStore } from "@/stores/settings.store"

export const Route = createFileRoute("/stats")({ component: Stats })

const HEATMAP_LIMIT = 15

function Stats() {
  const progress = useSelector(progressStore, (s) => s)
  const settings = useSelector(settingsStore, (s) => s)
  const selection = useSelector(selectionStore, (s) => s)
  const progression = useSelector(progressionStore, (s) => s)
  const [onlySelected, setOnlySelected] = useState(false)

  const pairs = useMemo(() => confusionPairs(progress), [progress])
  const rows = useMemo(() => charRows(progress), [progress])
  const groups = useMemo(
    () => Object.values(progress.groups),
    [progress.groups]
  )
  const mastered = useMemo(
    () => masteredCount(progress.charStats, LESSON_MASTERY),
    [progress.charStats]
  )

  const grid = useMemo(() => {
    const restrictTo = onlySelected
      ? new Set(selectedIds(selection))
      : undefined
    return heatmap(progress, HEATMAP_LIMIT, restrictTo)
  }, [progress, onlySelected, selection])

  const accuracy =
    progress.totals.attempts > 0
      ? progress.totals.correct / progress.totals.attempts
      : null

  const activeCount = groups.filter((group) => group.status === "active").length

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <p className="text-sm text-muted-foreground">
          Which characters do you confuse with which, and how your targeted
          practice is going.
        </p>
      </header>

      {/* One strip instead of a row of cards: these are reference numbers, and
          six bordered boxes made them look more important than the tables. */}
      <dl className="flex flex-wrap gap-x-8 gap-y-4 border-y py-4">
        <Figure
          label="Mastery"
          value={formatPercent(overallMastery(progress.charStats))}
          hint={`${mastered} of ${TOTAL_KANA} characters mastered`}
        />
        <Figure
          label="Accuracy"
          value={accuracy === null ? "—" : formatPercent(accuracy)}
          hint={`${progress.totals.attempts} attempts`}
        />
        <Figure
          label="Sessions"
          value={String(progress.totals.sessions)}
          hint={
            progression.day.streak > 0
              ? `${progression.day.streak} ${
                  progression.day.streak === 1
                    ? "day in a row"
                    : "days in a row"
                }`
              : undefined
          }
          icon={
            progression.day.streak > 0 ? (
              <Flame className="size-3 text-orange-500" />
            ) : undefined
          }
        />
        <Figure
          label="Best streak"
          value={String(progression.records.bestSessionStreak)}
          hint={
            progression.day.best > 0
              ? `record of ${progression.day.best} ${
                  progression.day.best === 1 ? "day" : "days"
                }`
              : undefined
          }
          icon={<Trophy className="size-3 text-amber-500" />}
        />
        <Figure
          label="Confusions"
          value={String(pairs.length)}
          hint={`${activeCount} in targeted practice`}
        />
      </dl>

      <Tabs defaultValue="mastery">
        <TabsList>
          <TabsTrigger value="mastery">Mastery</TabsTrigger>
          <TabsTrigger value="pairs">Pairs</TabsTrigger>
          <TabsTrigger value="chars">Per character</TabsTrigger>
          <TabsTrigger value="heatmap">Confusion matrix</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
        </TabsList>

        <TabsContent value="mastery" className="mt-6">
          <MasteryMap stats={progress.charStats} />
        </TabsContent>

        <TabsContent value="pairs" className="mt-6 space-y-3">
          <SectionHeader
            title="Most confused pairs"
            description="Sorted by frequency. Click headers to reorder."
          />
          <ConfusionTable pairs={pairs} />
        </TabsContent>

        <TabsContent value="chars" className="mt-6 space-y-3">
          <SectionHeader
            title="Per-character detail"
            description="Worst first. Only shows ones you've practiced."
          />
          <CharStatsTable rows={rows} />
        </TabsContent>

        <TabsContent value="heatmap" className="mt-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <SectionHeader
              title="Confusion matrix"
              description={`The ${HEATMAP_LIMIT} characters with the most errors.`}
            />
            <Button
              variant={onlySelected ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlySelected((prev) => !prev)}
            >
              My selection only
            </Button>
          </div>
          <ConfusionHeatmap data={grid} />
        </TabsContent>

        <TabsContent value="groups" className="mt-6 space-y-3">
          <SectionHeader
            title="Confusion groups"
            description={`They activate on their own when you mix up the same characters ${settings.activationThreshold} times, and they're mastered with ${settings.graduationStreak} correct answers in a row.`}
          />
          <GroupsPanel
            groups={groups}
            graduationStreak={settings.graduationStreak}
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-0.5">
      <h2 className="text-base font-medium">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function Figure({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</dd>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
