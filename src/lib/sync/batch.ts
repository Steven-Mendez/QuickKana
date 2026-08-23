import { progressStore } from "@/stores/progress.store"
import { writingStore } from "@/stores/writing.store"
import { progressionStore } from "@/stores/progression.store"
import { settingsStore } from "@/stores/settings.store"
import { selectionStore } from "@/stores/selection.store"
import type { ConfusionGroup, Settings } from "@/lib/types"
import type { PendingState } from "./types"

const iso = (ms: number | undefined | null): string | null =>
  ms ? new Date(ms).toISOString() : null

/** Theme and language are per-device by decision; they never leave it. */
export function syncableSettings(settings: Settings): Record<string, unknown> {
  const { theme, language, ...rest } = settings
  return rest
}

export function groupToServer(group: ConfusionGroup, updatedAt: string) {
  return {
    id: group.id,
    members: group.members,
    status: group.status,
    total_misses: group.totalMisses,
    streak: group.streak,
    activated_at: iso(group.activatedAt) ?? updatedAt,
    graduated_at: iso(group.graduatedAt),
    times_activated: group.timesActivated,
    updated_at: updatedAt,
  }
}

export function progressionToServer(updatedAt: string) {
  const p = progressionStore.state
  return {
    mode: p.mode,
    track: p.track,
    lesson_hiragana: p.lessons.hiragana,
    lesson_katakana: p.lessons.katakana,
    unlocked_at: p.unlockedAt,
    day_last: p.day.last,
    day_streak: p.day.streak,
    day_best: p.day.best,
    best_session_streak: p.records.bestSessionStreak,
    best_accuracy: p.records.bestAccuracy,
    updated_at: updatedAt,
  }
}

/**
 * Turns the pending deltas into the `aggregates` argument of sync_push.
 * Counters ship as deltas; weight/streak/best/last-seen are read from the
 * stores *now* — they are point-in-time values the server applies LWW.
 */
export function buildAggregates(
  pending: PendingState,
  now = Date.now()
): Record<string, unknown> {
  const updatedAt = new Date(now).toISOString()
  const aggregates: Record<string, unknown> = {}

  const charStats = Object.entries(pending.charStats).map(([kana, delta]) => {
    const stat = progressStore.state.charStats[kana]
    return {
      kana,
      ...delta,
      streak: stat?.streak ?? 0,
      best_streak: stat?.bestStreak ?? 0,
      weight: stat?.weight ?? 1,
      last_seen_at: iso(stat?.lastSeenAt),
    }
  })
  if (charStats.length > 0) aggregates.char_stats = charStats

  const writingCharStats = Object.entries(pending.writingCharStats).map(
    ([kana, delta]) => {
      const stat = writingStore.state.charStats[kana]
      return {
        kana,
        ...delta,
        streak: stat?.streak ?? 0,
        best_streak: stat?.bestStreak ?? 0,
        weight: stat?.weight ?? 1,
        last_seen_at: iso(stat?.lastSeenAt),
      }
    }
  )
  if (writingCharStats.length > 0) {
    aggregates.writing_char_stats = writingCharStats
  }

  const pairs = Object.entries(pending.confusionPairs).map(([key, delta]) => {
    const [a, b] = key.split("|")
    return {
      kana_a: a,
      kana_b: b,
      d_count: delta.d_count,
      last_at: delta.last_at,
    }
  })
  if (pairs.length > 0) aggregates.confusion_pairs = pairs

  const typos = Object.entries(pending.typos).map(([key, count]) => {
    const sep = key.indexOf("\n")
    return {
      kana: key.slice(0, sep),
      typo_text: key.slice(sep + 1),
      d_count: count,
    }
  })
  if (typos.length > 0) aggregates.typos = typos

  if (pending.groupsDirty) {
    aggregates.groups = Object.values(progressStore.state.groups).map((g) =>
      groupToServer(g, updatedAt)
    )
  }

  if (pending.dReadingSessions > 0 || pending.dWritingSessions > 0) {
    aggregates.totals = {
      d_reading_sessions: pending.dReadingSessions,
      d_writing_sessions: pending.dWritingSessions,
    }
  }

  if (pending.progressionDirty) {
    aggregates.progression = progressionToServer(updatedAt)
  }

  if (pending.settingsDirty) {
    aggregates.settings = {
      settings: syncableSettings(settingsStore.state),
      selection: selectionStore.state,
      updated_at: updatedAt,
    }
  }

  return aggregates
}
