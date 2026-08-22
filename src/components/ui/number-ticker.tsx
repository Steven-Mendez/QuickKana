import { useEffect, useRef } from "react"
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react"
import { cn } from "@/lib/utils"

interface NumberTickerProps extends React.ComponentPropsWithoutRef<"span"> {
  value: number
  startValue?: number
  decimalPlaces?: number
  /** Delay before the count-up starts, in seconds */
  delay?: number
}

/**
 * Animated count-up number, adapted from Magic UI's NumberTicker (MIT) for
 * motion/react + cn(). Renders the final value directly for reduced-motion
 * users — useSpring is not covered by MotionConfig.
 */
export function NumberTicker({
  value,
  startValue = 0,
  decimalPlaces = 0,
  delay = 0,
  className,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reducedMotion = useReducedMotion()
  const motionValue = useMotionValue(startValue)
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 200 })
  const isInView = useInView(ref, { once: true })

  const format = (n: number) =>
    Intl.NumberFormat(undefined, {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(Number(n.toFixed(decimalPlaces)))

  useEffect(() => {
    if (!isInView || reducedMotion) return
    const timer = setTimeout(() => motionValue.set(value), delay * 1000)
    return () => clearTimeout(timer)
  }, [motionValue, isInView, reducedMotion, delay, value])

  useEffect(
    () =>
      springValue.on("change", (latest: number) => {
        if (ref.current) ref.current.textContent = format(latest)
      }),
    [springValue, decimalPlaces]
  )

  return (
    <span
      ref={ref}
      className={cn("inline-block tabular-nums", className)}
      {...props}
    >
      {reducedMotion ? format(value) : format(startValue)}
    </span>
  )
}
