# QuickKana

Practice hiragana and katakana by typing. You see a character, type its rōmaji,
confirm with Enter.

What sets it apart from realkana and similar apps: **it records which character
you confuse each kana with, not just which ones you miss**, and uses that matrix
to guide your practice.

No backend or account. All progress lives in `localStorage`.

## Two ways to practice

**Journey.** The default mode: you pick nothing. There are **two independent
journeys**, one per syllabary, because different courses teach hiragana or
katakana first — and many people arrive knowing one of the two already. Each
starts in あいうえお / アイウエオ and unlocks lessons — one row of the table per
lesson — as you master the previous one. Advancing in one doesn't affect the
other, and everything unlocked keeps appearing mixed, so you never stop reviewing
what you've learned.

A character counts as mastered when its percentage reaches 75%. This percentage
combines accuracy and exposure: getting it right three times isn't enough, you
need to sustain it. The first time a character appears, the drill gives you the
reading instead of testing you on it.

**Free selection.** The classic picker: you choose individual characters, rows,
columns, categories, or entire syllabaries, with quick presets — including "my
worst characters", which sets up the session with what you struggle with most.

In both modes the grid shows how much you've mastered each character.

## How the adaptive mode works

Two mechanisms run in parallel:

**Weight per character.** Each kana has a weight that goes up when you miss and
gradually goes down when you get it right. It determines how often it appears in
the general pool.

**Confusion groups.** When you type `shi` while seeing つ, the system doesn't
note "you missed つ": it resolves the rōmaji backward and notes `つ → し`. Misses
are counted symmetrically (confusing つ with し and し with つ is the same
problem), and when a pair crosses the threshold it enters _targeted practice_.

A group is a connected component of the confusion graph, so if つ mixes with し,
with ソ and with ン, all four end up in one group instead of three separate
pairs.

While a group is active, the drill intersperses **short streaks** where each
member appears right next to the most confusing character in the group. Seeing し
immediately after つ is what forces discrimination; just raising the weight of
both separately wouldn't do it. The order within the streak is randomized so you
can't answer by pattern instead of recognition.

The group is **mastered** with N consecutive correct answers on its members, and
**reactivates** if you confuse them again later.

The thresholds (activation, mastery, spacing between streaks) are configurable
in `/settings`.

An answer that doesn't spell any kana — a typo — is saved separately and never
enters the matrix, so typing anything random can't create false groups.

## Pressure and streaks

**Streaks.** During practice you see how many you've gotten right in a row; the
counter ramps up at 5, 10, 20, 30… and alerts you when you're breaking your
record. A miss resets it to zero. Separately, a day streak tracks consecutive
days practicing.

**Timed mode** (optional, in `/settings`). Each character has a visible time
limit: if it runs out it counts as an error and shows you the answer, same as if
you'd typed wrong. With "speed up with streak" the clock gets shorter with
each consecutive correct answer — down to a floor of 1.2s — and a miss gives you
back the full time.

**Session summary.** At the end: accuracy, time per character, best streak (with
a record mark), lessons unlocked, confusion groups mastered, and the hardest
characters.

## Routes

| Route       |                                                                     |
| ----------- | ------------------------------------------------------------------- |
| `/`         | Guided journey or free selection of characters                      |
| `/practice` | The drill. `Enter` confirms, `Esc` ends                             |
| `/stats`    | Most confused pairs, per-character detail, heatmap and group status |
| `/settings` | Preferences, adaptive mode thresholds, theme and reset              |

## Stack

TanStack Start (SSR disabled — everything relies on `localStorage`), TanStack
Router with file-based routing, TanStack Store, Tailwind v4 and shadcn/ui on
Base UI.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # rōmaji logic, confusion groups and scheduler
pnpm typecheck
pnpm lint
pnpm build
```

The logic that matters is pure and tested in `src/lib/__tests__/`:

- `src/lib/kana/romaji.ts` and `resolveTyped` — validation and error attribution
- `src/lib/confusion.ts` — group formation, mastery and reactivation
- `src/lib/scheduler.ts` — weights, streak construction and kana selection
- `src/lib/journey.ts` — the two syllabaries and when each lesson unlocks
- `src/lib/pressure.ts` — the timer clock and streak milestones
