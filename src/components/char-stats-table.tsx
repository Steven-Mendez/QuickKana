import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SortableHeader, nextSort } from "@/components/sortable-header"
import type { SortState } from "@/components/sortable-header"
import { cn } from "@/lib/utils"
import { formatMs, formatPercent } from "@/lib/stats"
import type { CharRow } from "@/lib/stats"

type Key = "accuracy" | "attempts" | "avgMs" | "romaji"

export function CharStatsTable({ rows }: { rows: Array<CharRow> }) {
  const { t } = useTranslation()
  const [sort, setSort] = useState<SortState<Key>>({
    key: "accuracy",
    direction: "asc",
  })

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const diff =
          sort.key === "romaji"
            ? a.romaji.localeCompare(b.romaji)
            : a[sort.key] - b[sort.key]
        return sort.direction === "asc" ? diff : -diff
      }),
    [rows, sort]
  )

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("charTable.empty")}
      </p>
    )
  }

  const onSort = (key: Key) => setSort((prev) => nextSort(prev, key, "asc"))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            label={t("charTable.character")}
            sortKey="romaji"
            sort={sort}
            onSort={onSort}
          />
          <SortableHeader
            label={t("charTable.accuracy")}
            sortKey="accuracy"
            sort={sort}
            onSort={onSort}
            className="text-end"
          />
          <SortableHeader
            label={t("charTable.attempts")}
            sortKey="attempts"
            sort={sort}
            onSort={onSort}
            className="text-end"
          />
          <SortableHeader
            label={t("charTable.time")}
            sortKey="avgMs"
            sort={sort}
            onSort={onSort}
            className="text-end"
          />
          <TableHead>{t("charTable.confusedWith")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              <span className="flex items-baseline gap-2">
                <span className="font-jp text-xl">{row.char}</span>
                <span className="text-xs text-muted-foreground">
                  {row.romaji}
                </span>
              </span>
            </TableCell>
            <TableCell
              className={cn(
                "text-end font-medium tabular-nums",
                row.accuracy < 0.6 && "text-destructive"
              )}
            >
              {formatPercent(row.accuracy)}
            </TableCell>
            <TableCell className="text-end text-muted-foreground tabular-nums">
              {row.attempts}
            </TableCell>
            <TableCell className="text-end text-muted-foreground tabular-nums">
              {formatMs(row.avgMs)}
            </TableCell>
            <TableCell>
              {row.topConfusion ? (
                <span className="flex items-baseline gap-1.5 text-sm">
                  <span className="font-jp text-lg">
                    {row.topConfusion.char}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    ×{row.topConfusion.count}
                    {row.confusionTotal > row.topConfusion.count &&
                      ` ${t("charTable.ofTotal", { total: row.confusionTotal })}`}
                  </span>
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
