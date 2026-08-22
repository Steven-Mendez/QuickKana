import { settingsStore } from "@/stores/settings.store"
import type { LibrarySoundName } from "react-sounds"

/**
 * Every audible moment in the app, named after the event rather than the
 * clip so the mapping below can change (or grow selectable themes) without
 * touching any call site.
 */
export type SoundEvent =
  | "correct"
  | "wrong"
  | "timeout"
  | "unlock"
  | "graduation"
  | "sessionEnd"
  | "streakMilestone"
  | "strokeCorrect"
  | "strokeWrong"

const SOUNDS: Record<SoundEvent, LibrarySoundName> = {
  correct: "ui/success_blip",
  wrong: "ui/blocked",
  // Write mode, once per stroke — deliberately quieter cues than the
  // per-answer pair above, because they fire several times per character.
  strokeCorrect: "ui/keystroke_soft",
  strokeWrong: "ui/item_deselect",
  timeout: "ui/buzz",
  unlock: "arcade/level_up",
  graduation: "ui/success_chime",
  sessionEnd: "notification/completed",
  streakMilestone: "arcade/coin_bling",
}

// Dynamic import: howler must never load during the build-time shell render,
// and this keeps it out of the initial bundle until a drill actually starts.
const runtime = () => import("react-sounds")

/**
 * Fire-and-forget: reads the mute/volume settings imperatively so it can be
 * called from the drill's non-React callbacks, and swallows every failure —
 * a blocked AudioContext or an unreachable CDN must never break an answer.
 */
export function playEffect(event: SoundEvent, options?: { rate?: number }): void {
  const { soundEnabled, soundVolume } = settingsStore.state
  if (!soundEnabled) return
  runtime()
    .then(({ playSound }) =>
      playSound(SOUNDS[event], { volume: soundVolume, rate: options?.rate })
    )
    .catch(() => {})
}

let preloaded = false

/** Fetches every mapped clip once, so the first answer doesn't lag on the CDN. */
export function preloadEffects(): void {
  if (preloaded) return
  preloaded = true
  runtime()
    .then(({ preloadSounds }) => preloadSounds(Object.values(SOUNDS)))
    .catch(() => {
      preloaded = false
    })
}
