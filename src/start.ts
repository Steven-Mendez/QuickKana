import { createStart } from "@tanstack/react-start"

/**
 * Every piece of state in QuickKana lives in localStorage, so there is nothing
 * meaningful to render on the server — SSR would only produce hydration
 * mismatches between the empty server render and the persisted client state.
 */
export const startInstance = createStart(() => ({
  defaultSsr: false,
}))
