import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export type SortDirection = "asc" | "desc"

export interface SortState<TKey extends string> {
  key: TKey
  direction: SortDirection
}

/** Flips direction when re-clicking the active column, else adopts `initial`. */
export function nextSort<TKey extends string>(
  current: SortState<TKey>,
  key: TKey,
  initial: SortDirection = "desc"
): SortState<TKey> {
  if (current.key !== key) return { key, direction: initial }
  return { key, direction: current.direction === "asc" ? "desc" : "asc" }
}

interface SortableHeaderProps<TKey extends string> {
  label: string
  sortKey: TKey
  sort: SortState<TKey>
  onSort: (key: TKey) => void
  className?: string
}

export function SortableHeader<TKey extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: SortableHeaderProps<TKey>) {
  const active = sort.key === sortKey
  const Icon = !active
    ? ChevronsUpDown
    : sort.direction === "asc"
      ? ArrowUp
      : ArrowDown

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-sort={
          active
            ? sort.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }
        className={cn(
          "inline-flex items-center gap-1 rounded-sm transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        <Icon className="size-3" />
      </button>
    </TableHead>
  )
}
