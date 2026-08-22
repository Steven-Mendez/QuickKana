import { Link } from "@tanstack/react-router"
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
import { SoundToggle } from "@/components/sound-toggle"
import { ThemeToggle } from "@/components/theme-toggle"

const LINKS = [
  { to: "/", labelKey: "nav.practice", icon: Grid2x2 },
  { to: "/stats", labelKey: "nav.stats", icon: BarChart3 },
  { to: "/settings", labelKey: "nav.settings", icon: SettingsIcon },
] as const

export function AppNav() {
  const { t } = useTranslation()
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
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
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{t(labelKey)}</span>
            </Link>
          ))}
        </div>

        <LanguageToggle />
        <SoundToggle />
        <ThemeToggle />
        <AccountLink />
      </nav>
    </header>
  )
}

/** Points at /account when signed in, /auth/login otherwise. */
function AccountLink() {
  const { t } = useTranslation()
  const signedIn = useSelector(authStore, (s) => s.status === "signedIn")
  return (
    <Link
      to={signedIn ? "/account" : "/auth/login"}
      aria-label={t(signedIn ? "nav.account" : "nav.signIn")}
      className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground data-[status=active]:bg-accent data-[status=active]:text-foreground"
    >
      <UserRound className="size-4" />
      <span className="hidden sm:inline">
        {t(signedIn ? "nav.account" : "nav.signIn")}
      </span>
    </Link>
  )
}
