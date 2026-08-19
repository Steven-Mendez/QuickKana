import { ROWS_BY_SCRIPT, SCRIPTS, SCRIPT_LABELS } from "@/lib/kana"
import { MASTERY_ATTEMPTS, formatPercent, mastery } from "@/lib/stats"
import { cn } from "@/lib/utils"
import type { CharStat, Kana, KanaCategory, KanaRow } from "@/lib/types"

const CATEGORY_LABELS: Array<{ id: KanaCategory; label: string }> = [
  { id: "gojuon", label: "Basics" },
  { id: "dakuten", label: "Dakuten" },
  { id: "digraph", label: "Digraphs" },
]

const cellsOf = (row: KanaRow): Array<Kana> =>
  row.cells.filter((cell): cell is Kana => cell !== null)

/**
 * The whole syllabary at a glance, tinted by how learned each character is.
 * The tables on this page answer "what did I get wrong"; this one answers the
 * question a learner actually asks first — how much of it do I know.
 */
export function MasteryMap({ stats }: { stats: Record<string, CharStat> }) {
  return (
    <div className="space-y-6">
      <Legend />

      {SCRIPTS.map((script) => (
        <section key={script} className="space-y-3">
          <h3 className="text-sm font-medium">{SCRIPT_LABELS[script]}</h3>

          <div className="flex flex-wrap gap-x-8 gap-y-5">
            {CATEGORY_LABELS.map(({ id, label }) => {
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
                    {label}
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
  const level = mastery(stat)

  return (
    <span
      title={
        level === null
          ? `${kana.char} ${kana.romaji} — not practiced`
          : `${kana.char} ${kana.romaji} — ${formatPercent(level)} · ${
              stat?.correct
            }/${stat?.attempts} correct`
      }
      className={cn(
        "flex size-8 items-center justify-center rounded font-jp text-sm",
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
    </span>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        Not practiced
        <span className="size-3 rounded-sm bg-muted/40" />
      </span>
      <span className="flex items-center gap-1.5">
        Mastery
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
        A character reaches 100% with {MASTERY_ATTEMPTS} correct answers in a
        row.
      </span>
    </div>
  )
}
