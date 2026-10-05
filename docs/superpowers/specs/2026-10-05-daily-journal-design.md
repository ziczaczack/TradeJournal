# Daily Journal — Design

Date: 2026-10-05
Status: Approved in brainstorming, pending spec review

## Goal

Make the end-of-day review a habit: write a structured write-up for each trade
(Full or Basic template, user's own prompts) and one day-level note, and read a
day back later — all from one Journal page.

## Scope

In v1:

- Per-trade write-up with a **Full** or **Basic** template, edited in the trade
  sheet, with a completeness count.
- Day note "What did I do today?" (one per user per date).
- `/journal` page: day picker, day summary, day note, the day's trades with
  their write-ups.
- "Open daily journal" link from the Calendar's selected day.

Out of v1: AI feedback or drafting, weekly reviews, custom prompts, a past
reviews list/search.

## Templates

Defined in code (`src/lib/tradeReview.ts`) with stable ids; labels in English.

| Template | Question id → label |
|---|---|
| Full | `htf_analysis` → Higher-timeframe analysis; `entry_reason` → Reason for entry; `stop_reason` → Reason for stop placement; `execution` → Actual execution; `emotions` → Emotions before entry and while holding; `advice` → Advice to my pre-trade self; **Entry chart** → the trade's `screenshot_url` (mark entry / target / stop) |
| Basic | `standout` → What stood out in this trade, good or bad?; `redo` → If I did it again, what would I do? |

The user's Basic prompt "What did I do today?" is day-level, so it is the day
note, not a per-trade question.

**Progress**: Full = answered of 7 (6 questions + chart present); Basic =
answered of 2. A blank/whitespace answer doesn't count; answers belonging to the
other template are ignored for progress.

## Data model

Migration `supabase/migrations/20261005_daily_journal.sql` — idempotent,
applied manually in the Supabase SQL editor.

`trading_journal` gains:

```
review_template  text   null check (review_template in ('full','basic'))
review_answers   jsonb  not null default '{}'
                 check (octet_length(review_answers::text) <= 20000)
```

New table:

```
daily_notes
  id          uuid primary key default gen_random_uuid()
  user_id     uuid not null references auth.users(id) on delete cascade
  note_date   date not null
  note        text not null default '' check (char_length(note) <= 5000)
  created_at  timestamptz not null default now()
  updated_at  timestamptz not null default now()   -- trigger-maintained
  unique (user_id, note_date)
```

RLS: owner `select`, `insert` (with check), `update`. The day note is per user,
not per account.

Switching a trade's template keeps all stored answers (only the visible prompts
change). Saving cleans answers: trims, drops empty ones, caps each at 2,000
characters; keys for both templates are preserved.

## Code units

`src/lib/tradeReview.ts` (pure):

- `type ReviewTemplate = 'full' | 'basic'`, `type ReviewAnswers = Record<string, string>`
- `REVIEW_TEMPLATES: Record<ReviewTemplate, { label: string; questions: { id: string; label: string }[]; includesChart: boolean }>`
- `MAX_ANSWER_LENGTH = 2000`, `MAX_DAY_NOTE_LENGTH = 5000`
- `reviewProgress(template: ReviewTemplate | null, answers: ReviewAnswers, hasScreenshot: boolean): { done: number; total: number }` — `null` template → `{ done: 0, total: 0 }`
- `cleanAnswers(answers: Record<string, unknown>): ReviewAnswers`
- `localDayBounds(day: string): { start: string; end: string }` — `day` is `YYYY-MM-DD` in local time; returns ISO instants for local 00:00 and the next local 00:00 (exclusive), correct across DST
- `toDayKey(date: Date): string` — local `YYYY-MM-DD`
- `defaultJournalDay(tradeEntryTimes: (string | null | undefined)[], today: Date): string` — today if any trade is on today, else the latest local day with a trade, else today
- `summarizeDay(trades: Trade[]): { count: number; netPnl: number; winRate: number; mistakeCount: number; writtenUp: number }` — `writtenUp` = trades with a template and progress `done > 0`; `mistakeCount` = sum of `mistake_tag_ids` lengths

`src/lib/journalQueries.ts`:

- `fetchTradesForDay(day: string, accountId?: string, client?): Promise<Trade[]>` — `select('*')`, `entry_time >= start and < end`, ordered by `entry_time` asc
- `fetchDailyNote(day: string, client?): Promise<string>` — `''` when none
- `saveDailyNote(userId: string, day: string, note: string, client?): Promise<void>` — upsert on `(user_id, note_date)`

`Trade` / `TradeUpdate` gain `review_template?: ReviewTemplate | null` and
`review_answers?: ReviewAnswers`. List queries do **not** select them.

## UI

**Trade sheet** — "Write-up" section below Notes: Full | Basic toggle (new
trades default to Basic), a textarea per question (`maxLength` 2,000), progress
"done/total". For Full, an "Entry chart" line pointing to the screenshot
uploader above (done when a screenshot exists). Saved with Save Review via
`cleanAnswers`. Form reset follows the existing full-row loading rules.

**`/journal`** (DashboardLayout, new "Journal" nav item): ←/→ and a date input;
default day from `defaultJournalDay`; URL `?date=YYYY-MM-DD` so the Calendar can
link to a day. Header: trades, net P&L, win rate, mistakes, "X of Y written up".
Day note textarea with Save, "Unsaved" indicator, and a confirm when switching
day or leaving with unsaved text. Trade list (current account, entry-time
order): symbol, P&L, template + progress or "Not written", expand to read
answers, Write/Edit opens `TradeDetailSheet`; after save the day refetches —
the day's trades are cached under `['trades', 'day', day, accountId]`, which the
sheet's existing `invalidateQueries(['trades'])` already covers.
Empty day → "No trades on this day" (note still usable). Load error → inline
error + Retry.

**Calendar** — when a day is selected, the "Trades on …" header gets an
"Open daily journal →" link to `/journal?date=…`.

**Known difference**: Calendar groups trades by `exit_time`; the journal groups
by `entry_time` (a write-up is about when you took the trade). They differ only
for trades held past local midnight.

## Testing

Vitest (node env):

- `tradeReview.test.ts`: template ids unique and disjoint; progress for Full
  (with/without chart), Basic, blanks, other-template keys ignored, null
  template; `cleanAnswers` trims/drops/caps/keeps both templates' keys and
  drops non-strings; `localDayBounds` ordinary day and a DST-change day (span
  ≠ 24h but contiguous: next day's start === this day's end); `toDayKey`;
  `defaultJournalDay` today / latest earlier day / no trades; `summarizeDay`.
- `journalQueries.test.ts` (fake client): day query bounds/order/account
  filter; note fetch empty → `''`; save upserts with `onConflict:
  'user_id,note_date'`.
- Manual E2E with the user: Full + Basic write-ups, template switch keeps
  answers, day note save + unsaved confirm, ←/→ and the Calendar link,
  "X of Y written up".

## Rollout

1. User runs `20261005_daily_journal.sql` in the Supabase SQL editor before the
   code that selects/updates the new columns runs.
2. Verify: the two `trading_journal` columns exist and `to_regclass('public.daily_notes')`
   returns the table.
3. No new environment variables or dependencies.
