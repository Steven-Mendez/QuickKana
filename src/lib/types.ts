export type Script = "hiragana" | "katakana"

/** Which of the three optional character sets a kana belongs to. */
export type KanaCategory = "gojuon" | "dakuten" | "digraph"

export interface Kana {
  /** Stable storage key, e.g. `hiragana:つ`. Never changes across versions. */
  id: string
  char: string
  /** Canonical Hepburn reading — the only spelling ever persisted. */
  romaji: string
  /** Accepted alternative spellings (Nihon-shiki / Kunrei), for matching only. */
  alt: Array<string>
  script: Script
  category: KanaCategory
  /** Row id shared across scripts, e.g. `ta`. */
  row: string
  col: number
}

export interface KanaRow {
  /** `${script}:${rowId}` — unique across the app. */
  id: string
  rowId: string
  label: string
  /** Consonant prefix shown beside the row, e.g. `k` for the か row. */
  shortLabel: string
  script: Script
  category: KanaCategory
  columns: Array<string>
  /** `null` marks a gap in the classical grid (yi, ye, wu, ...). */
  cells: Array<Kana | null>
}

// ---------------------------------------------------------------- progress

export interface CharStat {
  /** First attempts only — retries after a miss are not counted. */
  attempts: number
  correct: number
  /** Current run of consecutive correct first attempts. */
  streak: number
  bestStreak: number
  /** Summed response time over first attempts, for the average. */
  totalMs: number
  lastSeenAt: number
  /** Focus Mode base weight: how often this kana shows up in the general pool. */
  weight: number
}

export type GroupStatus = "active" | "graduated"

export interface ConfusionGroup {
  /** Deterministic: members sorted and joined with `|`. */
  id: string
  members: Array<string>
  status: GroupStatus
  /** Sum of cross-misses among members — drives which group gets drilled. */
  totalMisses: number
  /** Consecutive correct first attempts on members since activation. */
  streak: number
  activatedAt: number
  graduatedAt: number | null
  /** Counts reactivations, so the UI can show a repeatedly-relapsing pair. */
  timesActivated: number
}

export interface ProgressState {
  version: 1
  charStats: Record<string, CharStat>
  /** shown kana id → answered kana id → times. */
  matrix: Record<string, Record<string, number>>
  /** shown kana id → raw typed text → times, for answers matching no kana. */
  typos: Record<string, Record<string, number>>
  groups: Record<string, ConfusionGroup>
  totals: {
    attempts: number
    correct: number
    sessions: number
    totalMs: number
  }
}

// ---------------------------------------------------------------- writing

/** Per-character stats for the Write mode. Same shape as `CharStat` so the
 * scheduler's weighting and the mastery ramp work on it unchanged, plus the
 * stroke-level error count that only writing produces. */
export interface WriteCharStat extends CharStat {
  /** Total wrong strokes ever drawn on this character. */
  strokeMistakes: number
  /**
   * Clean, unassisted completions with no outline — written from memory.
   * This is what the lesson gate asks for: tracing over a guide proves
   * motor practice, only recalling the shape unaided proves writing.
   */
  memoryCorrect: number
}

/** The Write mode's persisted track, fully separate from reading progress. */
export interface WritingState {
  version: 1
  charStats: Record<string, WriteCharStat>
  totals: {
    attempts: number
    correct: number
    /** Sessions that included at least one writing attempt. */
    sessions: number
    totalMs: number
  }
}

export interface AttemptRecord {
  t: number
  id: string
  expected: string
  typed: string
  correct: boolean
  ms: number
  /** Resolved kana id when the answer matched another kana, else `null`. */
  confusedWith: string | null
  sessionId: string
}

// ---------------------------------------------------------------- settings

export type ThemePreference = "light" | "dark" | "system"

export type LanguagePreference = "en" | "es" | "system"

export interface Settings {
  focusMode: boolean
  /**
   * Which exercise types the drill serves. Reading and writing are both part
   * of learning a kana, so a session mixes them; either can be turned off in
   * settings, but never both.
   */
  practiceReading: boolean
  practiceWriting: boolean
  /**
   * Pomodoro-style sessions: the drill ends itself after `sessionMinutes`
   * and shows the summary, so practice comes in bounded bursts instead of an
   * endless grind. Off means the session runs until the user finishes it.
   */
  sessionLimitEnabled: boolean
  sessionMinutes: number
  /** Cross-misses on a pair before its group activates. */
  activationThreshold: number
  /** Consecutive correct answers on a group's members before it graduates. */
  graduationStreak: number
  maxGroupSize: number
  /** General-pool items served between two confusion bursts. */
  burstCooldown: number
  /**
   * Let a long streak push new characters forward: the current lesson takes a
   * bigger share of the draw and unlocks on less repetition. Off means the
   * textbook pace regardless of how well the session is going.
   */
  adaptivePace: boolean
  /** Accept Nihon-shiki/Kunrei spellings (si, tu, hu, ...) as correct. */
  acceptAliases: boolean
  /** Timed mode: running out of time scores the character as a miss. */
  timeLimitEnabled: boolean
  timeLimitMs: number
  /** Tighten the clock as the streak grows. */
  speedRamp: boolean
  showGroupHint: boolean
  /** Write mode: keep the outline visible even on mastered characters. */
  writeAlwaysOutline: boolean
  /** Write mode: hanzi-writer stroke grading; higher is more forgiving. */
  writeLeniency: number
  /** Write mode: animate the stroke order the first time a kana appears. */
  writeDemoOnNew: boolean
  theme: ThemePreference
  language: LanguagePreference
  soundEnabled: boolean
  /** 0–1, applied to every effect. */
  soundVolume: number
}

export interface SelectionState {
  /** kana id → selected. Spans both scripts; the tab is only a view. */
  enabled: Record<string, boolean>
  lastTab: Script
}

// ----------------------------------------------------------------- session

/** What the current prompt asks for: type the rōmaji, or trace the kana. */
export type ExerciseType = "read" | "write"

/** Why the scheduler picked the current kana — drives the drill's hint badge. */
export type PickSource = { type: "pool" } | { type: "group"; groupId: string }

export interface Pick {
  id: string
  source: PickSource
}

/** In-flight forced sequence of a confusion group. Never persisted. */
export interface Burst {
  groupId: string
  queue: Array<string>
}

export type DrillPhase = "prompt" | "correct" | "retry"

export interface SessionState {
  id: string
  startedAt: number
  /** Kana currently on screen, or `null` before the first pick / after ending. */
  current: Pick | null
  /** Whether the current prompt is a reading or a writing exercise. */
  exercise: ExerciseType
  /** When the current kana was shown, for the response timer. */
  shownAt: number
  input: string
  phase: DrillPhase
  /** Whether the current kana has already been missed once. */
  missedCurrent: boolean
  /** First time this kana is ever shown — the drill gives away the reading. */
  introducing: boolean
  /** The clock ran out on the current kana, rather than a wrong answer. */
  timedOut: boolean
  lastShownId: string | null
  burst: Burst | null
  /** General-pool items served since the last burst ended. */
  sinceBurst: number
  attempts: number
  correct: number
  streak: number
  bestStreak: number
  /**
   * Consecutive correct first attempts on the characters of the lesson being
   * introduced — the streak the adaptive pacing runs on. Answers on review
   * kana never touch it, and it resets the moment a new lesson unlocks.
   */
  lessonStreak: number
  /** Group ids that graduated during this session, for the summary. */
  graduated: Array<string>
  /** Lesson ids unlocked during this session, for the summary. */
  unlocked: Array<string>
  /** The session's best streak beat the all-time record. Set on finish. */
  newRecord: boolean
  ended: boolean
}
