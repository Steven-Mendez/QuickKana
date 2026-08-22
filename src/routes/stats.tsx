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
  mastery,
  overallMastery,
  TOTAL_KANA,
} from "@/lib/stats"
import { ALL_KANA } from "@/lib/kana"
import { isWritable } from "@/lib/kana/strokes"
import { progressStore } from "@/stores/progress.store"
import { progressionStore } from "@/stores/progression.store"
import { selectedIds, selectionStore } from "@/stores/selection.store"
import { settingsStore } from "@/stores/settings.store"
import { writingStore } from "@/stores/writing.store"

export const Route = createFileRoute("/stats")({ component: Stats })

const HEATMAP_LIMIT = 15

function Stats() {
  const { t } = useTranslation()
  const progress = useSelector(progressStore, (s) => s)
  const settings = useSelector(settingsStore, (s) => s)
  const selection = useSelector(selectionStore, (s) => s)
  const progression = useSelector(progressionStore, (s) => s)
  const writing = useSelector(writingStore, (s) => s)
  const [onlySelected, setOnlySelected] = useState(false)

  // Which exercise's numbers the page shows. Confusion data only exists for
  // reading, so the write view narrows the tabs down to the mastery map.
  const [statsMode, setStatsMode] = useState<"read" | "write">("read")
  const [tab, setTab] = useState("mastery")
  const isWrite = statsMode === "write"

  const pairs = useMemo(() => confusionPairs(progress), [progress])
  const rows = useMemo(() => charRows(progress), [progress])
  const groups = useMemo(
    () => Object.values(progress.groups),
    [progress.groups]
  )
  const activeCharStats = isWrite ? writing.charStats : progress.charStats
  const activeTotals = isWrite ? writing.totals : progress.totals

  const mastered = useMemo(
    () => masteredCount(activeCharStats, LESSON_MASTERY),
    [activeCharStats]
  )

  // The Write pool excludes digraphs, so its mastery ratio and its "out of N"
  // are measured against the writable characters only — otherwise the KPI
  // could never reach 100%.
  const writable = useMemo(() => ALL_KANA.filter(isWritable), [])
  const writeMastery = useMemo(
    () =>
      writable.reduce(
        (sum, kana) => sum + (mastery(writing.charStats[kana.id]) ?? 0),
        0
      ) / Math.max(1, writable.length),
    [writable, writing.charStats]
  )

  const strokeErrors = useMemo(
    () =>
      Object.values(writing.charStats).reduce(
        (sum, stat) => sum + stat.strokeMistakes,
        0
      ),
    [writing.charStats]
  )

  const grid = useMemo(() => {
    const restrictTo = onlySelected
      ? new Set(selectedIds(selection))
      : undefined
    return heatmap(progress, HEATMAP_LIMIT, restrictTo)
  }, [progress, onlySelected, selection])

  const accuracy =
    activeTotals.attempts > 0
      ? activeTotals.correct / activeTotals.attempts
      : null

  const activeCount = groups.filter((group) => group.status === "active").length

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("stats.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("stats.subtitle")}</p>
        </div>

        {/* Every figure below follows this switch. */}
        <Tabs
          value={statsMode}
          onValueChange={(value) => setStatsMode(value as "read" | "write")}
        >
          <TabsList aria-label={t("home.drillModeLabel")}>
            <TabsTrigger value="read">{t("home.tabRead")}</TabsTrigger>
            <TabsTrigger value="write">{t("home.tabWrite")}</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* One strip instead of a row of cards: these are reference numbers, and
          six bordered boxes made them look more important than the tables. */}
      <dl className="flex flex-wrap gap-x-8 gap-y-4 border-y py-4">
        <Figure
          label={t("stats.mastery")}
          value={
            <Percent
              value={isWrite ? writeMastery : overallMastery(activeCharStats)}
            />
          }
          hint={t("stats.masteredOf", {
            mastered,
            total: isWrite ? writable.length : TOTAL_KANA,
          })}
        />
        <Figure
          label={t("stats.accuracy")}
          value={accuracy === null ? "—" : <Percent value={accuracy} />}
          hint={t("stats.attemptsHint", { count: activeTotals.attempts })}
        />
        <Figure
          label={t("stats.sessions")}
          value={<NumberTicker value={activeTotals.sessions} />}
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
        {isWrite ? (
          <Figure
            label={t("stats.strokeErrors")}
            value={<NumberTicker value={strokeErrors} />}
            hint={t("stats.strokeErrorsHint")}
          />
        ) : (
          <Figure
            label={t("stats.confusions")}
            value={<NumberTicker value={pairs.length} />}
            hint={t("stats.inTargeted", { count: activeCount })}
          />
        )}
      </dl>

      <Tabs value={isWrite ? "mastery" : tab} onValueChange={setTab}>
        <div className="flex flex-wrap items-center gap-3">
          <TabsList>
            <TabsTrigger value="mastery">{t("stats.tabMastery")}</TabsTrigger>
            {/* Confusion tracking is a reading concept; in the write view
                these tabs would only ever show reading data, so they go. */}
            {!isWrite && (
              <>
                <TabsTrigger value="pairs">{t("stats.tabPairs")}</TabsTrigger>
                <TabsTrigger value="chars">{t("stats.tabChars")}</TabsTrigger>
                <TabsTrigger value="heatmap">
                  {t("stats.tabHeatmap")}
                </TabsTrigger>
                <TabsTrigger value="groups">{t("stats.tabGroups")}</TabsTrigger>
              </>
            )}
          </TabsList>
          {isWrite && (
            <p className="text-xs text-muted-foreground">
              {t("stats.writeOnlyNote")}
            </p>
          )}
        </div>

        <TabsContent value="mastery" className="mt-6">
          <MasteryMap stats={activeCharStats} hideDigraphs={isWrite} />
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
