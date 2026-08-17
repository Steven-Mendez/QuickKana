import { formatPercent, mastery } from "@/lib/stats"
import { cn } from "@/lib/utils"
import type { CharStat, Kana, KanaRow } from "@/lib/types"

interface KanaGridProps {
  rows: Array<KanaRow>
  enabled: Record<string, boolean>
  stats: Record<string, CharStat>
  /** Swaps the sub-label from rōmaji to the mastery percentage. */
  showMastery: boolean
  onToggle: (id: string) => void
  onToggleMany: (ids: Array<string>, enabled: boolean) => void
}

/** Colour ramp for the mastery bar — red while shaky, green once solid. */
export function masteryClass(value: number): string {
  if (value >= 0.8) return "bg-emerald-500"
  if (value >= 0.5) return "bg-amber-500"
  return "bg-destructive"
}

const cellsOf = (row: KanaRow): Array<Kana> =>
  row.cells.filter((cell): cell is Kana => cell !== null)

/**
 * The classical kana table: vowel columns across the top, consonant rows down
 * the side. Both headers are toggles, so a learner can take "the whole さ row"
 * or "every -u sound" in one click instead of tapping five cells.
 *
 * Eleven stacked rows make the selector a scrolling chore, so on wide screens
 * the table is dealt into two side-by-side blocks that fit in one screen.
 */
export function KanaGrid({
  rows,
  enabled,
  stats,
  showMastery,
  onToggle,
  onToggleMany,
}: KanaGridProps) {
  if (rows.length === 0) return null

  const half = Math.ceil(rows.length / 2)
  const blocks =
    rows.length >= 6 ? [rows.slice(0, half), rows.slice(half)] : [rows]

  return (
    <div
      className={cn(
        "grid gap-x-8 gap-y-4",
        blocks.length > 1 && "lg:grid-cols-2"
      )}
    >
      {blocks.map((block, index) => (
        <TableBlock
          key={index}
          rows={block}
          enabled={enabled}
          stats={stats}
          showMastery={showMastery}
          onToggle={onToggle}
          onToggleMany={onToggleMany}
        />
      ))}
    </div>
  )
}

function TableBlock({
  rows,
  enabled,
  stats,
  showMastery,
  onToggle,
  onToggleMany,
}: KanaGridProps) {
  const first = rows[0]
  if (!first) return null

  // Every row inside one category shares the same column headers, so the
  // header strip is built once from the first row.
  const columns = first.columns
  const template = `2.25rem repeat(${columns.length}, minmax(0, 1fr))`

  const columnCells = (index: number) =>
    rows.map((row) => row.cells[index]).filter((cell): cell is Kana => !!cell)

  return (
    <div>
      <div className="grid gap-1" style={{ gridTemplateColumns: template }}>
        <span aria-hidden />
        {columns.map((column, index) => {
          const cells = columnCells(index)
          const on = cells.length > 0 && cells.every((cell) => enabled[cell.id])
          return (
            <HeaderButton
              key={column}
              label={column}
              active={on}
              title={on ? `Remove column ${column}` : `Add column ${column}`}
              onClick={() =>
                onToggleMany(
                  cells.map((cell) => cell.id),
                  !on
                )
              }
            />
          )
        })}
      </div>

      <div className="mt-1 space-y-1">
        {rows.map((row) => {
          const cells = cellsOf(row)
          const rowOn = cells.every((cell) => enabled[cell.id])

          return (
            <div
              key={row.id}
              className="grid gap-1"
              style={{ gridTemplateColumns: template }}
            >
              <HeaderButton
                label={row.shortLabel}
                active={rowOn}
                title={
                  rowOn ? `Remove row ${row.label}` : `Add row ${row.label}`
                }
                onClick={() =>
                  onToggleMany(
                    cells.map((cell) => cell.id),
                    !rowOn
                  )
                }
              />

              {row.cells.map((cell, index) =>
                cell ? (
                  <KanaCell
                    key={cell.id}
                    kana={cell}
                    selected={!!enabled[cell.id]}
                    stat={stats[cell.id]}
                    showMastery={showMastery}
                    onToggle={onToggle}
                  />
                ) : (
                  <div key={`${row.id}-gap-${index}`} aria-hidden />
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function KanaCell({
  kana,
  selected,
  stat,
  showMastery,
  onToggle,
}: {
  kana: Kana
  selected: boolean
  stat: CharStat | undefined
  showMastery: boolean
  onToggle: (id: string) => void
}) {
  const level = mastery(stat)
  const label =
    showMastery && level !== null ? formatPercent(level) : kana.romaji

  return (
    <button
      type="button"
      onClick={() => onToggle(kana.id)}
      aria-pressed={selected}
      aria-label={`${kana.char} — ${kana.romaji}${
        level === null ? "" : `, ${formatPercent(level)} mastery`
      }`}
      title={
        level === null
          ? `${kana.romaji} — not practiced`
          : `${kana.romaji} — ${formatPercent(level)} mastery · ${stat?.attempts} attempts`
      }
      className={cn(
        "relative flex h-11 flex-col items-center justify-center overflow-hidden rounded-md border transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        // Selected reads as "lit", unselected as "off": at 46 cells a full
        // primary fill is overwhelming, but a border alone disappears.
        selected
          ? "border-primary/70 bg-primary/15 text-foreground"
          : "border-transparent bg-muted/25 text-muted-foreground/40 hover:bg-accent hover:text-foreground"
      )}
    >
      <span className="font-jp text-lg leading-none">{kana.char}</span>
      <span
        className={cn(
          "mt-0.5 text-[10px] leading-none tabular-nums",
          showMastery && level !== null
            ? "text-foreground/70"
            : selected
              ? "text-muted-foreground"
              : "text-muted-foreground/40"
        )}
      >
        {label}
      </span>

      {/* Always visible, percentage or not: the bar is what makes a whole row
          of half-learned characters obvious at a glance. */}
      {level !== null && (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 bottom-0 h-[3px] origin-left transition-transform",
            masteryClass(level)
          )}
          style={{ transform: `scaleX(${level})` }}
        />
      )}
    </button>
  )
}

function HeaderButton({
  label,
  active,
  title,
  onClick,
}: {
  label: string
  active: boolean
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-center rounded-md font-mono text-[11px] transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground/60 hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
    </button>
  )
}
