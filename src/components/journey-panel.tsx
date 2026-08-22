import { useMemo } from "react"
import { useSelector } from "@tanstack/react-store"
import { AnimatePresence, motion } from "motion/react"
import { useTranslation } from "react-i18next"
import { Check, Lock } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import {
  RETENTION,
  TRACKS,
  holdsUp,
  isMastered,
  lastLessonOf,
  lessonAt,
  lessonPhase,
  lessonProgress,
  retention,
  trackProgress,
} from "@/lib/journey"
import { SCRIPTS, SCRIPT_LABELS, getKana } from "@/lib/kana"
import { formatPercent, mastery } from "@/lib/stats"
import { progressStore } from "@/stores/progress.store"
import {
  lessonOf,
  progressionStore,
  setTrack,
} from "@/stores/progression.store"
import { masteryClass } from "@/components/kana-grid"
import { cn } from "@/lib/utils"
import type { CharStat, Script } from "@/lib/types"

/**
 * The guided mode: the user never picks characters, the curriculum does. This
 * panel exists to answer the two questions that replaces — what am I learning
 * right now, and how far along am I.
 */
export function JourneyPanel() {
  const { t } = useTranslation()
  const progression = useSelector(progressionStore, (s) => s)
  const charStats = useSelector(progressStore, (s) => s.charStats)

  const track = progression.track
  const lesson = lessonOf(progression, track)
  const current = lessonAt(track, lesson)

  const progress = useMemo(
    () => lessonProgress(current, charStats),
    [current, charStats]
  )
  const overall = useMemo(
    () => trackProgress(track, lesson, charStats),
    [track, lesson, charStats]
  )

  const finished =
    lesson >= lastLessonOf(track) && progress.pending.length === 0

  return (
    <div className="space-y-6">
      {/* Two separate curricula: courses disagree about which syllabary comes
          first, so switching tracks never costs progress on the other. */}
      <div className="flex flex-wrap gap-2">
        {SCRIPTS.map((script) => (
          <TrackButton
            key={script}
            script={script}
            active={script === track}
            lesson={lessonOf(progression, script)}
            charStats={charStats}
            onSelect={() => setTrack(script)}
          />
        ))}
      </div>

      <section
        data-tour="current-lesson"
        className="rounded-xl border bg-card p-5"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              {finished
                ? t("journey.complete", { script: SCRIPT_LABELS[track] })
                : t("journey.lessonOf", {
                    number: lesson + 1,
                    total: TRACKS[track].length,
                  })}
            </p>
            <h2 className="mt-0.5 text-lg font-semibold">
              {SCRIPT_LABELS[track]} · {current.label}
            </h2>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            <span className="font-medium text-foreground">
              {progress.mastered.length}
            </span>
            /{current.ids.length} {t("journey.mastered")}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {current.ids.map((id) => (
            <LessonChar key={id} id={id} stat={charStats[id]} />
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          {finished
            ? t("journey.explainFinished")
            : lessonPhase(current, charStats) === "focus"
              ? t("journey.explainFocus")
              : t("journey.explainMix")}
        </p>
      </section>

      {!finished && lesson > 0 && (
        <RetentionSection
          track={track}
          lesson={lesson}
          charStats={charStats}
          lessonDone={progress.pending.length === 0}
        />
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <h3 className="font-medium">
            {t("journey.progressIn", { script: SCRIPT_LABELS[track] })}
          </h3>
          <p className="text-muted-foreground tabular-nums">
            {t("journey.charsOf", {
              mastered: overall.mastered,
              total: overall.total,
              percent: formatPercent(overall.mastered / overall.total),
            })}
          </p>
        </div>
        <Progress value={(overall.mastered / overall.total) * 100} />
        <p className="text-xs text-muted-foreground">
          {t("journey.unlockedSoFar", { count: overall.unlocked })}
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs tracking-wide text-muted-foreground uppercase">
          {t("journey.stripTitle")}
        </h3>
        {/* Every lesson at a glance: done, current, still locked. */}
        <div className="flex flex-wrap gap-1">
          {TRACKS[track].map((item) => {
            const done = item.index < lesson
            const isCurrent = item.index === lesson
            const ratio = lessonProgress(item, charStats).ratio
            const state = done ? "done" : isCurrent ? "current" : "locked"
            return (
              <span
                key={item.id}
                title={
                  done || isCurrent
                    ? t("journey.stripMastered", {
                        label: item.label,
                        percent: formatPercent(ratio),
                      })
                    : t("journey.stripLocked", { label: item.label })
                }
                className={cn(
                  "relative flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-[11px]",
                  isCurrent && "bg-primary text-primary-foreground",
                  done &&
                    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                  !done && !isCurrent && "bg-muted/40 text-muted-foreground/40"
                )}
              >
                {/* A quiet "you are here": the strip shows twenty near-identical
                    chips and the current one has to be findable at a glance. */}
                {isCurrent && (
                  <span
                    aria-hidden
                    className="absolute -inset-0.5 animate-pulse rounded-md ring-2 ring-primary/40 motion-reduce:animate-none"
                  />
                )}
                {/* Keyed by state so the lock flips into the kana exactly when
                    a lesson unlocks, and never on ordinary re-renders. */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={state}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center justify-center"
                  >
                    {done ? (
                      <Check className="size-3.5" />
                    ) : isCurrent ? (
                      <span className="font-jp">{item.chars[0]}</span>
                    ) : (
                      <Lock className="size-3" />
                    )}
                  </motion.span>
                </AnimatePresence>
              </span>
            )
          })}
        </div>
      </section>
    </div>
  )
}

/** How many slipped characters to name before the list stops being readable. */
const SLIPPED_SHOWN = 8

/**
 * The second gate on the next lesson: what you have already learned has to
 * still be there. It only earns a place on screen once there *is* something
 * behind the current lesson to forget, and it says which characters slipped —
 * "keep your reviews up" is advice nobody can act on.
 */
function RetentionSection({
  track,
  lesson,
  charStats,
  lessonDone,
}: {
  track: Script
  lesson: number
  charStats: Record<string, CharStat>
  lessonDone: boolean
}) {
  const { t } = useTranslation()
  const value = useMemo(
    () => retention(track, lesson, charStats),
    [track, lesson, charStats]
  )
  const ok = holdsUp(value)

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <h3 className="font-medium">{t("journey.retentionTitle")}</h3>
        <p
          className={cn(
            "tabular-nums",
            ok
              ? "text-muted-foreground"
              : "font-medium text-amber-600 dark:text-amber-400"
          )}
        >
          {t("journey.retentionSolid", {
            held: value.held,
            total: value.total,
          })}
        </p>
      </div>

      <Progress value={value.ratio * 100} />

      {value.slipped.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {value.slipped.slice(0, SLIPPED_SHOWN).map((id) => (
            <span
              key={id}
              title={t("journey.charTitle", {
                romaji: getKana(id)?.romaji,
                percent: formatPercent(mastery(charStats[id]) ?? 0),
              })}
              className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-jp text-sm text-amber-600 dark:text-amber-400"
            >
              {getKana(id)?.char}
            </span>
          ))}
          {value.slipped.length > SLIPPED_SHOWN && (
            <span className="text-xs text-muted-foreground tabular-nums">
              +{value.slipped.length - SLIPPED_SHOWN}
            </span>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {ok
          ? t("journey.retentionOk", { percent: formatPercent(RETENTION) })
          : lessonDone
            ? t("journey.retentionWaiting")
            : t("journey.retentionSlipped", {
                percent: formatPercent(RETENTION),
              })}
      </p>
    </section>
  )
}

function TrackButton({
  script,
  active,
  lesson,
  charStats,
  onSelect,
}: {
  script: Script
  active: boolean
  lesson: number
  charStats: Record<string, CharStat>
  onSelect: () => void
}) {
  const { t } = useTranslation()
  const progress = trackProgress(script, lesson, charStats)
  const ratio = progress.mastered / progress.total

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex-1 basis-40 rounded-lg border p-3 text-start transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active
          ? "border-primary/60 bg-primary/5"
          : "text-muted-foreground hover:bg-accent/50"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {SCRIPT_LABELS[script]}
        </span>
        <span className="text-xs tabular-nums">{formatPercent(ratio)}</span>
      </div>
      <p className="mt-0.5 text-xs">
        {t("journey.lessonOf", {
          number: lesson + 1,
          total: TRACKS[script].length,
        })}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${ratio * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 24 }}
        />
      </div>
    </button>
  )
}

function LessonChar({ id, stat }: { id: string; stat: CharStat | undefined }) {
  const { t } = useTranslation()
  const kana = getKana(id)
  if (!kana) return null

  const level = mastery(stat) ?? 0
  const done = isMastered(stat)

  return (
    <div
      className={cn(
        "relative w-16 overflow-hidden rounded-lg border px-2 py-2 text-center",
        done ? "border-emerald-500/40 bg-emerald-500/5" : "bg-muted/30"
      )}
      title={t("journey.charTitle", {
        romaji: kana.romaji,
        percent: formatPercent(level),
      })}
    >
      <div className="font-jp text-2xl leading-none">{kana.char}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        {kana.romaji}
      </div>
      <motion.span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-[3px] origin-left",
          masteryClass(level)
        )}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: level }}
        transition={{ type: "spring", stiffness: 120, damping: 24 }}
      />
    </div>
  )
}
