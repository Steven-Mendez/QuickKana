import { useMemo, useState } from "react"
import { useSelector } from "@tanstack/react-store"
import { Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { KanaGrid } from "@/components/kana-grid"
import {
  ALL_KANA,
  CATEGORY_IDS,
  ROWS_BY_SCRIPT,
  SCRIPTS,
  SCRIPT_LABELS,
} from "@/lib/kana"
import { charRows, formatPercent, mastery } from "@/lib/stats"
import { progressStore } from "@/stores/progress.store"
import {
  clearSelection,
  selectOnly,
  selectionStore,
  setMany,
  setTab,
  toggleKana,
} from "@/stores/selection.store"
import { cn } from "@/lib/utils"
import type { CharStat, Kana, KanaCategory, Script } from "@/lib/types"

/** Kana of a script+category, in table order. */
const cellsOf = (script: Script, category?: KanaCategory): Array<Kana> =>
  ALL_KANA.filter(
    (kana) =>
      kana.script === script && (!category || kana.category === category)
  )

const WORST_LIMIT = 12
const WORST_MIN_ATTEMPTS = 3

export function KanaSelector() {
  const { t } = useTranslation()
  const { enabled, lastTab } = useSelector(selectionStore, (s) => s)
  const progress = useSelector(progressStore, (s) => s)
  const [category, setCategory] = useState<KanaCategory>("gojuon")
  const [showMastery, setShowMastery] = useState(true)

  const hasProgress = Object.keys(progress.charStats).length > 0
  const script = lastTab
  const selectedCount = useMemo(
    () => ALL_KANA.filter((kana) => enabled[kana.id]).length,
    [enabled]
  )

  /**
   * The characters the user actually gets wrong, for the one preset the
   * confusion tracking makes possible. Needs a few attempts before a character
   * qualifies, so a single unlucky miss does not define the session.
   */
  const worst = useMemo(
    () =>
      charRows(progress)
        .filter((row) => row.attempts >= WORST_MIN_ATTEMPTS && row.accuracy < 1)
        .slice(0, WORST_LIMIT)
        .map((row) => row.id),
    [progress]
  )

  return (
    <Tabs value={script} onValueChange={(value) => setTab(value as Script)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList>
          {SCRIPTS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {SCRIPT_LABELS[tab]}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            <span className="font-medium text-foreground">{selectedCount}</span>{" "}
            {t("selector.selected")}
          </span>
          {selectedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              {t("selector.clear")}
            </Button>
          )}
        </div>
      </div>

      {/* Presets replace the whole selection — a starting point, not an
          additive filter, which is what makes them one click instead of two. */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Chip
          label={t("selector.presetBasics", { script: SCRIPT_LABELS[script] })}
          onClick={() =>
            selectOnly(cellsOf(script, "gojuon").map((kana) => kana.id))
          }
        />
        <Chip
          label={t("selector.presetDakuten")}
          onClick={() =>
            selectOnly(
              [...cellsOf(script, "gojuon"), ...cellsOf(script, "dakuten")].map(
                (kana) => kana.id
              )
            )
          }
        />
        <Chip
          label={t("selector.presetAll", { script: SCRIPT_LABELS[script] })}
          onClick={() => selectOnly(cellsOf(script).map((kana) => kana.id))}
        />
        <Chip
          label={t("selector.presetBoth")}
          onClick={() => selectOnly(ALL_KANA.map((kana) => kana.id))}
        />
        <Chip
          label={t("selector.presetWorst")}
          icon={<Sparkles className="size-3.5" />}
          disabled={worst.length === 0}
          title={
            worst.length === 0
              ? t("selector.worstDisabled")
              : t("selector.worstTitle", { count: worst.length })
          }
          onClick={() => selectOnly(worst)}
        />
      </div>

      {SCRIPTS.map((tab) => (
        <TabsContent key={tab} value={tab} className="mt-4">
          {/* One category at a time: stacking all three turned the selector
              into a page of scrolling before the user could press Practice. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORY_IDS.map((id) => {
              const cells = cellsOf(tab, id)
              const selected = cells.filter((cell) => enabled[cell.id]).length
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    category === id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t(`kana.category.${id}`)}
                  <span className="text-[11px] tabular-nums opacity-70">
                    {selected}/{cells.length}
                  </span>
                </button>
              )
            })}

            <div className="ms-auto flex items-center gap-1">
              <MasteryAverage
                ids={cellsOf(tab, category).map((cell) => cell.id)}
                stats={progress.charStats}
              />
              {/* Only worth offering once there is any progress to show. */}
              {hasProgress && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setShowMastery((prev) => !prev)}
                >
                  {showMastery
                    ? t("selector.showRomaji")
                    : t("selector.showMastery")}
                </Button>
              )}
              <SectionToggle
                ids={cellsOf(tab, category).map((cell) => cell.id)}
                enabled={enabled}
              />
            </div>
          </div>

          <div className="mt-3">
            <KanaGrid
              rows={ROWS_BY_SCRIPT[tab].filter(
                (row) => row.category === category
              )}
              enabled={enabled}
              stats={progress.charStats}
              showMastery={showMastery}
              onToggle={toggleKana}
              onToggleMany={setMany}
            />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** Mean mastery over a category, counting never-drilled kana as zero. */
function MasteryAverage({
  ids,
  stats,
}: {
  ids: Array<string>
  stats: Record<string, CharStat>
}) {
  const { t } = useTranslation()
  const average = useMemo(() => {
    if (ids.length === 0) return 0
    const total = ids.reduce((sum, id) => sum + (mastery(stats[id]) ?? 0), 0)
    return total / ids.length
  }, [ids, stats])

  if (average <= 0) return null

  return (
    <span
      className="text-xs text-muted-foreground tabular-nums"
      title={t("selector.avgTitle")}
    >
      {t("selector.learned", { percent: formatPercent(average) })}
    </span>
  )
}

function SectionToggle({
  ids,
  enabled,
}: {
  ids: Array<string>
  enabled: Record<string, boolean>
}) {
  const { t } = useTranslation()
  const allOn = ids.length > 0 && ids.every((id) => enabled[id])
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 text-xs"
      onClick={() => setMany(ids, !allOn)}
    >
      {allOn ? t("selector.removeAll") : t("selector.addAll")}
    </Button>
  )
}

function Chip({
  label,
  icon,
  onClick,
  disabled,
  title,
}: {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        "hover:border-primary/50 hover:bg-accent",
        "disabled:pointer-events-none disabled:opacity-40"
      )}
    >
      {icon}
      {label}
    </button>
  )
}
