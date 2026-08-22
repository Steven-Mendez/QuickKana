import { createRouter as createTanStackRouter } from "@tanstack/react-router"
// Side effect: i18next must be initialized before any route calls useTranslation.
import "@/lib/i18n"
import { routeTree } from "./routeTree.gen"

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
