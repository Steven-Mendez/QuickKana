import { useTranslation } from "react-i18next"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  CATEGORY_IDS,
  ROWS_BY_SCRIPT,
  SCRIPTS,
  SCRIPT_LABELS,
} from "@/lib/kana"
import {
  MASTERY_ATTEMPTS,
  formatDuration,
  formatPercent,
  mastery,
} from "@/lib/stats"
import { cn } from "@/lib/utils"
import type { CharStat, Kana, KanaRow } from "@/lib/types"

const cellsOf = (row: KanaRow): Array<Kana> =>
  row.cells.filter((cell): cell is Kana => cell !== null)

/**
 * The whole syllabary at a glance, tinted by how learned each character is.
 * The tables on this page answer "what did I get wrong"; this one answers the
 * question a learner actually asks first — how much of it do I know.
 */
export function MasteryMap({ stats }: { stats: Record<string, CharStat> }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <Legend />

      {SCRIPTS.map((script) => (
        <section key={script} className="space-y-3">
          <h3 className="text-sm font-medium">{SCRIPT_LABELS[script]}</h3>

          <div className="flex flex-wrap gap-x-8 gap-y-5">
            {CATEGORY_IDS.map((id) => {
              const rows = ROWS_BY_SCRIPT[script].filter(
                (row) => row.category === id
              )
              const cells = rows.flatMap(cellsOf)
              const average =
                cells.reduce(
                  (sum, cell) => sum + (mastery(stats[cell.id]) ?? 0),
                  0
                ) / Math.max(1, cells.length)

              return (
                <div key={id} className="space-y-1.5">
                  <p className="flex items-baseline gap-1.5 text-xs text-muted-foreground">
                    {t(`kana.category.${id}`)}
                    <span className="tabular-nums">
                      {formatPercent(average)}
                    </span>
                  </p>
                  <div className="space-y-1">
                    {rows.map((row) => (
                      <div key={row.id} className="flex gap-1">
                        {row.cells.map((cell, index) =>
                          cell ? (
                            <MasteryCell
                              key={cell.id}
                              kana={cell}
                              stat={stats[cell.id]}
                            />
                          ) : (
                            <span
                              key={`${row.id}-gap-${index}`}
                              className="size-8"
                              aria-hidden
                            />
                          )
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function MasteryCell({
  kana,
  stat,
}: {
  kana: Kana
  stat: CharStat | undefined
}) {
  const { t } = useTranslation()
  const level = mastery(stat)

  return (
    <Popover>
      <PopoverTrigger
        aria-label={`${kana.char} ${kana.romaji}`}
        className={cn(
          // transition-colors so a mastery change animates its tint shift.
          "flex size-8 cursor-pointer items-center justify-center rounded font-jp text-sm transition-colors duration-500 hover:ring-1 hover:ring-foreground/20",
          level === null && "bg-muted/40 text-muted-foreground/40"
        )}
        style={
          level === null
            ? undefined
            : {
                backgroundColor: `color-mix(in oklab, var(--color-emerald-500) ${Math.round(
                  12 + level * 78
                )}%, transparent)`,
              }
        }
      >
        {kana.char}
      </PopoverTrigger>
      <PopoverContent className="w-52">
        <div className="flex items-baseline gap-2">
          <span className="font-jp text-2xl">{kana.char}</span>
          <span className="text-muted-foreground">{kana.romaji}</span>
          <span className="ms-auto font-semibold tabular-nums">
            {level === null ? "—" : formatPercent(level)}
          </span>
        </div>
        {stat && stat.attempts > 0 ? (
          <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <dt>{t("masteryMap.correct")}</dt>
              <dd className="tabular-nums">
                {stat.correct}/{stat.attempts}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("masteryMap.bestStreak")}</dt>
              <dd className="tabular-nums">{stat.bestStreak}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("masteryMap.perAnswer")}</dt>
              <dd className="tabular-nums">
                {formatDuration(stat.totalMs / stat.attempts)}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("masteryMap.notYet")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Legend() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        {t("masteryMap.notPracticed")}
        <span className="size-3 rounded-sm bg-muted/40" />
      </span>
      <span className="flex items-center gap-1.5">
        {t("masteryMap.mastery")}
        {[0.15, 0.4, 0.65, 0.9].map((level) => (
          <span
            key={level}
            className="size-3 rounded-sm"
            style={{
              backgroundColor: `color-mix(in oklab, var(--color-emerald-500) ${Math.round(
                12 + level * 78
              )}%, transparent)`,
            }}
          />
        ))}
        100%
      </span>
      <span className="ms-auto">
        {t("masteryMap.legendNote", { count: MASTERY_ATTEMPTS })}
      </span>
    </div>
  )
}
