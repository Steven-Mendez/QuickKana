import { getKana } from "@/lib/kana"
import type { CharDataLoaderFn, CharacterJson } from "hanzi-writer"
import type { Kana } from "@/lib/types"

/**
 * Stroke data for the Write mode lives in `public/kana-data/`, one JSON per
 * character (see its README for provenance), and is fetched lazily so a drill
 * only ever downloads the characters it actually shows.
 */

/**
 * Whether the Write mode can quiz this character. Digraphs are two glyphs —
 * hanzi-writer quizzes one glyph at a time — so they stay in Read only. Every
 * single-glyph character in the catalogue has vendored stroke data; the
 * generation script fails the build of the dataset otherwise.
 */
export const isWritable = (kana: Kana): boolean => kana.category !== "digraph"

/** Filters a drill pool down to what the Write mode can serve. */
export const writableIds = (ids: Array<string>): Array<string> =>
  ids.filter((id) => {
    const kana = getKana(id)
    return kana !== undefined && isWritable(kana)
  })

const cache = new Map<string, Promise<CharacterJson>>()

export function loadStrokeData(char: string): Promise<CharacterJson> {
  const hit = cache.get(char)
  if (hit) return hit

  const promise = fetch(
    `/kana-data/${encodeURIComponent(char.normalize("NFC"))}.json`
  ).then((response) => {
    if (!response.ok) throw new Error(`No stroke data for ${char}`)
    return response.json() as Promise<CharacterJson>
  })

  // Only successful loads stay cached: a flaky network must not poison a
  // character for the rest of the session.
  cache.set(char, promise)
  promise.catch(() => cache.delete(char))
  return promise
}

/** Adapter for hanzi-writer's callback-style loader option. */
export const charDataLoader: CharDataLoaderFn = (char, onLoad, onError) => {
  loadStrokeData(char).then(onLoad).catch(onError)
}
