import { useEffect, useImperativeHandle, useRef } from "react"
import HanziWriter from "hanzi-writer"
import { charDataLoader } from "@/lib/kana/strokes"
import { useIsDark } from "@/hooks/use-is-dark"
import { cn } from "@/lib/utils"
import type { Ref } from "react"

/**
 * hanzi-writer paints concrete color strings into its SVG — CSS variables
 * never reach it — so the theme tokens are resolved here by hand. Values are
 * the sRGB equivalents of the oklch tokens in styles.css:
 * drawing = --primary (the brand accent), stroke = --foreground (ink used for
 * the demo and for strokes the quiz confirms), outline = guide in the theme's
 * muted range, highlight = the amber the streak UI uses for hints, complete =
 * the emerald the drill uses for a correct answer.
 */
const PALETTES = {
  light: {
    drawingColor: "#d13b2b",
    strokeColor: "#32191c",
    outlineColor: "#e6dfd6",
    highlightColor: "#f59e0b",
    highlightCompleteColor: "#059669",
  },
  dark: {
    drawingColor: "#f0614c",
    strokeColor: "#f4f0e7",
    outlineColor: "#524443",
    highlightColor: "#fbbf24",
    highlightCompleteColor: "#34d399",
  },
} as const

export interface KanaWritingCanvasHandle {
  /** Plays the stroke-order demo, then puts the quiz back. */
  showDemo: () => void
  /** Cuts a running demo short and starts the quiz right away. */
  skipDemo: () => void
  /** Shows the finished character (the reveal after the last failed try). */
  revealCharacter: () => void
}

/** What went wrong on a rejected stroke, for feedback the user can act on. */
export interface StrokeMistake {
  /** Zero-based index of the stroke that was expected. */
  strokeNum: number
  /** The shape matched but was drawn from the wrong end. */
  isBackwards: boolean
}

interface KanaWritingCanvasProps {
  char: string
  /** Square canvas side in px. */
  size: number
  showOutline: boolean
  leniency: number
  /** Parent turns the completion flash off under prefers-reduced-motion. */
  highlightOnComplete: boolean
  onCorrectStroke?: (strokeNum: number) => void
  onMistake?: (mistake: StrokeMistake) => void
  onComplete: (result: { totalMistakes: number }) => void
  /** Stroke data failed to load — the drill should skip this character. */
  onLoadError?: (char: string) => void
  /** The stroke-order demo started / finished (incl. skipped) — drives UI. */
  onDemoStateChange?: (active: boolean) => void
  ariaLabel?: string
  className?: string
  ref?: Ref<KanaWritingCanvasHandle>
}

/**
 * React wrapper around a single hanzi-writer instance.
 *
 * hanzi-writer owns and mutates the DOM below the container node, so React
 * must never render children into it. The component keeps one instance for
 * its whole life: character changes go through `setCharacter()` + a fresh
 * `quiz()`, which avoids the flash of teardown/re-create.
 */
export function KanaWritingCanvas({
  char,
  size,
  showOutline,
  leniency,
  highlightOnComplete,
  onCorrectStroke,
  onMistake,
  onComplete,
  onLoadError,
  onDemoStateChange,
  ariaLabel,
  className,
  ref,
}: KanaWritingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const writerRef = useRef<HanziWriter | null>(null)
  const isDark = useIsDark()

  // Everything the quiz callbacks read lives in refs: the quiz is only
  // (re)created per character, never per render, and must still see the
  // latest props when it fires.
  const latest = useRef({
    char,
    showOutline,
    leniency,
    highlightOnComplete,
    onCorrectStroke,
    onMistake,
    onComplete,
    onLoadError,
    onDemoStateChange,
  })
  latest.current = {
    char,
    showOutline,
    leniency,
    highlightOnComplete,
    onCorrectStroke,
    onMistake,
    onComplete,
    onLoadError,
    onDemoStateChange,
  }

  const startQuiz = () => {
    const writer = writerRef.current
    if (!writer) return
    const shown = latest.current.char
    void writer.quiz({
      leniency: latest.current.leniency,
      highlightOnComplete: latest.current.highlightOnComplete,
      // Every rejected stroke flashes the stroke that was expected — the
      // whole point is that the user learns what to fix, not just that
      // something was wrong.
      showHintAfterMisses: 1,
      onCorrectStroke: (strokeData) => {
        if (latest.current.char === shown) {
          latest.current.onCorrectStroke?.(strokeData.strokeNum)
        }
      },
      onMistake: (strokeData) => {
        if (latest.current.char === shown) {
          latest.current.onMistake?.({
            strokeNum: strokeData.strokeNum,
            isBackwards: strokeData.isBackwards,
          })
        }
      },
      onComplete: (summary) => {
        if (latest.current.char === shown) {
          latest.current.onComplete({ totalMistakes: summary.totalMistakes })
        }
      },
    })
  }

  const applyOutline = () => {
    const writer = writerRef.current
    if (!writer) return
    if (latest.current.showOutline) void writer.showOutline({ duration: 0 })
    else void writer.hideOutline({ duration: 0 })
  }

  /** The character the live writer instance is currently showing. */
  const shownCharRef = useRef<string | null>(null)
  /** Resolves when the last `setCharacter()` finished rendering. */
  const charChainRef = useRef<Promise<void>>(Promise.resolve())
  /** Character a demo was requested for — its quiz start is deferred. */
  const demoRequestedRef = useRef<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const palette = document.documentElement.classList.contains("dark")
      ? PALETTES.dark
      : PALETTES.light
    const writer = HanziWriter.create(el, latest.current.char, {
      width: size,
      height: size,
      padding: Math.round(size * 0.06),
      showCharacter: false,
      showOutline: latest.current.showOutline,
      drawingWidth: Math.max(6, Math.round(size / 22)),
      // A snappy demo: the default 1s pause between strokes makes learners
      // wait far more than watch.
      strokeAnimationSpeed: 2.5,
      delayBetweenStrokes: 180,
      ...palette,
      charDataLoader,
      onLoadCharDataError: () =>
        latest.current.onLoadError?.(latest.current.char),
    })
    writerRef.current = writer
    shownCharRef.current = latest.current.char
    startQuiz()

    return () => {
      writer.cancelQuiz()
      writerRef.current = null
      shownCharRef.current = null
      // hanzi-writer has no destroy(); dropping its SVG both frees the DOM
      // and keeps a StrictMode remount from stacking two canvases.
      el.replaceChildren()
    }
    // Mount-only: character/option changes are handled on the live instance.
  }, [])

  // Character changes: swap in place instead of tearing the writer down.
  useEffect(() => {
    const writer = writerRef.current
    if (!writer || shownCharRef.current === char) return
    shownCharRef.current = char
    demoRequestedRef.current = null
    writer.cancelQuiz()
    charChainRef.current = writer.setCharacter(char).then(() => {
      if (writerRef.current !== writer || latest.current.char !== char) return
      applyOutline()
      // A demo asked for this character starts the quiz itself when it ends.
      if (demoRequestedRef.current === char) return
      startQuiz()
    })
  }, [char])

  useEffect(() => {
    applyOutline()
  }, [showOutline])

  useEffect(() => {
    const writer = writerRef.current
    if (!writer) return
    writer.updateDimensions({
      width: size,
      height: size,
      padding: Math.round(size * 0.06),
    })
  }, [size])

  useEffect(() => {
    const writer = writerRef.current
    if (!writer) return
    const palette = isDark ? PALETTES.dark : PALETTES.light
    for (const [name, value] of Object.entries(palette)) {
      void writer.updateColor(name as keyof typeof palette, value, {
        duration: 0,
      })
    }
  }, [isDark])

  const endDemo = (writer: HanziWriter, hideDuration: number) => {
    demoRequestedRef.current = null
    latest.current.onDemoStateChange?.(false)
    void writer.hideCharacter({ duration: hideDuration })
    startQuiz()
  }

  useImperativeHandle(
    ref,
    () => ({
      showDemo: () => {
        const writer = writerRef.current
        if (!writer) return
        const shown = latest.current.char
        demoRequestedRef.current = shown
        latest.current.onDemoStateChange?.(true)
        // Wait for any in-flight setCharacter() so the demo animates the
        // character actually on screen.
        void charChainRef.current.then(() => {
          if (writerRef.current !== writer || latest.current.char !== shown) {
            return
          }
          writer.cancelQuiz()
          void writer.animateCharacter({
            onComplete: () => {
              // Skipping cancels the animation and has already restarted the
              // quiz — a second restart here would wipe the user's strokes.
              if (demoRequestedRef.current !== shown) return
              // Hold the finished character for a beat before quizzing again.
              setTimeout(() => {
                if (
                  writerRef.current !== writer ||
                  latest.current.char !== shown ||
                  demoRequestedRef.current !== shown
                ) {
                  return
                }
                endDemo(writer, 160)
              }, 350)
            },
          })
        })
      },
      skipDemo: () => {
        const writer = writerRef.current
        if (!writer || demoRequestedRef.current === null) return
        endDemo(writer, 0)
      },
      revealCharacter: () => {
        const writer = writerRef.current
        if (!writer) return
        writer.cancelQuiz()
        void writer.showCharacter({ duration: 250 })
      },
    }),
    []
  )

  return (
    <div
      ref={containerRef}
      aria-label={ariaLabel}
      className={cn("select-none", className)}
      // touch-action: none — tracing on mobile must draw, not scroll.
      style={{ width: size, height: size, touchAction: "none" }}
    />
  )
}
