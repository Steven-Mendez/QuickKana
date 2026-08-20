import { createFileRoute } from "@tanstack/react-router"
import { useSelector } from "@tanstack/react-store"

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
import { useTheme } from "@/hooks/use-theme"
import {
  DEFAULT_SETTINGS,
  settingsStore,
  updateSettings,
} from "@/stores/settings.store"
import type { ThemePreference } from "@/lib/types"

export const Route = createFileRoute("/settings")({ component: SettingsPage })

const THEMES: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
]

function SettingsPage() {
  const progression = useSelector(progressionStore, (s) => s)
  const settings = useSelector(settingsStore, (s) => s)
  const { theme, setTheme } = useTheme()

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          All data is saved in this browser. No account or server.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Practice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Row
            id="accept-aliases"
            title="Accept romanization variants"
            description="Beyond Hepburn (shi, tsu, fu, ji), accepts si, tu, hu, zi and similar. Always saves the Hepburn form."
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
            title="Timed mode"
            description="Each character has a time limit. If time runs out it counts as an error and shows the answer, just like getting it wrong."
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
                  <Label htmlFor="time-limit-value">Time per character</Label>
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
                title="Speed up with streak"
                description={`Each correct answer in a row trims the time slightly, down to a minimum of ${(
                  MIN_TIME_LIMIT / 1000
                ).toFixed(1)}s. Getting it wrong restores the full time.`}
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
          <CardTitle className="text-base">Adaptive mode</CardTitle>
          <CardDescription>
            Characters you get wrong appear more often, and ones you confuse
            with each other appear together so you have to tell them apart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Row
            id="focus-mode"
            title="Focus Mode"
            description="With this off, characters come out completely random."
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
            label="Confusion count to activate a group"
            description="How many times you need to confuse two characters before they enter targeted practice."
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
            label="Correct answers in a row to master a group"
            description="How many consecutive correct answers on the group's characters are needed to master it."
            value={settings.graduationStreak}
            min={2}
            max={10}
            onChange={(graduationStreak) =>
              updateSettings({ graduationStreak })
            }
          />

          <NumberRow
            id="cooldown"
            label="Characters between streaks"
            description="How many general pool characters appear before a group takes control again."
            value={settings.burstCooldown}
            min={0}
            max={20}
            onChange={(burstCooldown) => updateSettings({ burstCooldown })}
          />

          <Separator />

          <Row
            id="adaptive-pace"
            title="Speed up when I'm on a roll"
            description={`Counts your run on the current lesson's own characters, not on review. After ${PASSES_FLOOR} clean pass through them they take a bigger share of the drill, and by ${PASSES_FULL} the next lesson unlocks on fewer repetitions. One mistake on them puts the normal pace back.`}
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
            title="Show which group I'm practicing"
            description='An indicator during the drill like "practicing つ vs し".'
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
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          {THEMES.map(({ value, label }) => (
            <Button
              key={value}
              variant={theme === value ? "default" : "outline"}
              size="sm"
              onClick={() => setTheme(value)}
            >
              {label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journey</CardTitle>
          <CardDescription>
            Hiragana and katakana progress separately: each syllabary has its
            own journey and you can start with the one you're learning. Moving
            lessons manually doesn't affect the other.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {SCRIPTS.map((script) => {
            const lesson = lessonOf(progression, script)
            const current = lessonAt(script, lesson)
            const last = TRACKS[script].length - 1
            return (
              <div key={script} className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">{SCRIPT_LABELS[script]}</span> —
                  lesson{" "}
                  <span className="font-medium tabular-nums">
                    {lesson + 1} of {last + 1}
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
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={lesson >= last}
                    onClick={() => setLesson(script, lesson + 1)}
                  >
                    Skip to next
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={lesson === 0}
                    onClick={() => setLesson(script, 0)}
                  >
                    Back to start
                  </Button>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data</CardTitle>
          <CardDescription>
            Resetting settings leaves progress intact.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              updateSettings({ ...DEFAULT_SETTINGS, theme: settings.theme })
            }
          >
            Reset settings
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
