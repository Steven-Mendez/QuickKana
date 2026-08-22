import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"
import { Flame, Trophy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { NumberTicker } from "@/components/ui/number-ticker"
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
  const { t } = useTranslation()
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
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("stats.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("stats.subtitle")}</p>
      </header>

      {/* One strip instead of a row of cards: these are reference numbers, and
          six bordered boxes made them look more important than the tables. */}
      <dl className="flex flex-wrap gap-x-8 gap-y-4 border-y py-4">
        <Figure
          label={t("stats.mastery")}
          value={<Percent value={overallMastery(progress.charStats)} />}
          hint={t("stats.masteredOf", { mastered, total: TOTAL_KANA })}
        />
        <Figure
          label={t("stats.accuracy")}
          value={accuracy === null ? "—" : <Percent value={accuracy} />}
          hint={t("stats.attemptsHint", { count: progress.totals.attempts })}
        />
        <Figure
          label={t("stats.sessions")}
          value={<NumberTicker value={progress.totals.sessions} />}
          hint={
            progression.day.streak > 0
              ? t("stats.daysInARow", { count: progression.day.streak })
              : undefined
          }
          icon={
            progression.day.streak > 0 ? (
              <Flame className="size-3 text-orange-500" />
            ) : undefined
          }
        />
        <Figure
          label={t("stats.bestStreak")}
          value={<NumberTicker value={progression.records.bestSessionStreak} />}
          hint={
            progression.day.best > 0
              ? t("stats.recordDays", { count: progression.day.best })
              : undefined
          }
          icon={<Trophy className="size-3 text-amber-500" />}
        />
        <Figure
          label={t("stats.confusions")}
          value={<NumberTicker value={pairs.length} />}
          hint={t("stats.inTargeted", { count: activeCount })}
        />
      </dl>

      <Tabs defaultValue="mastery">
        <TabsList>
          <TabsTrigger value="mastery">{t("stats.tabMastery")}</TabsTrigger>
          <TabsTrigger value="pairs">{t("stats.tabPairs")}</TabsTrigger>
          <TabsTrigger value="chars">{t("stats.tabChars")}</TabsTrigger>
          <TabsTrigger value="heatmap">{t("stats.tabHeatmap")}</TabsTrigger>
          <TabsTrigger value="groups">{t("stats.tabGroups")}</TabsTrigger>
        </TabsList>

        <TabsContent value="mastery" className="mt-6">
          <MasteryMap stats={progress.charStats} />
        </TabsContent>

        <TabsContent value="pairs" className="mt-6 space-y-3">
          <SectionHeader
            title={t("stats.pairsTitle")}
            description={t("stats.pairsDesc")}
          />
          <ConfusionTable pairs={pairs} />
        </TabsContent>

        <TabsContent value="chars" className="mt-6 space-y-3">
          <SectionHeader
            title={t("stats.charsTitle")}
            description={t("stats.charsDesc")}
          />
          <CharStatsTable rows={rows} />
        </TabsContent>

        <TabsContent value="heatmap" className="mt-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <SectionHeader
              title={t("stats.heatmapTitle")}
              description={t("stats.heatmapDesc", { count: HEATMAP_LIMIT })}
            />
            <Button
              variant={onlySelected ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlySelected((prev) => !prev)}
            >
              {t("stats.onlySelected")}
            </Button>
          </div>
          <ConfusionHeatmap data={grid} />
        </TabsContent>

        <TabsContent value="groups" className="mt-6 space-y-3">
          <SectionHeader
            title={t("stats.groupsTitle")}
            description={t("stats.groupsDesc", {
              activation: settings.activationThreshold,
              graduation: settings.graduationStreak,
            })}
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

/** A percentage KPI that counts up on entry. */
function Percent({ value }: { value: number }) {
  return (
    <>
      <NumberTicker value={Math.round(value * 100)} />%
    </>
  )
}

function Figure({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: React.ReactNode
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
