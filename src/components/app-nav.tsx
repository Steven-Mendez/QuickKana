import { Link, useRouterState } from "@tanstack/react-router"
import {
  BarChart3,
  Grid2x2,
  Settings as SettingsIcon,
  UserRound,
} from "lucide-react"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"
import { authStore } from "@/stores/auth.store"
import { LanguageToggle } from "@/components/language-toggle"
import { SyncIndicator } from "@/components/sync-indicator"
import { SoundToggle } from "@/components/sound-toggle"
import { ThemeToggle } from "@/components/theme-toggle"

const LINKS = [
  { to: "/", labelKey: "nav.practice", icon: Grid2x2 },
  { to: "/stats", labelKey: "nav.stats", icon: BarChart3 },
  { to: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
] as const

/**
 * Two navs, one at a time: on phones the page links live in a bottom tab bar
 * (thumb reach), and the top bar keeps only the identity and the toggles; from
 * `sm` up everything is in the top bar and the tab bar is gone.
 */
export function AppNav() {
  const { t } = useTranslation()
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4">
          <Link to="/" className="me-3 flex items-center gap-2">
            <img
              src="/favicon.svg"
              alt=""
              width={26}
              height={26}
              className="rounded-md"
            />
            <span className="text-sm font-semibold tracking-tight">
              QuickKana
            </span>
          </Link>

          <div className="flex flex-1 items-center gap-1">
            {LINKS.map(({ to, labelKey, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground sm:flex"
              >
                <Icon className="size-4" />
                <span>{t(labelKey)}</span>
              </Link>
            ))}
          </div>

          <SyncIndicator />
          <LanguageToggle />
          <SoundToggle />
          <ThemeToggle />
          <AccountLink />
        </nav>
      </header>
      <MobileTabBar />
    </>
  )
}

/** Points at /account when signed in, /auth/login otherwise. Top bar, sm+. */
function AccountLink() {
  const { t } = useTranslation()
  const signedIn = useSelector(authStore, (s) => s.status === "signedIn")
  return (
    <Link
      to={signedIn ? "/account" : "/auth/login"}
      aria-label={t(signedIn ? "nav.account" : "nav.signIn")}
      className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground sm:flex"
    >
      <UserRound className="size-4" />
      <span>{t(signedIn ? "nav.account" : "nav.signIn")}</span>
    </Link>
  )
}

/**
 * Phone-only bottom navigation. Hidden during the drill: that screen is a
 * timed exercise and every stolen pixel (and accidental tap) hurts there —
 * RootComponent drops the matching content padding on the same condition.
 */
function MobileTabBar() {
  const { t } = useTranslation()
  const signedIn = useSelector(authStore, (s) => s.status === "signedIn")
  const onDrill = useRouterState({
    select: (s) => s.location.pathname === "/practice",
  })
  if (onDrill) return null

  const items = [
    ...LINKS,
    {
      to: signedIn ? ("/account" as const) : ("/auth/login" as const),
      labelKey: signedIn ? ("nav.account" as const) : ("nav.signIn" as const),
      icon: UserRound,
    },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <div className="grid h-14 grid-cols-4">
        {items.map(({ to, labelKey, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground transition-colors data-[status=active]:text-primary"
          >
            <Icon className="size-5" />
            {t(labelKey)}
          </Link>
        ))}
      </div>
    </nav>
  )
}
