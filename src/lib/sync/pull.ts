import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { STORAGE_KEYS, savePersisted } from "@/lib/storage"
import {
  emptyProgress,
  historyStore,
  progressStore,
} from "@/stores/progress.store"
import { emptyWriting, writingStore } from "@/stores/writing.store"
import { progressionStore } from "@/stores/progression.store"
import { DEFAULT_SETTINGS, settingsStore } from "@/stores/settings.store"
import { selectionStore } from "@/stores/selection.store"
import { emptyCharStat } from "@/lib/scheduler"
import { setApplyingRemote } from "./queue"
import type {
  AttemptRecord,
  CharStat,
  ProgressState,
  Settings,
  WriteCharStat,
  WritingState,
} from "@/lib/types"
import type { ProgressionState } from "@/stores/progression.store"
import type { Tables } from "@/types/database.types"

const ms = (value: string | null): number =>
  value ? new Date(value).getTime() : 0

const toCharStat = (row: Tables<"char_stats">): CharStat => ({
  ...emptyCharStat(),
  attempts: row.attempts,
  correct: row.correct,
  streak: row.streak,
  bestStreak: row.best_streak,
  totalMs: Number(row.total_ms),
  lastSeenAt: ms(row.last_seen_at),
  weight: row.weight,
})

/**
 * Downloads the account state and replaces the local stores with it — the
 * server is the authority across devices. The device's previous state is
 * saved under `qk:v1:pre-sync-backup` first, so nothing is ever silently
 * destroyed. Device-local preferences (theme, language) are kept.
 */
export async function pullAll(): Promise<void> {
  const supabase = getSupabaseBrowserClient()

  const [
    charStats,
    writingCharStats,
    pairs,
    groups,
    typos,
    progression,
    totals,
    settings,
    attempts,
  ] = await Promise.all([
    supabase.from("char_stats").select("*"),
    supabase.from("writing_char_stats").select("*"),
    supabase.from("confusion_pairs").select("*"),
    supabase.from("confusion_groups").select("*"),
    supabase.from("typos").select("*"),
    supabase.from("progression").select("*").maybeSingle(),
    supabase.from("user_totals").select("*").maybeSingle(),
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase
      .from("attempts")
      .select("*")
      .eq("modality", "reading")
      .order("created_at", { ascending: false })
      .limit(2000),
  ])

  const failed = [
    charStats.error,
    writingCharStats.error,
    pairs.error,
    groups.error,
    typos.error,
    progression.error,
    totals.error,
    settings.error,
    attempts.error,
  ].find(Boolean)
  if (failed) throw new Error(`sync pull failed: ${failed.message}`)

  // ---- build the local shapes -------------------------------------------

  const progress: ProgressState = emptyProgress()
  for (const row of charStats.data ?? []) {
    progress.charStats[row.kana] = toCharStat(row)
    progress.totals.attempts += row.attempts
    progress.totals.correct += row.correct
    progress.totals.totalMs += Number(row.total_ms)
  }
  // Direction is not stored server-side (pairs are symmetric by design);
  // one canonical direction is enough for pairMisses(), which sums both.
  for (const row of pairs.data ?? []) {
    progress.matrix[row.kana_a] = {
      ...progress.matrix[row.kana_a],
      [row.kana_b]: row.count,
    }
  }
  for (const row of typos.data ?? []) {
    progress.typos[row.kana] = {
      ...progress.typos[row.kana],
      [row.typo_text]: row.count,
    }
  }
  for (const row of groups.data ?? []) {
    progress.groups[row.id] = {
      id: row.id,
      members: row.members,
      status: row.status,
      totalMisses: row.total_misses,
      streak: row.streak,
      activatedAt: ms(row.activated_at),
      graduatedAt: row.graduated_at ? ms(row.graduated_at) : null,
      timesActivated: row.times_activated,
    }
  }
  progress.totals.sessions = totals.data?.reading_sessions ?? 0

  const writing: WritingState = emptyWriting()
  for (const row of writingCharStats.data ?? []) {
    const stat: WriteCharStat = {
      ...toCharStat(row),
      strokeMistakes: row.stroke_mistakes,
      memoryCorrect: row.memory_correct,
    }
    writing.charStats[row.kana] = stat
    writing.totals.attempts += row.attempts
    writing.totals.correct += row.correct
    writing.totals.totalMs += Number(row.total_ms)
  }
  writing.totals.sessions = totals.data?.writing_sessions ?? 0

  const history: Array<AttemptRecord> = (attempts.data ?? [])
    .slice()
    .reverse()
    .map((row) => ({
      t: ms(row.client_created_at),
      id: row.kana,
      expected: row.expected,
      typed: row.answer,
      correct: row.is_correct,
      ms: row.response_ms,
      confusedWith: row.confused_with,
      sessionId: row.session_id ?? "",
    }))

  const local = progressionStore.state
  const remoteProgression: ProgressionState | null = progression.data
    ? {
        version: 1,
        mode: progression.data.mode === "free" ? "free" : "journey",
        track: progression.data.track === "katakana" ? "katakana" : "hiragana",
        lessons: {
          hiragana: progression.data.lesson_hiragana,
          katakana: progression.data.lesson_katakana,
        },
        unlockedAt:
          (progression.data.unlocked_at as Record<string, number> | null) ?? {},
        day: {
          last: progression.data.day_last,
          streak: progression.data.day_streak,
          best: progression.data.day_best,
        },
        records: {
          bestSessionStreak: progression.data.best_session_streak,
          bestAccuracy: progression.data.best_accuracy,
        },
      }
    : null

  const localSettings = settingsStore.state
  const remoteSettings: Settings | null = settings.data
    ? {
        ...DEFAULT_SETTINGS,
        ...(settings.data.settings as Partial<Settings>),
        // Per-device by decision; never overwritten by another device.
        theme: localSettings.theme,
        language: localSettings.language,
      }
    : null

  const remoteSelection = settings.data?.selection as
    typeof selectionStore.state | null

  // ---- backup, then apply ------------------------------------------------

  savePersisted(STORAGE_KEYS.preSyncBackup, {
    at: Date.now(),
    progress: progressStore.state,
    writing: writingStore.state,
    progression: local,
    settings: localSettings,
    selection: selectionStore.state,
    history: historyStore.state,
  })

  setApplyingRemote(true)
  try {
    progressStore.setState(() => progress)
    writingStore.setState(() => writing)
    historyStore.setState(() => history)
    if (remoteProgression) progressionStore.setState(() => remoteProgression)
    if (remoteSettings) settingsStore.setState(() => remoteSettings)
    if (remoteSelection && typeof remoteSelection.enabled === "object") {
      selectionStore.setState(() => remoteSelection)
    }
  } finally {
    setApplyingRemote(false)
  }
}
