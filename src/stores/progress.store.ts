import { createStore } from "@tanstack/store"
import { STORAGE_KEYS, loadPersisted, persist } from "@/lib/storage"
import {
  applyAnswerToGroups,
  rebuildGroups,
  recordConfusion,
  recordTypo,
} from "@/lib/confusion"
import { emptyCharStat, nextWeight } from "@/lib/scheduler"
import type { AttemptRecord, ProgressState, Settings } from "@/lib/types"

const HISTORY_LIMIT = 2000

export const emptyProgress = (): ProgressState => ({
  version: 1,
  charStats: {},
  matrix: {},
  typos: {},
  groups: {},
  totals: { attempts: 0, correct: 0, sessions: 0, totalMs: 0 },
})

const isProgress = (value: unknown): value is ProgressState =>
  typeof value === "object" &&
  value !== null &&
  (value as { version?: unknown }).version === 1

export const progressStore = createStore<ProgressState>(
  loadPersisted<ProgressState>(
    STORAGE_KEYS.progress,
    emptyProgress(),
    isProgress
  )
)

export const historyStore = createStore<Array<AttemptRecord>>(
  loadPersisted<Array<AttemptRecord>>(STORAGE_KEYS.history, [], Array.isArray)
)

// Answers land on every confirmed keystroke, so the writes are debounced.
persist(progressStore, STORAGE_KEYS.progress, 400)
persist(historyStore, STORAGE_KEYS.history, 800)

export interface AnswerInput {
  kanaId: string
  expected: string
  typed: string
  correct: boolean
  /** Resolved kana id when the answer spelled another kana, else `null`. */
  confusedWith: string | null
  ms: number
  sessionId: string
}

export interface AnswerOutcome {
  /** Group ids that graduated on this answer, for the drill to celebrate. */
  graduated: Array<string>
}

/**
 * Commits one *first* attempt. Retries after a miss deliberately never reach
 * here: they exist to reinforce the right answer, not to score the character
 * twice or to add a second entry to the confusion matrix.
 */
export function recordAnswer(
  input: AnswerInput,
  settings: Settings,
  now = Date.now()
): AnswerOutcome {
  let graduated: Array<string> = []

  progressStore.setState((prev) => {
    const stat = prev.charStats[input.kanaId] ?? emptyCharStat()
    const streak = input.correct ? stat.streak + 1 : 0

    let next: ProgressState = {
      ...prev,
      charStats: {
        ...prev.charStats,
        [input.kanaId]: {
          attempts: stat.attempts + 1,
          correct: stat.correct + (input.correct ? 1 : 0),
          streak,
          bestStreak: Math.max(stat.bestStreak, streak),
          totalMs: stat.totalMs + input.ms,
          lastSeenAt: now,
          weight: nextWeight(stat.weight, input.correct),
        },
      },
      totals: {
        ...prev.totals,
        attempts: prev.totals.attempts + 1,
        correct: prev.totals.correct + (input.correct ? 1 : 0),
        totalMs: prev.totals.totalMs + input.ms,
      },
    }

    if (!input.correct) {
      if (input.confusedWith) {
        // Recomputes the confusion groups from the updated matrix, which is
        // what can promote this miss into a new active group.
        next = {
          ...next,
          ...recordConfusion(
            next,
            input.kanaId,
            input.confusedWith,
            settings,
            now
          ),
        }
      } else if (input.typed) {
        // An empty answer is a skip or a timeout, not something the user typed.
        next = { ...next, typos: recordTypo(next, input.kanaId, input.typed) }
      }
    }

    const applied = applyAnswerToGroups(
      next.groups,
      input.kanaId,
      input.correct,
      input.confusedWith,
      settings,
      now
    )
    graduated = applied.graduated

    return { ...next, groups: applied.groups }
  })

  historyStore.setState((prev) => {
    const record: AttemptRecord = {
      t: now,
      id: input.kanaId,
      expected: input.expected,
      typed: input.typed,
      correct: input.correct,
      ms: input.ms,
      confusedWith: input.confusedWith,
      sessionId: input.sessionId,
    }
    const next = [...prev, record]
    return next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next
  })

  return { graduated }
}

/**
 * Recomputes every group from the existing matrix. Needed when the thresholds
 * change in settings: without this, lowering "Confusion count to activate a
 * group" would appear to do nothing until the user happened to miss another
 * character.
 */
export const rebuildGroupsFromSettings = (
  settings: Settings,
  now = Date.now()
) =>
  progressStore.setState((prev) => ({
    ...prev,
    groups: rebuildGroups(prev, settings, now),
  }))

export const countSession = () =>
  progressStore.setState((prev) => ({
    ...prev,
    totals: { ...prev.totals, sessions: prev.totals.sessions + 1 },
  }))

export const resetProgress = () => {
  progressStore.setState(() => emptyProgress())
  historyStore.setState(() => [])
}
