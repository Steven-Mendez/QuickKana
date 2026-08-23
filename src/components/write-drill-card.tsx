import { useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react"
import { Check, FastForward, Play, X } from "lucide-react"
import { Trans, useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { StreakCounter } from "@/components/drill-card"
import { KanaWritingCanvas } from "@/components/kana-writing-canvas"
import { WRITE_MAX_TRIES } from "@/hooks/use-drill"
import { cn } from "@/lib/utils"
import type {
  KanaWritingCanvasHandle,
  StrokeMistake,
} from "@/components/kana-writing-canvas"
import type { Kana, SessionState, Settings } from "@/lib/types"

interface WriteDrillCardProps {
  kana: Kana
  session: SessionState
  settings: Settings
  /** Whether the current character is traced over a guide. */
  outline: boolean
  /** Longest session streak ever, so a new record can be called out. */
  recordStreak: number
  onCorrectStroke: (strokeNum: number) => void
  /** Returns what to do after a wrong stroke: retry the character or fail. */
  onMistake: () => "retry" | "failed"
  onComplete: () => void
  /** The demo ran on this prompt — the attempt counts as assisted. */
  onAssist: () => void
  onLoadError: (char: string) => void
}

/** Canvas side: capped for desktop, shrinks with the viewport on phones. */
function useCanvasSize(): number {
  const [size, setSize] = useState(300)
  useEffect(() => {
    const update = () =>
      setSize(Math.max(220, Math.min(300, window.innerWidth - 64)))
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  return size
}

/**
 * The writing prompt: rōmaji where the reading drill shows the kana, the
 * tracing canvas where it has the input. Three tries per character — a wrong
 * stroke costs one, the strokes already accepted stay put, the expected
 * stroke flashes, and a line under the canvas says what went wrong — with the
 * same chrome around both drills.
 */
export function WriteDrillCard({
  kana,
  session,
  settings,
  outline,
  recordStreak,
  onCorrectStroke,
  onMistake,
  onComplete,
  onAssist,
  onLoadError,
}: WriteDrillCardProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<KanaWritingCanvasHandle>(null)
  const size = useCanvasSize()
  const reducedMotion = useReducedMotion()

  const isCorrect = session.phase === "correct"
  const isMissed = session.phase === "retry"
  const promptKey = `${session.current?.id}-${session.shownAt}`

  const [demoActive, setDemoActive] = useState(false)
  const [failedTries, setFailedTries] = useState(0)
  const failed = failedTries >= WRITE_MAX_TRIES
  // The last rejected stroke, so the feedback line can say what went wrong.
  // Cleared by the next accepted stroke: the advice has been followed.
  const [mistake, setMistake] = useState<StrokeMistake | null>(null)

  // Per-prompt UI state starts clean with each character.
  useEffect(() => {
    setFailedTries(0)
    setDemoActive(false)
    setMistake(null)
  }, [promptKey])

  // First-ever sighting of a character: play the stroke-order demo once,
  // automatically. The ref keeps StrictMode's double effect (and re-renders
  // within the same prompt) from replaying it.
  const demoedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!session.introducing || !settings.writeDemoOnNew) return
    if (session.phase !== "prompt" || demoedRef.current === promptKey) return
    demoedRef.current = promptKey
    onAssist()
    canvasRef.current?.showDemo()
  }, [
    session.introducing,
    session.phase,
    settings.writeDemoOnNew,
    promptKey,
    onAssist,
  ])

  // Imperative shake/pop, mirroring the reading drill's feedback language
  // without ever remounting the canvas subtree (hanzi-writer owns it).
  const shakeX = useMotionValue(0)
  const popScale = useMotionValue(1)

  useEffect(() => {
    if (failedTries === 0 || reducedMotion) return
    const shake = animate(shakeX, [0, -5, 5, -3, 0], { duration: 0.25 })
    return () => shake.stop()
  }, [failedTries, reducedMotion, shakeX])

  useEffect(() => {
    if (!isCorrect || reducedMotion) return
    const pop = animate(popScale, [1, 1.04, 1], { duration: 0.2 })
    return () => pop.stop()
  }, [isCorrect, reducedMotion, popScale])

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-3 sm:gap-5">
      <StreakCounter streak={session.streak} record={recordStreak} />

      {/* Same reserved hint slot as the reading drill. */}
      <div className="flex h-7 items-center">
        {session.introducing && <NewCharacterHint />}
      </div>

      {/* The prompt: rōmaji where the reading drill shows the kana. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={promptKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className={cn(
            "text-6xl font-semibold tracking-wide transition-colors duration-200 sm:text-7xl",
            isCorrect && "text-emerald-600 dark:text-emerald-400",
            isMissed && "text-destructive"
          )}
        >
          {kana.romaji}
        </motion.div>
      </AnimatePresence>

      <motion.div style={{ x: shakeX, scale: popScale }} className="relative">
        <KanaWritingCanvas
          ref={canvasRef}
          char={kana.char}
          size={size}
          showOutline={outline}
          leniency={settings.writeLeniency}
          highlightOnComplete={!reducedMotion}
          onCorrectStroke={(strokeNum) => {
            setMistake(null)
            onCorrectStroke(strokeNum)
          }}
          onMistake={(strokeMistake) => {
            setFailedTries((tries) => tries + 1)
            setMistake(strokeMistake)
            // On "retry" the quiz stays live: accepted strokes remain and the
            // same stroke is asked again, right after the hint flash.
            if (onMistake() === "failed") canvasRef.current?.revealCharacter()
          }}
          onComplete={onComplete}
          onLoadError={onLoadError}
          onDemoStateChange={setDemoActive}
          ariaLabel={t("writeDrill.ariaCanvas", { romaji: kana.romaji })}
          className="rounded-xl border border-border/60"
        />
      </motion.div>

      {/* The three tries. Filled = still available. */}
      <div
        className="flex gap-1.5"
        aria-label={t("writeDrill.triesLeft", {
          count: Math.max(0, WRITE_MAX_TRIES - failedTries),
        })}
      >
        {Array.from({ length: WRITE_MAX_TRIES }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-2 rounded-full transition-colors",
              index < WRITE_MAX_TRIES - failedTries
                ? "bg-primary"
                : "bg-destructive/40"
            )}
          />
        ))}
      </div>

      <div className="flex w-full flex-col items-center gap-1">
        {demoActive ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => canvasRef.current?.skipDemo()}
          >
            <FastForward className="size-3.5" />
            {t("writeDrill.skipDemo")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={isCorrect || isMissed}
            onClick={() => {
              onAssist()
              canvasRef.current?.showDemo()
            }}
          >
            <Play className="size-3.5" />
            {t("writeDrill.showMe")}
          </Button>
        )}

        {/* Reserved height: feedback must not shove the canvas around. */}
        <div className="h-5 text-sm">
          {mistake && !isCorrect && !isMissed && (
            <span className="text-amber-600 dark:text-amber-400">
              {t(
                mistake.isBackwards
                  ? "writeDrill.strokeBackwards"
                  : "writeDrill.strokeMismatch",
                { num: mistake.strokeNum + 1 }
              )}
            </span>
          )}
          {isCorrect && (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Check className="size-4" />
              <span className="font-jp" lang="ja">
                {kana.char}
              </span>
            </span>
          )}
          {isMissed && (
            <span className="flex items-center gap-1.5 text-destructive">
              <X className="size-4" />
              <Trans
                i18nKey={
                  failed
                    ? "writeDrill.itWas"
                    : "writeDrill.completedWithMistakes"
                }
                components={{ jp: <span className="font-jp" lang="ja" /> }}
                values={{ char: kana.char }}
              />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** First sight of a character in Write: quiet instruction, like the read one. */
function NewCharacterHint() {
  const { t } = useTranslation()
  return (
    <p className="flex items-baseline gap-2.5 text-sm text-muted-foreground">
      <span className="text-[10px] font-medium tracking-[0.18em] uppercase">
        {t("drill.newCharacter")}
      </span>
      <span aria-hidden className="text-border">
        /
      </span>
      <span>{t("writeDrill.watchStrokes")}</span>
    </p>
  )
}
