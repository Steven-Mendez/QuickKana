import type { Heatmap } from "@/lib/stats"

/**
 * Confusion intensity as a plain CSS grid — rows are the character shown,
 * columns the character the user answered. No chart library involved: the data
 * is a small integer matrix and opacity carries it fine.
 *
 * Cell labels use the native `title` attribute rather than a Tooltip component:
 * a 15×15 grid would otherwise mount 225 popup instances for a one-line label.
 */
export function ConfusionHeatmap({ data }: { data: Heatmap }) {
  if (data.ids.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No confusion records yet.
      </p>
    )
  }

  // Capped rather than `1fr`: with only a couple of characters recorded, a
  // fractional track would blow each cell up to a quarter of the card.
  const columns = `2rem repeat(${data.ids.length}, minmax(1.5rem, 2.25rem))`

  return (
    <div className="overflow-x-auto">
      <div className="min-w-fit space-y-1">
        <div className="grid gap-1" style={{ gridTemplateColumns: columns }}>
          <div aria-hidden />
          {data.chars.map((char, index) => (
            <div
              key={data.ids[index]}
              className="text-center font-jp text-xs leading-6 text-muted-foreground"
            >
              {char}
            </div>
          ))}
        </div>

        {data.cells.map((row, rowIndex) => (
          <div
            key={data.ids[rowIndex]}
            className="grid gap-1"
            style={{ gridTemplateColumns: columns }}
          >
            <div className="font-jp text-xs leading-7 text-muted-foreground">
              {data.chars[rowIndex]}
            </div>

            {row.map((count, colIndex) => {
              const diagonal = rowIndex === colIndex
              const intensity = data.max > 0 ? count / data.max : 0

              return (
                <div
                  key={data.ids[colIndex]}
                  className="aspect-square rounded-sm border border-border/40"
                  title={
                    diagonal
                      ? data.chars[rowIndex]
                      : `${data.chars[rowIndex]} read as ${data.chars[colIndex]}: ${count}`
                  }
                  style={{
                    backgroundColor: diagonal
                      ? "var(--muted)"
                      : count > 0
                        ? `color-mix(in oklab, var(--destructive) ${Math.round(
                            20 + intensity * 80
                          )}%, transparent)`
                        : "transparent",
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Row = character shown · Column = what you typed.
      </p>
    </div>
  )
}
