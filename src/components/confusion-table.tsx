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
import { getKana } from "@/lib/kana"
import { formatPercent } from "@/lib/stats"
import type { ConfusionPair } from "@/lib/stats"

type Key = "count" | "share" | "shown"

export function ConfusionTable({ pairs }: { pairs: Array<ConfusionPair> }) {
  const { t } = useTranslation()
  const [sort, setSort] = useState<SortState<Key>>({
    key: "count",
    direction: "desc",
  })

  const rows = useMemo(() => {
    const sorted = [...pairs].sort((a, b) => {
      const diff =
        sort.key === "shown"
          ? (getKana(a.shownId)?.romaji ?? "").localeCompare(
              getKana(b.shownId)?.romaji ?? ""
            )
          : a[sort.key] - b[sort.key]
      return sort.direction === "asc" ? diff : -diff
    })
    return sorted
  }, [pairs, sort])

  if (pairs.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t("confusionTable.empty")}
      </p>
    )
  }

  const onSort = (key: Key) => setSort((prev) => nextSort(prev, key))

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHeader
            label={t("confusionTable.shown")}
            sortKey="shown"
            sort={sort}
            onSort={onSort}
          />
          <TableHead>{t("confusionTable.typed")}</TableHead>
          <SortableHeader
            label={t("confusionTable.times")}
            sortKey="count"
            sort={sort}
            onSort={onSort}
            className="text-end"
          />
          <SortableHeader
            label={t("confusionTable.share")}
            sortKey="share"
            sort={sort}
            onSort={onSort}
            className="text-end"
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((pair) => {
          const shown = getKana(pair.shownId)
          const answered = getKana(pair.answeredId)
          if (!shown || !answered) return null

          return (
            <TableRow key={`${pair.shownId}>${pair.answeredId}`}>
              <TableCell>
                <Glyph char={shown.char} romaji={shown.romaji} />
              </TableCell>
              <TableCell>
                <Glyph char={answered.char} romaji={answered.romaji} />
              </TableCell>
              <TableCell className="text-end font-medium tabular-nums">
                {pair.count}
              </TableCell>
              <TableCell className="text-end text-muted-foreground tabular-nums">
                {formatPercent(pair.share)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function Glyph({ char, romaji }: { char: string; romaji: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-jp text-xl">{char}</span>
      <span className="text-xs text-muted-foreground">{romaji}</span>
    </span>
  )
}
