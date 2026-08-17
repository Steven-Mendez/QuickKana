import { GraduationCap, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { displayPair } from "@/lib/kana"
import type { ConfusionGroup } from "@/lib/types"

interface GroupsPanelProps {
  groups: Array<ConfusionGroup>
  graduationStreak: number
}

export function GroupsPanel({ groups, graduationStreak }: GroupsPanelProps) {
  const active = groups.filter((group) => group.status === "active")
  const graduated = groups.filter((group) => group.status === "graduated")

  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No confusion groups detected yet. They appear when you confuse two
        characters with each other multiple times.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Target className="size-4" />
          In targeted practice
          <span className="text-muted-foreground">({active.length})</span>
        </h3>

        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None active right now.
          </p>
        ) : (
          <ul className="space-y-3">
            {active.map((group) => (
              <li key={group.id} className="space-y-1.5 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-jp text-lg">
                    {displayPair(group.members)}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {group.streak}/{graduationStreak} to master
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (group.streak / graduationStreak) * 100)}
                  className="h-1"
                />
                <p className="text-xs text-muted-foreground">
                  {group.totalMisses} mutual confusions
                  {group.timesActivated > 1 &&
                    ` · reactivated ${group.timesActivated} times`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {graduated.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <GraduationCap className="size-4" />
            Mastered
            <span className="text-muted-foreground">({graduated.length})</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {graduated.map((group) => (
              <Badge key={group.id} variant="outline" className="gap-1.5">
                <span className="font-jp text-sm">
                  {displayPair(group.members)}
                </span>
                {group.timesActivated > 1 && (
                  <span className="text-[10px] text-muted-foreground">
                    ×{group.timesActivated}
                  </span>
                )}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
