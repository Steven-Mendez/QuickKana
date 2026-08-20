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

export interface Settings {
  focusMode: boolean
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
  theme: ThemePreference
}

export interface SelectionState {
  /** kana id → selected. Spans both scripts; the tab is only a view. */
  enabled: Record<string, boolean>
  lastTab: Script
}

// ----------------------------------------------------------------- session

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
  ended: boolean
}
