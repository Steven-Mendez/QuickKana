import { describe, expect, it } from "vitest"
import { isCorrect, normalizeRomaji } from "@/lib/kana/romaji"
import { requireKana, resolveTyped } from "@/lib/kana"

const tsu = requireKana("hiragana:つ")
const shi = requireKana("hiragana:し")
const kaTsu = requireKana("katakana:ツ")
const kaShi = requireKana("katakana:シ")

describe("normalizeRomaji", () => {
  it("folds case, spacing, macrons and the n' spellings", () => {
    expect(normalizeRomaji("  TSU ")).toBe("tsu")
    expect(normalizeRomaji("ō")).toBe("o")
    expect(normalizeRomaji("n'")).toBe("n")
    expect(normalizeRomaji("nn")).toBe("n")
  })
})

describe("isCorrect", () => {
  it("accepts the canonical Hepburn spelling", () => {
    expect(isCorrect("tsu", tsu, true)).toBe(true)
    expect(isCorrect("tsu", tsu, false)).toBe(true)
  })

  it("accepts Nihon-shiki aliases only when enabled", () => {
    expect(isCorrect("tu", tsu, true)).toBe(true)
    expect(isCorrect("tu", tsu, false)).toBe(false)
    expect(isCorrect("si", shi, true)).toBe(true)
    expect(isCorrect("si", shi, false)).toBe(false)
  })

  it("rejects empty and wrong answers", () => {
    expect(isCorrect("", tsu, true)).toBe(false)
    expect(isCorrect("shi", tsu, true)).toBe(false)
  })
})

describe("resolveTyped", () => {
  it("attributes a wrong answer to the kana it actually spells", () => {
    expect(resolveTyped("shi", tsu)).toBe("hiragana:し")
  })

  it("stays inside the script the user was looking at", () => {
    expect(resolveTyped("shi", kaTsu)).toBe("katakana:シ")
    expect(resolveTyped("tsu", kaShi)).toBe("katakana:ツ")
  })

  it("returns null for gibberish so typos never build groups", () => {
    expect(resolveTyped("qqq", tsu)).toBeNull()
    expect(resolveTyped("", tsu)).toBeNull()
  })

  it("returns null when an alias circles back to the prompt itself", () => {
    expect(resolveTyped("tu", tsu)).toBeNull()
  })
})
