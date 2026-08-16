import type { Kana } from "@/lib/types"

const MACRONS: Record<string, string> = {
  ā: "a",
  ī: "i",
  ū: "u",
  ē: "e",
  ō: "o",
  â: "a",
  î: "i",
  û: "u",
  ê: "e",
  ô: "o",
}

/**
 * Folds a typed answer into the form used as the lookup key: lowercase, no
 * surrounding space, macrons flattened, and the `n'`/`nn` spellings of ん
 * collapsed to a bare `n`.
 */
export function normalizeRomaji(input: string): string {
  let s = input.trim().toLowerCase().replace(/\s+/g, "")
  s = s.replace(/[āīūēōâîûêô]/g, (ch) => MACRONS[ch] ?? ch)
  s = s.replace(/'/g, "").replace(/[’ʼ]/g, "")
  if (s === "nn") s = "n"
  return s
}

/**
 * Whether a typed answer counts as correct for `kana`. With `acceptAliases`
 * off, only the canonical Hepburn spelling passes.
 */
export function isCorrect(
  typed: string,
  kana: Kana,
  acceptAliases: boolean
): boolean {
  const answer = normalizeRomaji(typed)
  if (!answer) return false
  const accepted = acceptAliases ? [kana.romaji, ...kana.alt] : [kana.romaji]
  return accepted.some((spelling) => normalizeRomaji(spelling) === answer)
}
