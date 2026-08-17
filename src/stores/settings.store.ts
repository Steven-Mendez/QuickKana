import { createStore } from "@tanstack/store"
import { STORAGE_KEYS, loadPersisted, persist } from "@/lib/storage"
import type { Settings } from "@/lib/types"

export const DEFAULT_SETTINGS: Settings = {
  focusMode: true,
  activationThreshold: 2,
  graduationStreak: 4,
  maxGroupSize: 4,
  burstCooldown: 4,
  acceptAliases: true,
  timeLimitEnabled: false,
  timeLimitMs: 5000,
  speedRamp: true,
  showGroupHint: true,
  theme: "system",
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
