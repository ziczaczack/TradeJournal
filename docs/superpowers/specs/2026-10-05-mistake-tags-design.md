# Mistake Tags — Design

Date: 2026-10-05
Status: Approved in brainstorming, pending spec review

## Goal

Let a trader tag each trade with the mistakes they made (several per trade),
and show what those mistakes cost — compared against trades explicitly marked
clean — so the journal answers "what is my most expensive habit?".

## Scope

In v1:

- Per-user mistake tag list: 8 defaults, plus add / rename / hide.
- Multi-select mistake tagging + "No mistakes" in the trade sheet.
- Mistake count badge in the History list.
- Analytics "Mistakes" section: headline cost, review coverage, per-tag table,
  This month / All time toggle.

Out of v1: feeding mistakes to the AI mentor, filtering History by tag,
daily/weekly reviews, drag-to-reorder tags, deleting tags.

## Definitions

- **Reviewed trade**: `mistakes_reviewed = true`.
- **Clean trade**: reviewed **and** `mistake_tag_ids` is empty.
- **Mistake trade**: reviewed and has ≥ 1 tag.
- **Unreviewed trade**: `mistakes_reviewed = false`. Excluded from all
  mistake math (not treated as clean).
- **Total cost** = (avg P&L of clean trades − avg P&L of mistake trades) ×
  number of mistake trades. Each trade counts once.
- **Tag cost** = (avg P&L of clean trades − avg P&L of trades with that tag) ×
  number of trades with that tag. A trade with two tags counts in both rows, so
  row costs can sum to more than the total; the UI footnotes this.
- Cost is `null` (shown "—") when there are no clean trades or no trades for
  that tag. Negative costs are shown as-is (the tag's trades beat clean ones).

## Data model

Migration `supabase/migrations/20261005_mistake_tags.sql` — idempotent, applied
manually in the Supabase SQL editor (live DB has drifted from the migration
files).

```
mistake_tags
  id          uuid primary key default gen_random_uuid()
  user_id     uuid not null references auth.users(id) on delete cascade
  name        text not null check (char_length(btrim(name)) between 1 and 40)
  sort_order  integer not null default 0
  is_hidden   boolean not null default false
  created_at  timestamptz not null default now()
  unique index (user_id, lower(name))
```

RLS: owner `select`, `insert` (with check `auth.uid() = user_id`), `update`.
No delete policy — tags are hidden, never deleted, so old trades keep meaning.

`trading_journal` gains:

```
mistake_tag_ids    uuid[]  not null default '{}'
mistakes_reviewed  boolean not null default false
```

Existing trades start unreviewed with no tags. No backfill from
`psychology_tag` (feelings ≠ actions; inferring would invent data).

Default tags come from `ensure_default_mistake_tags()` — `SECURITY INVOKER`,
inserts for `auth.uid()` with `ON CONFLICT DO NOTHING` on the unique index, so
concurrent calls can't duplicate (avoids the check-then-insert race that caused
the checklist duplicate bug). It only seeds when the user has zero tags, so a
user who renamed or hid defaults doesn't get them re-added. Defaults, in order:
Moved stop, Oversized, Chased entry, Early exit, Revenge trade, No valid setup,
Overtrading, Ignored checklist.

## Code units

- `src/lib/mistakeTagQueries.ts` — `fetchMistakeTags()` (calls
  `ensure_default_mistake_tags` RPC first, then selects, ordered by
  `sort_order`), `createMistakeTag(userId, name)` (appends at max sort_order+1),
  `renameMistakeTag(id, name)`, `setMistakeTagHidden(id, hidden)`. Duplicate
  name → error code `23505` surfaced as "A tag with that name already exists".
- `src/lib/mistakeStats.ts` — pure:
  - `type MistakePeriod = 'month' | 'all'`
  - `filterByPeriod(trades, period, now)` — `month` = calendar month of `now`
    by `entry_time` (local time).
  - `analyzeMistakes(trades, tags, period, now): MistakeAnalysis` returning
    `{ reviewedCount, totalCount, cleanCount, mistakeTradeCount, cleanAvgPnl,
    totalCost, smallSample, rows: MistakeRow[] }` where `MistakeRow =
    { tagId, name, isHidden, count, winRate, avgPnl, netPnl, cost }`, rows
    sorted by cost desc (nulls last), only tags with count > 0.
    `smallSample` = `cleanCount < 5`.
  - `toggleMistake(state, tagId | 'none'): MistakeState` where `MistakeState =
    { tagIds: string[]; reviewed: boolean }` — picking a tag adds/removes it
    and sets reviewed; picking `'none'` clears tags and sets reviewed.
- `Trade` / `TradeUpdate` (`src/lib/tradeQueries.ts`) gain
  `mistake_tag_ids?: string[]` and `mistakes_reviewed?: boolean`; both list
  queries select them.

## UI

**Trade sheet** (`TradeDetailSheet`): "Mistakes" section below Psychology.
Chips for visible tags, plus any hidden tags already on this trade; a
"No mistakes" chip; "Not reviewed" hint when untouched; "Manage tags" link to
`/settings/mistakes`. Saved with the existing Save Review (single
`updateTrade`). Tag load failure → inline "Couldn't load mistake tags"; the
rest of the sheet still saves.

**Tag management page** `/settings/mistakes` (DashboardLayout, like
`/settings/accounts`): list with Add, inline Rename, Hide/Show. Hidden tags
shown greyed in a separate group. Inline errors for empty/too-long/duplicate
names.

**History list** (`TradeListItem`): red badge "N mistake(s)" when the trade
has tags.

**Analytics**: `MistakeAnalysis` component near Psychology Impact, with the
This month / All time toggle (default This month): headline "Mistakes cost you
$X", coverage "N of M trades reviewed", per-tag table (Tag, Trades, Win rate,
Avg P&L, Net P&L, Cost) with the double-count footnote, "small sample" note
when `cleanCount < 5`, "—" + hint when no clean trades, empty state when no
reviewed trades, "Manage tags" link.

## Testing

Vitest (node env):

- `mistakeStats.test.ts`: clean vs unreviewed exclusion; single and multi-tag
  trades; total counts each trade once while rows double-count; no clean
  trades → null costs; small sample flag; negative cost; hidden tags still
  reported; zero-count tags omitted; sort order; month boundary filtering;
  `toggleMistake` transitions.
- `mistakeTagQueries.test.ts`: create appends sort order; duplicate name
  maps to the friendly error; fetch calls the ensure RPC before selecting.
- Manual check after applying the migration: open the app in two tabs at once
  (two concurrent `ensure_default_mistake_tags()` calls), then confirm exactly
  8 tags exist for the user.
- Manual E2E: tag trades, mark one clean, verify analytics numbers by hand.

## Rollout

1. User runs `20261005_mistake_tags.sql` in the Supabase SQL editor.
2. Open the app (two tabs at once), then in the SQL editor run
   `select user_id, count(*) from mistake_tags group by user_id;` → 8 per user.
   (`auth.uid()` is null in the SQL editor, so the seeding function can't be
   exercised there directly.)
3. No new environment variables or dependencies.
