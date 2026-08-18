import { useEffect, useRef, useState } from "react"
import { Check, Flame, Target, TimerOff, Trophy, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { displayPair } from "@/lib/kana"
import { milestoneAt, streakTier } from "@/lib/pressure"
import { cn } from "@/lib/utils"
import type { ConfusionGroup, Kana, SessionState, Settings } from "@/lib/types"

interface DrillCardProps {
  kana: Kana
  session: SessionState
  settings: Settings
  activeGroup: ConfusionGroup | null
  /** Milliseconds allowed for this character, or `null` with the clock off. */
  limitMs: number | null
  /** Longest run of correct answers ever, so a new record can be called out. */
  recordStreak: number
  onInput: (value: string) => void
  onSubmit: () => void
}

/**
 * The drill deliberately has no card around it: at this size the character is
 * the interface, and a border competing with it only adds noise to the one
 * thing the user is supposed to be reading.
 */
export function DrillCard({
  kana,
  session,
  settings,
  activeGroup,
  limitMs,
  recordStreak,
  onInput,
  onSubmit,
}: DrillCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  // Refocus on every new character: the drill is keyboard-only, so the caret
  // must survive the button clicks and phase changes in between.
  useEffect(() => {
    inputRef.current?.focus()
  }, [session.current?.id, session.phase])

  const isCorrect = session.phase === "correct"
  const isRetry = session.phase === "retry"

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-7">
      {/* Pinned to the drill column rather than the viewport: at the edge of a
          wide screen the counter is out of the field of view entirely. */}
      <StreakCounter streak={session.streak} record={recordStreak} />

      <div className="flex h-7 items-center">
        {session.introducing ? (
          <NewCharacterHint romaji={kana.romaji} />
        ) : (
          settings.showGroupHint &&
          activeGroup && (
            <GroupHint
              group={activeGroup}
              graduationStreak={settings.graduationStreak}
            />
          )
        )}
      </div>

      <div
        className={cn(
          "kana-display font-jp text-[7rem] leading-none transition-colors duration-200 sm:text-[10rem]",
          isCorrect && "text-emerald-600 dark:text-emerald-400",
          isRetry && "text-destructive"
        )}
        lang="ja"
      >
        {kana.char}
      </div>

      <div className="flex w-full max-w-[15rem] flex-col items-center gap-3">
        {/* Fixed slot: the countdown vanishing on a miss must not shove the
            character up the screen. Keyed on the prompt so the clock restarts. */}
        {limitMs !== null && (
          <div className="flex h-4 w-full items-center">
            {session.phase === "prompt" && (
              <Countdown
                key={`${session.current?.id}-${session.shownAt}`}
                limitMs={limitMs}
              />
            )}
          </div>
        )}

        <Input
          ref={inputRef}
          value={session.input}
          onChange={(event) => onInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              onSubmit()
            }
          }}
          readOnly={isCorrect}
          placeholder={session.introducing ? kana.romaji : "rōmaji"}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`Rōmaji for ${kana.char}`}
          className={cn(
            "h-12 border-0 border-b-2 bg-transparent text-center text-xl tracking-wide shadow-none dark:bg-transparent",
            "rounded-none focus-visible:ring-0",
            isCorrect
              ? "border-b-emerald-500 text-emerald-600 dark:text-emerald-400"
              : isRetry
                ? "border-b-destructive text-destructive"
                : "border-b-border focus-visible:border-b-primary"
          )}
        />

        {/* Reserved height: the answer must not jump when feedback appears. */}
        <div className="h-5 text-sm">
          {isCorrect && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" />
              {kana.romaji}
            </span>
          )}
          {isRetry && (
            <span className="flex items-center gap-1.5 text-destructive">
              {session.timedOut ? (
                <>
                  <TimerOff className="size-4" />
                  Time's up —{" "}
                  <strong className="font-semibold">{kana.romaji}</strong>
                </>
              ) : (
                <>
                  <X className="size-4" />
                  It was{" "}
                  <strong className="font-semibold">{kana.romaji}</strong> —
                  type it to continue
                </>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Fraction of the clock left before the bar starts shouting. */
const URGENT_AT = 0.35

/**
 * The pressure. Redrawing it is deliberately isolated from the rest of the
 * drill: it ticks four times a second and nothing else should re-render with it.
 */
function Countdown({ limitMs }: { limitMs: number }) {
  const [remaining, setRemaining] = useState(limitMs)

  useEffect(() => {
    const startedAt = Date.now()
    const id = setInterval(() => {
      setRemaining(Math.max(0, limitMs - (Date.now() - startedAt)))
    }, 50)
    return () => clearInterval(id)
  }, [limitMs])

  const ratio = remaining / limitMs
  const urgent = ratio <= URGENT_AT

  return (
    <div className="flex w-full items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full origin-left rounded-full",
            urgent ? "bg-destructive" : "bg-primary",
            urgent && "animate-pulse"
          )}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      <span
        className={cn(
          "w-8 text-end text-xs tabular-nums",
          urgent ? "font-medium text-destructive" : "text-muted-foreground"
        )}
      >
        {(remaining / 1000).toFixed(1)}
      </span>
    </div>
  )
}

/**
 * Consecutive correct answers. It grows louder as the run gets longer, because
 * a number that never changes shape is a number you stop looking at.
 */
function StreakCounter({ streak, record }: { streak: number; record: number }) {
  const tier = streakTier(streak)
  const milestone = milestoneAt(streak)
  const isRecord = streak > record && streak >= 5

  if (streak < 2) {
    return <div className="absolute end-0 top-0 h-8" aria-hidden />
  }

  return (
    <div className="absolute end-0 top-2 flex flex-col items-end gap-1">
      <div
        key={tier}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 tabular-nums transition-colors",
          tier === 0 && "text-muted-foreground",
          tier === 1 && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          tier >= 2 && "bg-orange-500/15 text-orange-600 dark:text-orange-400"
        )}
        title={`${streak} correct in a row${
          record > 0 ? ` · your record is ${record}` : ""
        }`}
      >
        <Flame className={cn("size-4", tier >= 2 && "animate-pulse")} />
        <span
          className={cn("font-semibold", tier >= 2 ? "text-lg" : "text-sm")}
        >
          {streak}
        </span>
      </div>

      {isRecord && (
        <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
          <Trophy className="size-3" />
          record
        </span>
      )}
      {milestone !== null && !isRecord && (
        <span className="text-[11px] text-muted-foreground">
          {milestone} in a row!
        </span>
      )}
    </div>
  )
}

/**
 * First sight of a character: it is an instruction, not an achievement, so it
 * stays a quiet line of type. A tinted pill here would both shout over the
 * character it describes and borrow the green the drill reserves for a
 * correct answer.
 */
function NewCharacterHint({ romaji }: { romaji: string }) {
  return (
    <p className="flex items-baseline gap-2.5 text-sm text-muted-foreground">
      <span className="text-[10px] font-medium tracking-[0.18em] uppercase">
        New character
      </span>
      <span aria-hidden className="text-border">
        /
      </span>
      <span>
        reads as{" "}
        <strong className="font-semibold text-foreground">{romaji}</strong>
      </span>
    </p>
  )
}

/**
 * Explains the streak while it happens: without this the drill looks like it
 * is repeating characters at random instead of working on a specific pair.
 */
function GroupHint({
  group,
  graduationStreak,
}: {
  group: ConfusionGroup
  graduationStreak: number
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary">
      <Target className="size-3.5" />
      <span className="font-jp text-sm">{displayPair(group.members)}</span>
      <span
        className="flex gap-1"
        title={`${group.streak}/${graduationStreak} correct answers to master it`}
      >
        {Array.from({ length: graduationStreak }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-1.5 rounded-full",
              index < group.streak ? "bg-primary" : "bg-primary/25"
            )}
          />
        ))}
      </span>
    </div>
  )
}
