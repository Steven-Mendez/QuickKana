import { createStore } from "@tanstack/store"
import { STORAGE_KEYS, loadPersisted, persist } from "@/lib/storage"
import {
  TRACKS,
  holdsUp,
  isLessonComplete,
  lastLessonOf,
  lessonAt,
  retention,
  trackLength,
} from "@/lib/journey"
import { requiredAttempts } from "@/lib/momentum"
import type { CharStat, Script } from "@/lib/types"

/** Free selection, or the guided climb through one syllabary's curriculum. */
export type PracticeMode = "free" | "journey"

export interface ProgressionState {
  version: 1
  mode: PracticeMode
  /** Which curriculum the guided mode is currently drilling. */
  track: Script
  /** Lesson being introduced, per track — the two never gate each other. */
  lessons: Record<Script, number>
  /** `${script}:${index}` → when that lesson was unlocked. */
  unlockedAt: Record<string, number>
  /** Consecutive days with at least one answer. */
  day: { last: string | null; streak: number; best: number }
  records: { bestSessionStreak: number; bestAccuracy: number }
}

const initial = (): ProgressionState => ({
  version: 1,
  mode: "journey",
  track: "hiragana",
  lessons: { hiragana: 0, katakana: 0 },
  unlockedAt: {},
  day: { last: null, streak: 0, best: 0 },
  records: { bestSessionStreak: 0, bestAccuracy: 0 },
})

/** Shape written by the single-track build, before the split into two. */
interface LegacyProgression {
  lesson?: number
}

/**
 * Older saves held one flat lesson index across both syllabaries. Splitting it
 * back out keeps a returning user where they were instead of dropping them at
 * あ again.
 */
function migrate(
  stored: Partial<ProgressionState> & LegacyProgression
): Partial<ProgressionState> {
  const base = initial()

  if (typeof stored.lesson === "number" && !stored.lessons) {
    const hiraganaCount = trackLength("hiragana")
    const flat = stored.lesson
    return {
      ...stored,
      track: flat < hiraganaCount ? "hiragana" : "katakana",
      lessons:
        flat < hiraganaCount
          ? { hiragana: flat, katakana: 0 }
          : {
              hiragana: lastLessonOf("hiragana"),
              katakana: Math.min(
                lastLessonOf("katakana"),
                flat - hiraganaCount
              ),
            },
    }
  }

  // Both keys always present, so every read of `lessons[script]` is a number
  // even if the stored object only ever held one of them.
  return { ...stored, lessons: { ...base.lessons, ...stored.lessons } }
}

const isProgression = (value: unknown): value is Partial<ProgressionState> =>
  typeof value === "object" && value !== null

export const progressionStore = createStore<ProgressionState>({
  ...initial(),
  ...migrate(
    loadPersisted<Partial<ProgressionState> & LegacyProgression>(
      STORAGE_KEYS.progression,
      {},
      isProgression
    )
  ),
})

persist(progressionStore, STORAGE_KEYS.progression)

export const setMode = (mode: PracticeMode) =>
  progressionStore.setState((prev) => ({ ...prev, mode }))

export const setTrack = (track: Script) =>
  progressionStore.setState((prev) => ({ ...prev, track }))

/** The lesson the given track is currently on. */
export const lessonOf = (state: ProgressionState, script: Script): number =>
  state.lessons[script]

/** Local calendar day — a streak should follow the user's midnight, not UTC. */
export const dayKey = (time: number): string => {
  const date = new Date(time)
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

const previousDay = (key: string): string => {
  const [year, month, day] = key.split("-").map(Number)
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
  date.setDate(date.getDate() - 1)
  return dayKey(date.getTime())
}

/**
 * Extends the daily streak. Called on the first answer of a session rather
 * than on page load, so opening the app without practising never counts.
 */
export function touchDay(now = Date.now()): { streak: number; isNew: boolean } {
  const today = dayKey(now)
  let result = { streak: 0, isNew: false }

  progressionStore.setState((prev) => {
    if (prev.day.last === today) {
      result = { streak: prev.day.streak, isNew: false }
      return prev
    }
    const streak =
      prev.day.last === previousDay(today) ? prev.day.streak + 1 : 1
    result = { streak, isNew: true }
    return {
      ...prev,
      day: { last: today, streak, best: Math.max(prev.day.best, streak) },
    }
  })

  return result
}

/** Attempts a session needs before its accuracy can set a record. */
const RECORD_MIN_ATTEMPTS = 10

export function recordSessionResult(session: {
  attempts: number
  correct: number
  bestStreak: number
}): void {
  progressionStore.setState((prev) => {
    const accuracy =
      session.attempts >= RECORD_MIN_ATTEMPTS
        ? session.correct / session.attempts
        : 0
    return {
      ...prev,
      records: {
        bestSessionStreak: Math.max(
          prev.records.bestSessionStreak,
          session.bestStreak
        ),
        bestAccuracy: Math.max(prev.records.bestAccuracy, accuracy),
      },
    }
  })
}

/**
 * Unlocks the next lesson of a track. Returns the newly unlocked lesson's id,
 * or `null` if nothing changed — which is what the drill uses to celebrate the
 * moment it happens.
 *
 * Two gates, and both have to be open. The section itself has to be learned,
 * and everything unlocked before it has to still be readable: moving on is a
 * claim about the whole track so far, not just about the five characters last
 * introduced. Without the second gate a user can outrun their own memory,
 * unlocking ん while あ quietly rots behind them.
 *
 * `streak` is the run of correct answers on *this lesson's own characters*.
 * It shortens how many sightings each of them needs — not how accurate they
 * have to be. A user reading the section faultlessly has already produced the
 * evidence that quota was there to collect, and making them grind it out
 * anyway is how a track stalls on characters they know.
 *
 * `isCharReady` is an extra per-character veto on the lesson's own ids, on
 * top of the mastery bar. The drill uses it to demand exposure in both
 * exercise types when both are on: however well you read a section, it isn't
 * passed until you've also written it.
 */
export function advanceLesson(
  script: Script,
  charStats: Record<string, CharStat>,
  streak = 0,
  now = Date.now(),
  isCharReady: (id: string) => boolean = () => true
): string | null {
  const state = progressionStore.state
  const current = lessonOf(state, script)
  if (current >= lastLessonOf(script)) return null

  const lesson = lessonAt(script, current)
  if (
    !isLessonComplete(
      lesson,
      charStats,
      requiredAttempts(streak, lesson.ids.length)
    )
  ) {
    return null
  }

  if (!lesson.ids.every(isCharReady)) return null

  if (!holdsUp(retention(script, current, charStats))) return null

  const next = current + 1
  progressionStore.setState((prev) => ({
    ...prev,
    lessons: { ...prev.lessons, [script]: next },
    unlockedAt: { ...prev.unlockedAt, [`${script}:${next}`]: now },
  }))
  return TRACKS[script][next]?.id ?? null
}

/** Manual override from settings — skipping ahead or going back to revise. */
export const setLesson = (script: Script, lesson: number) =>
  progressionStore.setState((prev) => ({
    ...prev,
    lessons: {
      ...prev.lessons,
      [script]: Math.max(0, Math.min(lastLessonOf(script), lesson)),
    },
  }))

export const resetProgression = () =>
  progressionStore.setState((prev) => ({
    ...initial(),
    mode: prev.mode,
    track: prev.track,
  }))
