import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { historyStore, progressStore } from "@/stores/progress.store"
import { writingStore } from "@/stores/writing.store"
import { groupToServer, progressionToServer, syncableSettings } from "./batch"
import { settingsStore } from "@/stores/settings.store"
import { selectionStore } from "@/stores/selection.store"

const iso = (msValue: number | null | undefined): string | null =>
  msValue ? new Date(msValue).toISOString() : null

/**
 * Builds the guest snapshot for import_local_snapshot. Absolute values, not
 * deltas — the RPC only ever seeds an empty account, and only once.
 */
export function buildSnapshot(now = Date.now()): Record<string, unknown> {
  const updatedAt = new Date(now).toISOString()
  const progress = progressStore.state
  const writing = writingStore.state

  // The local matrix is directional; the server stores symmetric canonical
  // pairs, so both directions fold into one count.
  const pairCounts = new Map<string, number>()
  for (const [shown, row] of Object.entries(progress.matrix)) {
    for (const [answered, count] of Object.entries(row)) {
      if (shown === answered) continue
      const [a, b] = shown < answered ? [shown, answered] : [answered, shown]
      const key = `${a}|${b}`
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + count)
    }
  }

  return {
    char_stats: Object.entries(progress.charStats).map(([kana, stat]) => ({
      kana,
      attempts: stat.attempts,
      correct: stat.correct,
      streak: stat.streak,
      best_streak: stat.bestStreak,
      total_ms: stat.totalMs,
      weight: stat.weight,
      last_seen_at: iso(stat.lastSeenAt),
    })),
    writing_char_stats: Object.entries(writing.charStats).map(
      ([kana, stat]) => ({
        kana,
        attempts: stat.attempts,
        correct: stat.correct,
        streak: stat.streak,
        best_streak: stat.bestStreak,
        total_ms: stat.totalMs,
        weight: stat.weight,
        last_seen_at: iso(stat.lastSeenAt),
        stroke_mistakes: stat.strokeMistakes,
        memory_correct: stat.memoryCorrect,
      })
    ),
    confusion_pairs: [...pairCounts.entries()].map(([key, count]) => {
      const [a, b] = key.split("|")
      return { kana_a: a, kana_b: b, count, last_at: updatedAt }
    }),
    typos: Object.entries(progress.typos).flatMap(([kana, byText]) =>
      Object.entries(byText).map(([text, count]) => ({
        kana,
        typo_text: text,
        count,
      }))
    ),
    groups: Object.values(progress.groups).map((g) =>
      groupToServer(g, updatedAt)
    ),
    progression: progressionToServer(updatedAt),
    totals: {
      reading_sessions: progress.totals.sessions,
      writing_sessions: writing.totals.sessions,
    },
    settings: {
      settings: syncableSettings(settingsStore.state),
      selection: selectionStore.state,
      updated_at: updatedAt,
    },
    attempts: historyStore.state.slice(-2000).map((record) => ({
      id: crypto.randomUUID(),
      modality: "reading",
      syllabary: record.id.startsWith("katakana") ? "katakana" : "hiragana",
      kana: record.id,
      expected: record.expected,
      answer: record.typed,
      is_correct: record.correct,
      confused_with: record.confusedWith,
      is_typo: !record.correct && !record.confusedWith && record.typed !== "",
      response_ms: Math.round(record.ms),
      session_id: record.sessionId,
      client_created_at: new Date(record.t).toISOString(),
    })),
  }
}

export type ImportStatus = "imported" | "skipped"

/** Idempotent: the server refuses to import twice or over existing data. */
export async function importLocalSnapshot(): Promise<ImportStatus> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.rpc("import_local_snapshot", {
    snapshot: JSON.parse(JSON.stringify(buildSnapshot())),
  })
  if (error) throw new Error(`import failed: ${error.message}`)
  const status = (data as { status?: string } | null)?.status
  return status === "imported" ? "imported" : "skipped"
}
