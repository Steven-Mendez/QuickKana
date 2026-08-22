import { createStore } from "@tanstack/store"
import type { ExerciseType, Pick, SessionState } from "@/lib/types"

/** Ephemeral by design — a reload starts a fresh session, stats persist. */
const newSession = (): SessionState => ({
  id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  startedAt: Date.now(),
  current: null,
  exercise: "read",
  shownAt: Date.now(),
  input: "",
  phase: "prompt",
  missedCurrent: false,
  introducing: false,
  timedOut: false,
  lastShownId: null,
  burst: null,
  sinceBurst: 0,
  attempts: 0,
  correct: 0,
  streak: 0,
  bestStreak: 0,
  lessonStreak: 0,
  graduated: [],
  unlocked: [],
  newRecord: false,
  ended: false,
})

export const sessionStore = createStore<SessionState>(newSession())

export const startSession = () => sessionStore.setState(() => newSession())

export const setInput = (input: string) =>
  sessionStore.setState((prev) => ({ ...prev, input }))

export const showPick = (
  pick: Pick | null,
  introducing = false,
  exercise: ExerciseType = "read",
  now = Date.now()
) =>
  sessionStore.setState((prev) => ({
    ...prev,
    current: pick,
    exercise,
    shownAt: now,
    input: "",
    phase: "prompt",
    missedCurrent: false,
    introducing,
    timedOut: false,
  }))

export const endSession = () =>
  sessionStore.setState((prev) => ({ ...prev, ended: true, current: null }))
