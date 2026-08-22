import { useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react"
import { Check, Play, X } from "lucide-react"
import { Trans, useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { StreakCounter } from "@/components/drill-card"
import { KanaWritingCanvas } from "@/components/kana-writing-canvas"
import { cn } from "@/lib/utils"
import type { KanaWritingCanvasHandle } from "@/components/kana-writing-canvas"
import type { Kana, SessionState, Settings } from "@/lib/types"

interface WriteDrillCardProps {
  kana: Kana
  session: SessionState
  settings: Settings
  /** Whether the current character is traced over a guide. */
  outline: boolean
  /** Longest write streak ever, so a new record can be called out. */
  recordStreak: number
  onCorrectStroke: () => void
  onMistake: () => void
  onComplete: (totalMistakes: number) => void
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
 * The Write drill's centre: rōmaji prompt where the reading drill shows the
 * kana, the tracing canvas where it has the input. Same chrome around both.
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
  const [mistakeTick, setMistakeTick] = useState(0)

  useEffect(() => {
    if (mistakeTick === 0 || reducedMotion) return
    const shake = animate(shakeX, [0, -5, 5, -3, 0], { duration: 0.25 })
    return () => shake.stop()
  }, [mistakeTick, reducedMotion, shakeX])

  useEffect(() => {
    if (!isCorrect || reducedMotion) return
    const pop = animate(popScale, [1, 1.04, 1], { duration: 0.2 })
    return () => pop.stop()
  }, [isCorrect, reducedMotion, popScale])

  return (
    <div className="relative mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5">
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

      <motion.div style={{ x: shakeX, scale: popScale }}>
        <KanaWritingCanvas
          ref={canvasRef}
          char={kana.char}
          size={size}
          showOutline={outline}
          leniency={settings.writeLeniency}
          highlightOnComplete={!reducedMotion}
          onCorrectStroke={onCorrectStroke}
          onMistake={() => {
            setMistakeTick((tick) => tick + 1)
            onMistake()
          }}
          onComplete={({ totalMistakes }) => onComplete(totalMistakes)}
          onLoadError={onLoadError}
          ariaLabel={t("writeDrill.ariaCanvas", { romaji: kana.romaji })}
          className="rounded-xl border border-border/60"
        />
      </motion.div>

      <div className="flex w-full flex-col items-center gap-2">
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

        {/* Reserved height: feedback must not shove the canvas around. */}
        <div className="h-5 text-sm">
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
                i18nKey="writeDrill.completedWithMistakes"
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
