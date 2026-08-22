import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useSelector } from "@tanstack/react-store"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { ResetDialog } from "@/components/reset-dialog"
import { rebuildGroupsFromSettings } from "@/stores/progress.store"
import {
  lessonOf,
  progressionStore,
  setLesson,
} from "@/stores/progression.store"
import { TRACKS, lessonAt } from "@/lib/journey"
import { PASSES_FLOOR, PASSES_FULL } from "@/lib/momentum"
import { MIN_TIME_LIMIT } from "@/lib/pressure"
import { SCRIPTS, SCRIPT_LABELS } from "@/lib/kana"
import { STORAGE_KEYS, savePersisted } from "@/lib/storage"
import { useLanguage } from "@/hooks/use-language"
import { useTheme } from "@/hooks/use-theme"
import {
  DEFAULT_SETTINGS,
  settingsStore,
  updateSettings,
} from "@/stores/settings.store"
import type { LanguagePreference, ThemePreference } from "@/lib/types"

export const Route = createFileRoute("/settings")({ component: SettingsPage })

const THEMES: Array<{
  value: ThemePreference
  labelKey:
    "settings.themeSystem" | "settings.themeLight" | "settings.themeDark"
}> = [
  { value: "system", labelKey: "settings.themeSystem" },
  { value: "light", labelKey: "settings.themeLight" },
  { value: "dark", labelKey: "settings.themeDark" },
]

// Language names are shown in their own language on purpose — a Spanish
// speaker stuck in English needs to find "Español", not "Spanish".
const LANGUAGES: Array<{ value: LanguagePreference; label: string | null }> = [
  { value: "system", label: null },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
]

function SettingsPage() {
  const { t } = useTranslation()
  const progression = useSelector(progressionStore, (s) => s)
  const settings = useSelector(settingsStore, (s) => s)
  const { theme, setTheme } = useTheme()
  const { language, setLanguage } = useLanguage()
  const navigate = useNavigate()

  const replayOnboarding = () => {
    // Re-arm both one-shot flags; the home route opens the welcome on mount.
    savePersisted(STORAGE_KEYS.welcomeSeen, false)
    savePersisted(STORAGE_KEYS.tourSeen, false)
    void navigate({ to: "/" })
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("settings.subtitle")}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("settings.practiceTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Reading and writing are both part of learning; either can be
              turned off, but never both — the drill needs something to serve. */}
          <Row
            id="practice-reading"
            title={t("settings.exerciseReadingTitle")}
            description={t("settings.exerciseReadingDesc")}
          >
            <Switch
              id="practice-reading"
              checked={settings.practiceReading}
              disabled={!settings.practiceWriting}
              onCheckedChange={(checked) =>
                updateSettings({ practiceReading: checked })
              }
            />
          </Row>

          <Row
            id="practice-writing"
            title={t("settings.exerciseWritingTitle")}
            description={t("settings.exerciseWritingDesc")}
          >
            <Switch
              id="practice-writing"
              checked={settings.practiceWriting}
              disabled={!settings.practiceReading}
              onCheckedChange={(checked) =>
                updateSettings({ practiceWriting: checked })
              }
            />
          </Row>

          <Separator />

          <Row
            id="accept-aliases"
            title={t("settings.aliasesTitle")}
            description={t("settings.aliasesDesc")}
          >
            <Switch
              id="accept-aliases"
              checked={settings.acceptAliases}
              onCheckedChange={(checked) =>
                updateSettings({ acceptAliases: checked })
              }
            />
          </Row>

          <Separator />

          <Row
            id="time-limit"
            title={t("settings.timedTitle")}
            description={t("settings.timedDesc")}
          >
            <Switch
              id="time-limit"
              checked={settings.timeLimitEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ timeLimitEnabled: checked })
              }
            />
          </Row>

          {settings.timeLimitEnabled && (
            <>
              <div className="space-y-2 ps-1">
                <div className="flex items-center justify-between text-sm">
                  <Label htmlFor="time-limit-value">
                    {t("settings.timePerChar")}
                  </Label>
                  <span className="text-muted-foreground tabular-nums">
                    {(settings.timeLimitMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <Slider
                  id="time-limit-value"
                  min={2000}
                  max={15000}
                  step={500}
                  value={settings.timeLimitMs}
                  onValueChange={(value) =>
                    updateSettings({ timeLimitMs: value as number })
                  }
                />
              </div>

              <Row
                id="speed-ramp"
                title={t("settings.rampTitle")}
                description={t("settings.rampDesc", {
                  seconds: (MIN_TIME_LIMIT / 1000).toFixed(1),
                })}
              >
                <Switch
                  id="speed-ramp"
                  checked={settings.speedRamp}
                  onCheckedChange={(checked) =>
                    updateSettings({ speedRamp: checked })
                  }
                />
              </Row>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("settings.writingTitle")}
          </CardTitle>
          <CardDescription>{t("settings.writingDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Row
            id="write-outline"
            title={t("settings.alwaysOutlineTitle")}
            description={t("settings.alwaysOutlineDesc")}
          >
            <Switch
              id="write-outline"
              checked={settings.writeAlwaysOutline}
              onCheckedChange={(checked) =>
                updateSettings({ writeAlwaysOutline: checked })
              }
            />
          </Row>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-6">
              <div className="space-y-0.5">
                <Label htmlFor="write-leniency" className="text-sm font-medium">
                  {t("settings.leniencyLabel")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("settings.leniencyDesc")}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {settings.writeLeniency.toFixed(1)}
              </span>
            </div>
            <Slider
              id="write-leniency"
              min={8}
              max={20}
              step={1}
              value={Math.round(settings.writeLeniency * 10)}
              onValueChange={(value) =>
                updateSettings({ writeLeniency: (value as number) / 10 })
              }
            />
          </div>

          <Separator />

          <Row
            id="write-demo"
            title={t("settings.writeDemoTitle")}
            description={t("settings.writeDemoDesc")}
          >
            <Switch
              id="write-demo"
              checked={settings.writeDemoOnNew}
              onCheckedChange={(checked) =>
                updateSettings({ writeDemoOnNew: checked })
              }
            />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("settings.adaptiveTitle")}
          </CardTitle>
          <CardDescription>{t("settings.adaptiveDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Row
            id="focus-mode"
            title={t("settings.focusTitle")}
            description={t("settings.focusDesc")}
          >
            <Switch
              id="focus-mode"
              checked={settings.focusMode}
              onCheckedChange={(checked) =>
                updateSettings({ focusMode: checked })
              }
            />
          </Row>

          <Separator />

          <NumberRow
            id="activation"
            label={t("settings.activationLabel")}
            description={t("settings.activationDesc")}
            value={settings.activationThreshold}
            min={1}
            max={6}
            onChange={(activationThreshold) => {
              updateSettings({ activationThreshold })
              // Re-derive the groups now: otherwise lowering the threshold
              // looks like it did nothing until the next missed character.
              rebuildGroupsFromSettings(settingsStore.state)
            }}
          />

          <NumberRow
            id="graduation"
            label={t("settings.graduationLabel")}
            description={t("settings.graduationDesc")}
            value={settings.graduationStreak}
            min={2}
            max={10}
            onChange={(graduationStreak) =>
              updateSettings({ graduationStreak })
            }
          />

          <NumberRow
            id="cooldown"
            label={t("settings.cooldownLabel")}
            description={t("settings.cooldownDesc")}
            value={settings.burstCooldown}
            min={0}
            max={20}
            onChange={(burstCooldown) => updateSettings({ burstCooldown })}
          />

          <Separator />

          <Row
            id="adaptive-pace"
            title={t("settings.paceTitle")}
            description={t("settings.paceDesc", {
              floor: PASSES_FLOOR,
              full: PASSES_FULL,
            })}
          >
            <Switch
              id="adaptive-pace"
              checked={settings.adaptivePace}
              onCheckedChange={(checked) =>
                updateSettings({ adaptivePace: checked })
              }
            />
          </Row>

          <Separator />

          <Row
            id="group-hint"
            title={t("settings.hintTitle")}
            description={t("settings.hintDesc")}
          >
            <Switch
              id="group-hint"
              checked={settings.showGroupHint}
              onCheckedChange={(checked) =>
                updateSettings({ showGroupHint: checked })
              }
            />
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("settings.appearanceTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {THEMES.map(({ value, labelKey }) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(value)}
              >
                {t(labelKey)}
              </Button>
            ))}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("settings.languageLabel")}</p>
            <div className="flex gap-2">
              {LANGUAGES.map(({ value, label }) => (
                <Button
                  key={value}
                  variant={language === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setLanguage(value)}
                >
                  {label ?? t("settings.languageAuto")}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("settings.soundTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Row
            id="sound-enabled"
            title={t("settings.soundEnabledTitle")}
            description={t("settings.soundEnabledDesc")}
          >
            <Switch
              id="sound-enabled"
              checked={settings.soundEnabled}
              onCheckedChange={(checked) =>
                updateSettings({ soundEnabled: checked })
              }
            />
          </Row>

          {settings.soundEnabled && (
            <div className="space-y-2 ps-1">
              <div className="flex items-center justify-between text-sm">
                <Label htmlFor="sound-volume">{t("settings.volume")}</Label>
                <span className="text-muted-foreground tabular-nums">
                  {Math.round(settings.soundVolume * 100)}%
                </span>
              </div>
              <Slider
                id="sound-volume"
                min={0}
                max={100}
                step={5}
                value={Math.round(settings.soundVolume * 100)}
                onValueChange={(value) =>
                  updateSettings({ soundVolume: (value as number) / 100 })
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("settings.journeyTitle")}
          </CardTitle>
          <CardDescription>{t("settings.journeyDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {SCRIPTS.map((script) => {
            const lesson = lessonOf(progression, script)
            const current = lessonAt(script, lesson)
            const last = TRACKS[script].length - 1
            return (
              <div key={script} className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">{SCRIPT_LABELS[script]}</span> —{" "}
                  <span className="font-medium tabular-nums">
                    {t("settings.lessonOf", {
                      number: lesson + 1,
                      total: last + 1,
                    })}
                  </span>{" "}
                  <span className="text-muted-foreground">{current.label}</span>{" "}
                  <span className="font-jp">{current.chars.join(" ")}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={lesson === 0}
                    onClick={() => setLesson(script, lesson - 1)}
                  >
                    {t("settings.previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={lesson >= last}
                    onClick={() => setLesson(script, lesson + 1)}
                  >
                    {t("settings.skipNext")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={lesson === 0}
                    onClick={() => setLesson(script, 0)}
                  >
                    {t("settings.backToStart")}
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.dataTitle")}</CardTitle>
          <CardDescription>{t("settings.dataDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={replayOnboarding}>
            {t("welcome.replay")}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              updateSettings({
                ...DEFAULT_SETTINGS,
                // Appearance-type preferences are not drill tuning: keep them.
                theme: settings.theme,
                language: settings.language,
                soundEnabled: settings.soundEnabled,
                soundVolume: settings.soundVolume,
              })
            }
          >
            {t("settings.resetSettings")}
          </Button>
          <ResetDialog />
        </CardContent>
      </Card>
    </main>
  )
}

function Row({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function NumberRow({
  id,
  label,
  description,
  value,
  min,
  max,
  onChange,
}: {
  id: string
  label: string
  description: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-0.5">
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="text-sm font-medium tabular-nums">{value}</span>
      </div>
      <Slider
        id={id}
        min={min}
        max={max}
        step={1}
        value={value}
        onValueChange={(next) => onChange(next as number)}
      />
    </div>
  )
}
