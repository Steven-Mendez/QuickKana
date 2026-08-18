import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"

import { AppNav } from "@/components/app-nav"
import appCss from "../styles.css?url"

/**
 * Runs before React paints so a dark-mode user never sees a white flash. Kept
 * inline and dependency-free on purpose — it has to be the first thing to run.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var pref = JSON.parse(localStorage.getItem("qk:theme") || '"system"');
    var dark = pref === "dark" || (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "QuickKana — hiragana and katakana practice" },
      {
        name: "description",
        content: "Keyboard kana drills with character confusion tracking.",
      },
      { name: "theme-color", content: "#ef3924" },
      { property: "og:title", content: "QuickKana" },
      {
        property: "og:description",
        content: "Keyboard kana drills with character confusion tracking.",
      },
      { property: "og:image", content: "/og.png" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/og.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-6 pt-16">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-muted-foreground">This page does not exist.</p>
    </main>
  ),
  shellComponent: RootDocument,
  component: () => (
    <>
      <AppNav />
      <Outlet />
    </>
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-svh bg-background text-foreground antialiased">
        {children}
        <TanStackDevtools
          config={{ position: "bottom-right" }}
          plugins={[
            {
              name: "Tanstack Router",
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
