import { GraduationCap, Target } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { displayPair } from "@/lib/kana"
import type { ConfusionGroup } from "@/lib/types"

interface GroupsPanelProps {
  groups: Array<ConfusionGroup>
  graduationStreak: number
}

export function GroupsPanel({ groups, graduationStreak }: GroupsPanelProps) {
  const { t } = useTranslation()
  const active = groups.filter((group) => group.status === "active")
  const graduated = groups.filter((group) => group.status === "graduated")

  if (groups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t("groups.empty")}
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Target className="size-4" />
          {t("groups.targeted")}
          <span className="text-muted-foreground">({active.length})</span>
        </h3>

        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("groups.noneActive")}
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
                    {t("groups.toMaster", {
                      streak: group.streak,
                      total: graduationStreak,
                    })}
                  </span>
                </div>
                <Progress
                  value={Math.min(100, (group.streak / graduationStreak) * 100)}
                  className="h-1"
                />
                <p className="text-xs text-muted-foreground">
                  {t("groups.misses", { count: group.totalMisses })}
                  {group.timesActivated > 1 &&
                    t("groups.reactivated", { count: group.timesActivated })}
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
            {t("groups.mastered")}
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
