import { describe, expect, it } from "vitest"
import i18n from "@/lib/i18n"
import { en } from "@/lib/i18n/locales/en"
import { es } from "@/lib/i18n/locales/es"

/** Every leaf key path of a nested catalog, dot-joined. */
function keyPaths(obj: Record<string, unknown>, prefix = ""): Array<string> {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === "object" && value !== null) {
      return keyPaths(value as Record<string, unknown>, path)
    }
    return [path]
  })
}

function leafValues(obj: Record<string, unknown>): Array<[string, string]> {
  return keyPaths(obj).map((path) => {
    const value = path
      .split(".")
      .reduce<unknown>(
        (node, part) => (node as Record<string, unknown>)[part],
        obj
      )
    return [path, value as string]
  })
}

const placeholders = (value: string): Array<string> =>
  [...value.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1] ?? "").sort()

describe("i18n catalogs", () => {
  // TypeScript already enforces this via `const es: typeof en`; this catches
  // what types cannot — runtime drift and empty strings.
  it("en and es expose exactly the same keys", () => {
    expect(keyPaths(es).sort()).toEqual(keyPaths(en).sort())
  })

  it("no translation is an empty string", () => {
    for (const [path, value] of [...leafValues(en), ...leafValues(es)]) {
      expect(value, path).toBeTypeOf("string")
      expect(value.trim(), path).not.toBe("")
    }
  })

  it("es keeps every interpolation placeholder that en uses", () => {
    const esByPath = new Map(leafValues(es))
    for (const [path, enValue] of leafValues(en)) {
      expect(placeholders(esByPath.get(path) ?? ""), path).toEqual(
        placeholders(enValue)
      )
    }
  })

  it("pluralizes in both languages", () => {
    i18n.changeLanguage("en")
    expect(i18n.t("summary.unlockedTitle", { count: 1 })).toBe(
      "Lesson unlocked"
    )
    expect(i18n.t("summary.unlockedTitle", { count: 2 })).toBe(
      "Lessons unlocked"
    )
    i18n.changeLanguage("es")
    expect(i18n.t("summary.unlockedTitle", { count: 1 })).toBe(
      "Lección desbloqueada"
    )
    expect(i18n.t("summary.unlockedTitle", { count: 2 })).toBe(
      "Lecciones desbloqueadas"
    )
    i18n.changeLanguage("en")
  })
})
