const PREFIX = "qk:"

export const STORAGE_KEYS = {
  settings: `${PREFIX}v1:settings`,
  selection: `${PREFIX}v1:selection`,
  progress: `${PREFIX}v1:progress`,
  progression: `${PREFIX}v1:progression`,
  history: `${PREFIX}v1:history`,
  /** Kept outside the versioned namespace so the anti-FOUC script can read it. */
  theme: `${PREFIX}theme`,
} as const

const canUseStorage = () =>
  typeof window !== "undefined" && !!window.localStorage

/**
 * Reads a persisted value, falling back to `fallback` on anything unexpected —
 * missing key, malformed JSON, or a shape written by an older build. Losing
 * practice history is preferable to booting into a broken app.
 */
export function loadPersisted<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => boolean
): T {
  if (!canUseStorage()) return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw) as unknown
    if (validate && !validate(parsed)) return fallback
    return parsed as T
  } catch {
    return fallback
  }
}

export function savePersisted(key: string, value: unknown): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage disabled — the session keeps working in memory.
  }
}

/** Minimal shape shared by TanStack stores and anything else observable. */
interface Subscribable<T> {
  get: () => T
  subscribe: (listener: (value: T) => void) => { unsubscribe: () => void }
}

/**
 * Mirrors a store into localStorage. Writes are debounced because the progress
 * store is touched on every keystroke-confirmed answer.
 */
export function persist<T>(
  store: Subscribable<T>,
  key: string,
  debounceMs = 0
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const subscription = store.subscribe((value) => {
    if (debounceMs <= 0) {
      savePersisted(key, value)
      return
    }
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      savePersisted(key, value)
    }, debounceMs)
  })

  return () => {
    if (timer) {
      clearTimeout(timer)
      savePersisted(key, store.get())
    }
    subscription.unsubscribe()
  }
}

/** Wipes every QuickKana key, including ones left by older versions. */
export function clearAllStorage(): void {
  if (!canUseStorage()) return
  const doomed: Array<string> = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (key?.startsWith(PREFIX)) doomed.push(key)
  }
  for (const key of doomed) window.localStorage.removeItem(key)
}
