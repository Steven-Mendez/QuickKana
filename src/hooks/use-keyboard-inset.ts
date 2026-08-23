import { useEffect, useState } from "react"

/** Under this, the shrink is a browser toolbar collapsing, not a keyboard. */
const KEYBOARD_MIN_PX = 120

/**
 * How much of the viewport the on-screen keyboard covers, published as the
 * `--keyboard-inset` custom property on `<html>` plus a `data-keyboard="open"`
 * flag (the `kb-open:` Tailwind variant reads it).
 *
 * `interactive-widget=resizes-content` would make this unnecessary, but only
 * Chrome on Android implements it. iOS Safari keeps the *layout* viewport at
 * full height and shrinks only the *visual* one, so a `dvh` layout keeps its
 * bottom rows underneath the keyboard and Safari scrolls the page to chase the
 * focused field — which is exactly how the drill's footer ended up buried under
 * the keyboard's accessory bar. Measuring the visual viewport is the only way
 * to know, so the drill can size itself to what is actually on screen.
 */
export function useKeyboardInset(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const root = document.documentElement

    const sync = () => {
      const covered = Math.max(
        0,
        root.clientHeight - viewport.height - viewport.offsetTop
      )
      // A pinch-zoom shrinks the visual viewport too; only an unzoomed page
      // losing this much height is a keyboard.
      const isOpen = viewport.scale <= 1.01 && covered > KEYBOARD_MIN_PX
      root.style.setProperty(
        "--keyboard-inset",
        isOpen ? `${Math.round(covered)}px` : "0px"
      )
      root.dataset.keyboard = isOpen ? "open" : "closed"
      setOpen(isOpen)
    }

    sync()
    viewport.addEventListener("resize", sync)
    viewport.addEventListener("scroll", sync)
    return () => {
      viewport.removeEventListener("resize", sync)
      viewport.removeEventListener("scroll", sync)
      root.style.removeProperty("--keyboard-inset")
      delete root.dataset.keyboard
    }
  }, [])

  return open
}
