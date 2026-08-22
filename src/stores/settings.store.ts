import { createStore } from "@tanstack/store"
import { STORAGE_KEYS, loadPersisted, persist } from "@/lib/storage"
import type { Settings } from "@/lib/types"

export const DEFAULT_SETTINGS: Settings = {
  focusMode: true,
  activationThreshold: 2,
  graduationStreak: 4,
  maxGroupSize: 4,
  burstCooldown: 4,
  adaptivePace: true,
  acceptAliases: true,
  timeLimitEnabled: false,
  timeLimitMs: 5000,
  speedRamp: true,
  showGroupHint: true,
  writeAlwaysOutline: false,
  // hanzi-writer's default is 1; a touch more forgiving suits beginners
  // tracing with a mouse or a finger.
  writeLeniency: 1.3,
  writeDemoOnNew: true,
  theme: "system",
  language: "system",
  soundEnabled: true,
  soundVolume: 0.6,
}

const isSettings = (value: unknown): value is Partial<Settings> =>
  typeof value === "object" && value !== null

export const settingsStore = createStore<Settings>({
  ...DEFAULT_SETTINGS,
  // Merging over the defaults means a setting added in a later version simply
  // appears with its default instead of coming back `undefined`.
  ...loadPersisted<Partial<Settings>>(STORAGE_KEYS.settings, {}, isSettings),
})

persist(settingsStore, STORAGE_KEYS.settings)

export const updateSettings = (patch: Partial<Settings>) =>
  settingsStore.setState((prev) => ({ ...prev, ...patch }))

export const resetSettings = () =>
  settingsStore.setState(() => ({ ...DEFAULT_SETTINGS }))
