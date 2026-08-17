import { createStore } from "@tanstack/store"
import { STORAGE_KEYS, loadPersisted, persist } from "@/lib/storage"
import { ALL_KANA } from "@/lib/kana"
import type { Script, SelectionState } from "@/lib/types"

/** First run starts on hiragana gojūon — the same place a learner would. */
function defaultSelection(): SelectionState {
  const enabled: Record<string, boolean> = {}
  for (const kana of ALL_KANA) {
    if (kana.script === "hiragana" && kana.category === "gojuon") {
      enabled[kana.id] = true
    }
  }
  return { enabled, lastTab: "hiragana" }
}

const isSelection = (value: unknown): value is SelectionState =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as SelectionState).enabled === "object"

export const selectionStore = createStore<SelectionState>(
  loadPersisted<SelectionState>(
    STORAGE_KEYS.selection,
    defaultSelection(),
    isSelection
  )
)

persist(selectionStore, STORAGE_KEYS.selection)

/** Bulk toggle used by rows, columns, categories and whole scripts. */
export const setMany = (ids: Array<string>, enabled: boolean) =>
  selectionStore.setState((prev) => {
    const next = { ...prev.enabled }
    for (const id of ids) {
      if (enabled) next[id] = true
      else delete next[id]
    }
    return { ...prev, enabled: next }
  })

export const toggleKana = (id: string) =>
  selectionStore.setState((prev) => {
    const next = { ...prev.enabled }
    if (next[id]) delete next[id]
    else next[id] = true
    return { ...prev, enabled: next }
  })

/** Replaces the whole selection — what the quick presets do. */
export const selectOnly = (ids: Array<string>) =>
  selectionStore.setState((prev) => ({
    ...prev,
    enabled: Object.fromEntries(ids.map((id) => [id, true])),
  }))

export const setTab = (lastTab: Script) =>
  selectionStore.setState((prev) => ({ ...prev, lastTab }))

export const clearSelection = () =>
  selectionStore.setState((prev) => ({ ...prev, enabled: {} }))

export const resetSelection = () =>
  selectionStore.setState(() => defaultSelection())

/** Kana ids currently selected, in table order so drills are reproducible. */
export const selectedIds = (state: SelectionState): Array<string> =>
  ALL_KANA.filter((kana) => state.enabled[kana.id]).map((kana) => kana.id)
