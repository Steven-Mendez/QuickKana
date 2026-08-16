import { ALL_KANA, ROWS_BY_SCRIPT, SCRIPTS, kanaId } from "./data"
import { normalizeRomaji } from "./romaji"
import type { Kana, KanaCategory, Script } from "@/lib/types"

export { ALL_KANA, ROWS_BY_SCRIPT, SCRIPTS, kanaId }

export const KANA_BY_ID: Map<string, Kana> = new Map(
  ALL_KANA.map((kana) => [kana.id, kana])
)

export const getKana = (id: string): Kana | undefined => KANA_BY_ID.get(id)

/** Throws on unknown ids — callers already hold ids that came from the catalogue. */
export function requireKana(id: string): Kana {
  const kana = KANA_BY_ID.get(id)
  if (!kana) throw new Error(`Unknown kana id: ${id}`)
  return kana
}

/**
 * Normalised rōmaji → every kana that reads that way, across both scripts and
 * including alternative spellings. This is what lets a wrong answer be
 * attributed to the character the user actually meant.
 */
export const ROMAJI_INDEX: Map<string, Array<Kana>> = (() => {
  const index = new Map<string, Array<Kana>>()
  for (const kana of ALL_KANA) {
    for (const spelling of [kana.romaji, ...kana.alt]) {
      const key = normalizeRomaji(spelling)
      const bucket = index.get(key)
      if (bucket) bucket.push(kana)
      else index.set(key, [kana])
    }
  }
  return index
})()

export const CATEGORIES: Array<{ id: KanaCategory; label: string }> = [
  { id: "gojuon", label: "Basics" },
  { id: "dakuten", label: "Dakuten" },
  { id: "digraph", label: "Digraphs" },
]

export const SCRIPT_LABELS: Record<Script, string> = {
  hiragana: "Hiragana",
  katakana: "Katakana",
}

export const displayPair = (ids: Array<string>): string =>
  ids.map((id) => getKana(id)?.char ?? "?").join(" vs ")

/**
 * Maps a wrong answer back to the kana the user most likely mistook the prompt
 * for, so the confusion matrix records `つ → し` rather than just "missed つ".
 *
 * Returns `null` when the answer spells no kana at all — a plain typo. Those
 * are kept in a separate bucket so random keystrokes can never manufacture a
 * confusion group.
 */
export function resolveTyped(typed: string, shown: Kana): string | null {
  const candidates = ROMAJI_INDEX.get(normalizeRomaji(typed))
  if (!candidates || candidates.length === 0) return null

  // シ vs ソ is a katakana problem, so an answer is attributed to the script
  // the user was actually looking at before falling back to the other one.
  const sameScript = candidates.filter((kana) => kana.script === shown.script)
  const pool = sameScript.length > 0 ? sameScript : candidates

  const sameCategory = pool.find((kana) => kana.category === shown.category)
  const resolved = sameCategory ?? pool[0]
  if (!resolved) return null

  // An alias that circles back to the prompt itself is not a confusion.
  return resolved.id === shown.id ? null : resolved.id
}
