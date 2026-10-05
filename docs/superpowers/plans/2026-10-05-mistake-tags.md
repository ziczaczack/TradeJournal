# Mistake Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tag trades with mistakes (multi-select or "No mistakes"), and show in Analytics what each mistake costs compared with clean trades.

**Architecture:** A per-user `mistake_tags` table plus two columns on `trading_journal` (`mistake_tag_ids uuid[]`, `mistakes_reviewed boolean`). Default tags are seeded by an idempotent SQL function. All math is a pure client-side function over the trades Analytics already loads. Also fixes a pre-existing data-loss bug: the trade sheet now loads the full trade row before its form can be saved.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query v5, Supabase (Postgres + RLS + RPC), Vitest (node env), Radix UI, lucide-react, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-05-mistake-tags-design.md`

## Global Constraints

- No new npm dependencies, no new environment variables.
- **The migration must be applied to the live DB before Task 3's code runs.** Task 3 adds the new columns to trade `select`s, so the app would error on a DB without them.
- Migration is idempotent and applied manually in the Supabase SQL editor (live DB drifts from `supabase/migrations`).
- Tags are never deleted (no delete policy, no delete UI). Hidden tags still show on trades that have them and in analytics.
- Tag name: trimmed, 1–40 chars, unique per user case-insensitively.
- Clean trade = `mistakes_reviewed && mistake_tag_ids.length === 0`. Unreviewed trades are excluded from all mistake math.
- Total cost = (clean avg P&L − mistake-trade avg P&L) × mistake-trade count; each trade counts once. Tag cost = (clean avg − tag avg) × tag count. `null` when there are no clean trades. Money rounded to 2 dp.
- Small sample = fewer than 5 clean trades.
- Default tags in order: Moved stop, Oversized, Chased entry, Early exit, Revenge trade, No valid setup, Overtrading, Ignored checklist.
- Tests: Vitest node env, `src/**/*.test.ts`. `npm test`, `npm run typecheck`, `npm run build` must pass; lint advisory (pre-existing errors).
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XMmNrr8vJZzXfhzxkyyYTj
  ```

## Review Focus

1. **Accidental "clean"**: un-ticking the last mistake must not silently mark a trade clean. Clean has to be an explicit "No mistakes" choice. Removing the last tag returns the trade to unreviewed, and choosing "No mistakes" again un-reviews it. Pinned in Task 4.
2. **Unknown tag ids on trades** (e.g. an id from another account's import or manual DB edits): the trade still counts as a mistake trade in the total but produces no row. It must not crash. Pinned in Task 4.
3. **Saving from Calendar/History wipes fields the list query didn't load**: the sheet must not enable Save until the full row is loaded. Pinned by Task 2's design and manual check in Task 8.
4. **Month boundary in local time**: a trade at 00:30 local on the 1st belongs to that month, and 23:30 on the last day of the previous month does not. Pinned in Task 4.
5. **Renaming to an existing name differing only by case** ("oversized" vs "Oversized") must be rejected with the friendly message, both client-side and from the DB's 23505. Pinned in Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261005_mistake_tags.sql` | table, RLS, trade columns, `ensure_default_mistake_tags()` |
| `src/lib/tradeQueries.ts` | add `fetchTradeById`; new fields on `Trade`/`TradeUpdate`; selects |
| `src/lib/tradeQueries.test.ts` | `fetchTradeById` test |
| `src/lib/mistakeTagQueries.ts` | `MistakeTag` type, query key, name validation, fetch/create/rename/hide |
| `src/lib/mistakeTagQueries.test.ts` | validation + query tests with fake client |
| `src/lib/mistakeStats.ts` | `filterByPeriod`, `analyzeMistakes`, `toggleMistake` (pure) |
| `src/lib/mistakeStats.test.ts` | stats/toggle tests |
| `src/app/settings/mistakes/page.tsx` | manage tags page |
| `src/components/dashboard/MistakePicker.tsx` | chips UI used by the trade sheet |
| `src/components/dashboard/TradeDetailSheet.tsx` | load full row; Mistakes section; save fields |
| `src/components/dashboard/TradeListItem.tsx` | mistake count badge |
| `src/components/analytics/MistakeAnalysis.tsx` | analytics section |
| `src/app/analytics/page.tsx` | render `MistakeAnalysis` |

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/20261005_mistake_tags.sql`

**Interfaces:**
- Produces: table `public.mistake_tags(id, user_id, name, sort_order, is_hidden, created_at)`; columns `trading_journal.mistake_tag_ids uuid[]`, `trading_journal.mistakes_reviewed boolean`; RPC `ensure_default_mistake_tags() returns void`.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================
-- Mistake Tags
-- ============================================
-- Per-user list of mistakes a trader can tag on a trade, plus the per-trade
-- tag ids and a reviewed flag. Idempotent: safe to re-run on the live DB
-- (which has drifted from these files).

CREATE TABLE IF NOT EXISTS public.mistake_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness; also what makes default seeding race-safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mistake_tags_user_name
    ON public.mistake_tags (user_id, (lower(name)));

ALTER TABLE public.mistake_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own mistake tags" ON public.mistake_tags;
CREATE POLICY "Users can view their own mistake tags"
    ON public.mistake_tags FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own mistake tags" ON public.mistake_tags;
CREATE POLICY "Users can create their own mistake tags"
    ON public.mistake_tags FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own mistake tags" ON public.mistake_tags;
CREATE POLICY "Users can update their own mistake tags"
    ON public.mistake_tags FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- No delete policy: tags are hidden, never deleted, so old trades keep meaning.

ALTER TABLE public.trading_journal
    ADD COLUMN IF NOT EXISTS mistake_tag_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.trading_journal
    ADD COLUMN IF NOT EXISTS mistakes_reviewed BOOLEAN NOT NULL DEFAULT false;

-- Seed the default tags for the calling user, only if they have none.
-- ON CONFLICT on the unique index makes concurrent calls safe (no
-- check-then-insert duplicates).
CREATE OR REPLACE FUNCTION public.ensure_default_mistake_tags()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (SELECT 1 FROM public.mistake_tags WHERE user_id = auth.uid()) THEN
        RETURN;
    END IF;

    INSERT INTO public.mistake_tags (user_id, name, sort_order)
    SELECT auth.uid(), d.name, d.ord
    FROM (VALUES
        ('Moved stop', 0),
        ('Oversized', 1),
        ('Chased entry', 2),
        ('Early exit', 3),
        ('Revenge trade', 4),
        ('No valid setup', 5),
        ('Overtrading', 6),
        ('Ignored checklist', 7)
    ) AS d(name, ord)
    ON CONFLICT (user_id, (lower(name))) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_default_mistake_tags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_default_mistake_tags() TO authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261005_mistake_tags.sql
git commit -m "feat(mistakes): add mistake tags migration"
```

- [ ] **Step 3: Gate — user applies the migration**

Ask the user to run the file in the Supabase SQL editor, then confirm:

```sql
select column_name from information_schema.columns
 where table_name = 'trading_journal' and column_name in ('mistake_tag_ids', 'mistakes_reviewed');  -- expect 2 rows
select to_regclass('public.mistake_tags');  -- expect mistake_tags
```

Do not start Task 3 until both checks pass.

---

### Task 2: Fix sheet data loss — load the full trade

**Files:**
- Modify: `src/lib/tradeQueries.ts` (add `fetchTradeById` after `updateTrade`)
- Create: `src/lib/tradeQueries.test.ts`
- Modify: `src/components/dashboard/TradeDetailSheet.tsx`

**Interfaces:**
- Produces: `fetchTradeById(tradeId: string, client?: SupabaseClient): Promise<Trade>`; query key `tradeQueryKeys.detail(id)` → `['trades', 'detail', id]` in `src/hooks/useTrades.ts`.

Background: History and Calendar pass list rows that omit `notes` and `screenshot_url` to the sheet. Its form initializes those to empty, and Save writes `notes: null, screenshot_url: null`, which erases stored notes and screenshots.

- [ ] **Step 1: Write the failing test** — `src/lib/tradeQueries.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('./supabase', () => ({ getSupabase: () => { throw new Error('use the injected client'); } }));

const { fetchTradeById } = await import('./tradeQueries');

function fakeClient(row: unknown, error: unknown = null) {
    const calls: { select?: string; eq?: [string, unknown] } = {};
    const client = {
        from: () => ({
            select: (cols: string) => {
                calls.select = cols;
                return {
                    eq: (col: string, val: unknown) => {
                        calls.eq = [col, val];
                        return { single: async () => ({ data: row, error }) };
                    },
                };
            },
        }),
    } as unknown as SupabaseClient;
    return { client, calls };
}

describe('fetchTradeById', () => {
    it('loads every column for one trade, so the review form never saves blanks over stored notes', async () => {
        const row = { id: 't1', symbol: 'NQ', pnl: 10, trade_id: 'k', notes: 'kept', screenshot_url: 'https://x/y.png' };
        const { client, calls } = fakeClient(row);
        expect(await fetchTradeById('t1', client)).toEqual(row);
        expect(calls.select).toBe('*');
        expect(calls.eq).toEqual(['id', 't1']);
    });

    it('throws on error', async () => {
        const { client } = fakeClient(null, { message: 'nope' });
        await expect(fetchTradeById('t1', client)).rejects.toMatchObject({ message: 'nope' });
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/tradeQueries.test.ts`
Expected: FAIL — `fetchTradeById is not a function`.

- [ ] **Step 3: Implement `fetchTradeById`** — add to `src/lib/tradeQueries.ts` directly after `updateTrade`:

```ts
/**
 * Fetch one trade with every column. The list queries omit heavy fields
 * (notes, screenshot_url), so the review sheet must load the full row before
 * its form can be saved — otherwise saving would overwrite them with blanks.
 */
export async function fetchTradeById(
    tradeId: string,
    client: SupabaseClient = getSupabase()
): Promise<Trade> {
    const { data, error } = await client
        .from('trading_journal')
        .select('*')
        .eq('id', tradeId)
        .single();

    if (error) {
        console.error('Error fetching trade:', error);
        throw error;
    }

    return data as Trade;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/tradeQueries.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the query key** — in `src/hooks/useTrades.ts`, extend `tradeQueryKeys`:

```ts
export const tradeQueryKeys = {
    all: ['trades'] as const,
    list: (filters?: TradeFilters) => ['trades', 'list', filters] as const,
    detail: (id: string) => ['trades', 'detail', id] as const,
    filterOptions: (accountId?: string) => ['trades', 'filterOptions', accountId] as const,
};
```

- [ ] **Step 6: Make the sheet load the full row**

In `TradeDetailSheet.tsx`:

Change the tradeQueries import to:

```tsx
import { Trade, updateTrade, fetchTradeById } from '@/lib/tradeQueries';
```

Add imports:

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tradeQueryKeys } from '@/hooks/useTrades';
```

At the top of the component body (before the `useState` calls), add:

```tsx
    const queryClient = useQueryClient();
    // List rows omit notes/screenshot_url; load the full row before the form
    // can be saved, or Save would overwrite them with blanks.
    const { data: fullTrade, isError: fullTradeError } = useQuery({
        queryKey: tradeQueryKeys.detail(trade?.id ?? ''),
        queryFn: () => fetchTradeById(trade!.id),
        enabled: isOpen && !!trade,
        staleTime: 0,
    });
```

Replace the existing "Reset form when trade changes" effect (the `useEffect` whose body begins `if (trade) { setSetupType(trade.setup_type || '__none__');` and whose deps are `[trade]`) so it reads from `fullTrade`:

```tsx
    // Reset form once the full trade row is loaded
    useEffect(() => {
        if (fullTrade) {
            setSetupType(fullTrade.setup_type || '__none__');
            setIsValidSetup(
                fullTrade.is_valid_setup === true
                    ? 'true'
                    : fullTrade.is_valid_setup === false
                        ? 'false'
                        : 'null'
            );
            setPsychologyTag(fullTrade.psychology_tag || '__none__');
            setRating(fullTrade.rating || 0);
            setNotes(fullTrade.notes || '');
            setScreenshotUrl(fullTrade.screenshot_url || '');
        }
    }, [fullTrade]);
```

In `handleSave`, after `if (updated) {`, add the cache update before `onUpdate(updated);`:

```tsx
                queryClient.setQueryData(tradeQueryKeys.detail(updated.id), updated);
```

Disable Save until the row is loaded. Change the Save button's `disabled={isSaving}` to:

```tsx
                            disabled={isSaving || !fullTrade}
```

and directly above the `{/* Save / Share */}` block add:

```tsx
                    {fullTradeError && (
                        <p className="text-sm text-rose-400">Couldn&apos;t load this trade&apos;s details. Close and reopen to try again.</p>
                    )}
```

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 8: Commit**

```bash
git add src/lib/tradeQueries.ts src/lib/tradeQueries.test.ts src/hooks/useTrades.ts src/components/dashboard/TradeDetailSheet.tsx
git commit -m "fix: load full trade before saving review so notes and screenshots aren't erased"
```

---

### Task 3: Trade fields and mistake tag queries

**Files:**
- Modify: `src/lib/tradeQueries.ts` (`Trade`, `TradeUpdate`, both list `select` strings)
- Create: `src/lib/mistakeTagQueries.ts`
- Create: `src/lib/mistakeTagQueries.test.ts`

**Interfaces:**
- Consumes: `getSupabase` from `./supabase`.
- Produces:
  - `Trade.mistake_tag_ids?: string[]`, `Trade.mistakes_reviewed?: boolean`; same two on `TradeUpdate`.
  - `interface MistakeTag { id: string; user_id: string; name: string; sort_order: number; is_hidden: boolean; created_at: string }`
  - `MISTAKE_TAG_NAME_MAX = 40`
  - `mistakeTagsQueryKey = ['mistakeTags'] as const`
  - `DUPLICATE_TAG_MESSAGE = 'A tag with that name already exists'`
  - `validateMistakeTagName(name: string, existing: MistakeTag[], ignoreId?: string): string | null`
  - `nextMistakeSortOrder(tags: MistakeTag[]): number`
  - `fetchMistakeTags(client?): Promise<MistakeTag[]>`
  - `createMistakeTag(userId: string, name: string, sortOrder: number, client?): Promise<MistakeTag>`
  - `renameMistakeTag(id: string, name: string, client?): Promise<void>`
  - `setMistakeTagHidden(id: string, hidden: boolean, client?): Promise<void>`

- [ ] **Step 1: Write the failing tests** — `src/lib/mistakeTagQueries.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('./supabase', () => ({ getSupabase: () => { throw new Error('use the injected client'); } }));

const {
    createMistakeTag,
    DUPLICATE_TAG_MESSAGE,
    fetchMistakeTags,
    nextMistakeSortOrder,
    renameMistakeTag,
    validateMistakeTagName,
} = await import('./mistakeTagQueries');

const tag = (id: string, name: string, sort_order = 0) => ({
    id, user_id: 'u1', name, sort_order, is_hidden: false, created_at: '',
});

describe('validateMistakeTagName', () => {
    const existing = [tag('a', 'Oversized'), tag('b', 'Moved stop')];

    it('accepts a new trimmed name', () => {
        expect(validateMistakeTagName('  Late entry  ', existing)).toBeNull();
    });

    it('rejects empty and over-long names', () => {
        expect(validateMistakeTagName('   ', existing)).toBe('Name is required');
        expect(validateMistakeTagName('x'.repeat(41), existing)).toBe('Name must be 40 characters or fewer');
    });

    it('rejects duplicates case-insensitively', () => {
        expect(validateMistakeTagName('oversized', existing)).toBe(DUPLICATE_TAG_MESSAGE);
    });

    it('allows renaming a tag to its own name in a different case', () => {
        expect(validateMistakeTagName('OVERSIZED', existing, 'a')).toBeNull();
    });
});

describe('nextMistakeSortOrder', () => {
    it('appends after the highest sort order', () => {
        expect(nextMistakeSortOrder([tag('a', 'A', 3), tag('b', 'B', 7)])).toBe(8);
        expect(nextMistakeSortOrder([])).toBe(0);
    });
});

describe('fetchMistakeTags', () => {
    it('seeds defaults via the RPC before selecting', async () => {
        const order: string[] = [];
        const rows = [tag('a', 'Moved stop')];
        const chain = {
            order: () => chain,
            then: (resolve: (v: unknown) => void) => { order.push('select'); resolve({ data: rows, error: null }); },
        };
        const client = {
            rpc: async (fn: string) => { order.push(`rpc:${fn}`); return { error: null }; },
            from: () => ({ select: () => chain }),
        } as unknown as SupabaseClient;

        expect(await fetchMistakeTags(client)).toEqual(rows);
        expect(order).toEqual(['rpc:ensure_default_mistake_tags', 'select']);
    });
});

function writeClient(error: { code: string; message: string } | null) {
    const writes: Record<string, unknown>[] = [];
    const result = { data: error ? null : { id: 'new', name: 'X' }, error };
    const client = {
        from: () => ({
            insert: (row: Record<string, unknown>) => {
                writes.push(row);
                return { select: () => ({ single: async () => result }) };
            },
            update: (row: Record<string, unknown>) => {
                writes.push(row);
                return { eq: async () => ({ error }) };
            },
        }),
    } as unknown as SupabaseClient;
    return { client, writes };
}

describe('createMistakeTag / renameMistakeTag', () => {
    it('inserts a trimmed name at the given sort order', async () => {
        const { client, writes } = writeClient(null);
        await createMistakeTag('u1', '  Late entry ', 8, client);
        expect(writes[0]).toEqual({ user_id: 'u1', name: 'Late entry', sort_order: 8 });
    });

    it('maps a unique violation to the friendly duplicate message', async () => {
        const dup = { code: '23505', message: 'duplicate key' };
        await expect(createMistakeTag('u1', 'Oversized', 1, writeClient(dup).client))
            .rejects.toThrow(DUPLICATE_TAG_MESSAGE);
        await expect(renameMistakeTag('a', 'Oversized', writeClient(dup).client))
            .rejects.toThrow(DUPLICATE_TAG_MESSAGE);
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/mistakeTagQueries.test.ts`
Expected: FAIL — cannot resolve `./mistakeTagQueries`.

- [ ] **Step 3: Implement `src/lib/mistakeTagQueries.ts`**

```ts
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

export interface MistakeTag {
    id: string;
    user_id: string;
    name: string;
    sort_order: number;
    is_hidden: boolean;
    created_at: string;
}

export const MISTAKE_TAG_NAME_MAX = 40;
export const DUPLICATE_TAG_MESSAGE = 'A tag with that name already exists';
export const mistakeTagsQueryKey = ['mistakeTags'] as const;

const UNIQUE_VIOLATION = '23505';

/** Returns an error message, or null when the name is valid. */
export function validateMistakeTagName(
    name: string,
    existing: MistakeTag[],
    ignoreId?: string
): string | null {
    const trimmed = name.trim();
    if (!trimmed) return 'Name is required';
    if (trimmed.length > MISTAKE_TAG_NAME_MAX) return `Name must be ${MISTAKE_TAG_NAME_MAX} characters or fewer`;
    const lower = trimmed.toLowerCase();
    if (existing.some(t => t.id !== ignoreId && t.name.toLowerCase() === lower)) return DUPLICATE_TAG_MESSAGE;
    return null;
}

export function nextMistakeSortOrder(tags: MistakeTag[]): number {
    return tags.length ? Math.max(...tags.map(t => t.sort_order)) + 1 : 0;
}

function friendlyError(error: { code?: string }): Error {
    return error.code === UNIQUE_VIOLATION ? new Error(DUPLICATE_TAG_MESSAGE) : (error as Error);
}

/** All tags (hidden included), seeding the defaults first for new users. */
export async function fetchMistakeTags(client: SupabaseClient = getSupabase()): Promise<MistakeTag[]> {
    const { error: seedError } = await client.rpc('ensure_default_mistake_tags');
    if (seedError) {
        console.error('Error seeding mistake tags:', seedError);
        throw seedError;
    }

    const { data, error } = await client
        .from('mistake_tags')
        .select('*')
        .order('sort_order')
        .order('created_at');

    if (error) {
        console.error('Error fetching mistake tags:', error);
        throw error;
    }

    return data as MistakeTag[];
}

export async function createMistakeTag(
    userId: string,
    name: string,
    sortOrder: number,
    client: SupabaseClient = getSupabase()
): Promise<MistakeTag> {
    const { data, error } = await client
        .from('mistake_tags')
        .insert({ user_id: userId, name: name.trim(), sort_order: sortOrder })
        .select()
        .single();

    if (error) {
        console.error('Error creating mistake tag:', error);
        throw friendlyError(error);
    }

    return data as MistakeTag;
}

export async function renameMistakeTag(
    id: string,
    name: string,
    client: SupabaseClient = getSupabase()
): Promise<void> {
    const { error } = await client.from('mistake_tags').update({ name: name.trim() }).eq('id', id);
    if (error) {
        console.error('Error renaming mistake tag:', error);
        throw friendlyError(error);
    }
}

export async function setMistakeTagHidden(
    id: string,
    hidden: boolean,
    client: SupabaseClient = getSupabase()
): Promise<void> {
    const { error } = await client.from('mistake_tags').update({ is_hidden: hidden }).eq('id', id);
    if (error) {
        console.error('Error updating mistake tag:', error);
        throw error;
    }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/mistakeTagQueries.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Add the trade fields** — in `src/lib/tradeQueries.ts`:

Add to `interface Trade` after `ai_feedback`:

```ts
    mistake_tag_ids?: string[];
    mistakes_reviewed?: boolean;
```

Add to `interface TradeUpdate` after `rating`:

```ts
    mistake_tag_ids?: string[];
    mistakes_reviewed?: boolean;
```

In `fetchTrades`, append `, mistake_tag_ids, mistakes_reviewed` to the end of the `.select('…')` column list (after `rating`). In `fetchTradesByMonth`, do the same (after `rating`).

- [ ] **Step 6: Verify**

Run: `npm test && npm run typecheck`
Expected: all pass, typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/mistakeTagQueries.ts src/lib/mistakeTagQueries.test.ts src/lib/tradeQueries.ts
git commit -m "feat(mistakes): add mistake tag queries and trade fields"
```

---

### Task 4: Mistake stats and toggle logic

**Files:**
- Create: `src/lib/mistakeStats.ts`
- Create: `src/lib/mistakeStats.test.ts`

**Interfaces:**
- Consumes: `Trade` (Task 3 fields), `MistakeTag` (Task 3), `makeTrade` from `src/lib/__fixtures__/trades.ts`.
- Produces:
  - `type MistakePeriod = 'month' | 'all'`
  - `interface MistakeState { tagIds: string[]; reviewed: boolean }`
  - `interface MistakeRow { tagId: string; name: string; isHidden: boolean; count: number; winRate: number; avgPnl: number; netPnl: number; cost: number | null }`
  - `interface MistakeAnalysis { totalCount: number; reviewedCount: number; cleanCount: number; mistakeTradeCount: number; cleanAvgPnl: number | null; totalCost: number | null; smallSample: boolean; rows: MistakeRow[] }`
  - `SMALL_SAMPLE_CLEAN_TRADES = 5`
  - `filterByPeriod(trades: Trade[], period: MistakePeriod, now: Date): Trade[]`
  - `analyzeMistakes(trades: Trade[], tags: MistakeTag[], period: MistakePeriod, now: Date): MistakeAnalysis`
  - `toggleMistake(state: MistakeState, choice: string): MistakeState` — `choice` is a tag id or `'none'`

- [ ] **Step 1: Write the failing tests** — `src/lib/mistakeStats.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { makeTrade } from './__fixtures__/trades';
import type { MistakeTag } from './mistakeTagQueries';
import { analyzeMistakes, filterByPeriod, toggleMistake } from './mistakeStats';

const tag = (id: string, name: string, is_hidden = false): MistakeTag => ({
    id, user_id: 'u1', name, sort_order: 0, is_hidden, created_at: '',
});
const TAGS = [tag('stop', 'Moved stop'), tag('size', 'Oversized'), tag('old', 'Old habit', true)];
const NOW = new Date(2026, 9, 15, 12, 0); // Oct 15 2026, local time
const inOct = new Date(2026, 9, 10, 10, 0).toISOString();

const clean = (pnl: number) => makeTrade({ pnl, entry_time: inOct, mistakes_reviewed: true, mistake_tag_ids: [] });
const mistake = (pnl: number, ids: string[]) =>
    makeTrade({ pnl, entry_time: inOct, mistakes_reviewed: true, mistake_tag_ids: ids });
const unreviewed = (pnl: number) => makeTrade({ pnl, entry_time: inOct, mistakes_reviewed: false, mistake_tag_ids: [] });

describe('analyzeMistakes', () => {
    it('compares against clean trades and ignores unreviewed ones', () => {
        const trades = [clean(100), clean(200), mistake(-50, ['stop']), unreviewed(-9999)];
        const a = analyzeMistakes(trades, TAGS, 'all', NOW);
        expect(a).toMatchObject({
            totalCount: 4,
            reviewedCount: 3,
            cleanCount: 2,
            mistakeTradeCount: 1,
            cleanAvgPnl: 150,
            totalCost: 200, // (150 - -50) * 1
        });
        expect(a.rows).toEqual([
            { tagId: 'stop', name: 'Moved stop', isHidden: false, count: 1, winRate: 0, avgPnl: -50, netPnl: -50, cost: 200 },
        ]);
    });

    it('counts a multi-tag trade once in the total but in every tag row', () => {
        const trades = [clean(100), mistake(-100, ['stop', 'size']), mistake(50, ['size'])];
        const a = analyzeMistakes(trades, TAGS, 'all', NOW);
        expect(a.mistakeTradeCount).toBe(2);
        expect(a.totalCost).toBe(250); // (100 - (-25)) * 2
        const size = a.rows.find(r => r.tagId === 'size')!;
        const stop = a.rows.find(r => r.tagId === 'stop')!;
        expect(size).toMatchObject({ count: 2, winRate: 50, avgPnl: -25, netPnl: -50, cost: 250 });
        expect(stop).toMatchObject({ count: 1, cost: 200 });
    });

    it('sorts rows by cost, biggest first, and omits tags with no trades', () => {
        const trades = [clean(100), mistake(-100, ['stop', 'size']), mistake(50, ['size'])];
        expect(analyzeMistakes(trades, TAGS, 'all', NOW).rows.map(r => r.tagId)).toEqual(['size', 'stop']);
    });

    it('returns null costs when there are no clean trades, sorted by count', () => {
        const trades = [mistake(-10, ['stop']), mistake(-10, ['size']), mistake(-10, ['size'])];
        const a = analyzeMistakes(trades, TAGS, 'all', NOW);
        expect(a.cleanAvgPnl).toBeNull();
        expect(a.totalCost).toBeNull();
        expect(a.rows.map(r => [r.tagId, r.cost])).toEqual([['size', null], ['stop', null]]);
    });

    it('flags a small clean sample', () => {
        const few = [clean(1), clean(1), mistake(0, ['stop'])];
        expect(analyzeMistakes(few, TAGS, 'all', NOW).smallSample).toBe(true);
        const enough = [...Array.from({ length: 5 }, () => clean(1)), mistake(0, ['stop'])];
        expect(analyzeMistakes(enough, TAGS, 'all', NOW).smallSample).toBe(false);
    });

    it('reports a negative cost when the mistake trades beat clean ones', () => {
        const a = analyzeMistakes([clean(10), mistake(110, ['stop'])], TAGS, 'all', NOW);
        expect(a.totalCost).toBe(-100);
    });

    it('still reports hidden tags that are on trades', () => {
        const a = analyzeMistakes([clean(0), mistake(-5, ['old'])], TAGS, 'all', NOW);
        expect(a.rows[0]).toMatchObject({ tagId: 'old', name: 'Old habit', isHidden: true });
    });

    it('counts trades with unknown tag ids in the total without a row', () => {
        const a = analyzeMistakes([clean(0), mistake(-5, ['ghost'])], TAGS, 'all', NOW);
        expect(a.mistakeTradeCount).toBe(1);
        expect(a.totalCost).toBe(5);
        expect(a.rows).toEqual([]);
    });

    it('treats missing fields on old trades as unreviewed', () => {
        const a = analyzeMistakes([makeTrade({ pnl: 5, entry_time: inOct })], TAGS, 'all', NOW);
        expect(a).toMatchObject({ totalCount: 1, reviewedCount: 0, totalCost: null, rows: [] });
    });
});

describe('filterByPeriod', () => {
    it('keeps only trades in the calendar month of now (local time) for "month"', () => {
        const first = makeTrade({ entry_time: new Date(2026, 9, 1, 0, 30).toISOString() });
        const prevLast = makeTrade({ entry_time: new Date(2026, 8, 30, 23, 30).toISOString() });
        const noTime = makeTrade({ entry_time: null });
        expect(filterByPeriod([first, prevLast, noTime], 'month', NOW)).toEqual([first]);
        expect(filterByPeriod([first, prevLast, noTime], 'all', NOW)).toHaveLength(3);
    });
});

describe('toggleMistake', () => {
    const unreviewedState = { tagIds: [], reviewed: false };

    it('adds and removes tags, marking the trade reviewed', () => {
        const one = toggleMistake(unreviewedState, 'stop');
        expect(one).toEqual({ tagIds: ['stop'], reviewed: true });
        expect(toggleMistake(one, 'size')).toEqual({ tagIds: ['stop', 'size'], reviewed: true });
    });

    it('returns to unreviewed when the last tag is removed (clean must be explicit)', () => {
        expect(toggleMistake({ tagIds: ['stop'], reviewed: true }, 'stop')).toEqual(unreviewedState);
    });

    it('"none" marks clean, clearing tags; choosing it again un-reviews', () => {
        const isClean = toggleMistake({ tagIds: ['stop'], reviewed: true }, 'none');
        expect(isClean).toEqual({ tagIds: [], reviewed: true });
        expect(toggleMistake(isClean, 'none')).toEqual(unreviewedState);
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/mistakeStats.test.ts`
Expected: FAIL — cannot resolve `./mistakeStats`.

- [ ] **Step 3: Implement `src/lib/mistakeStats.ts`**

```ts
import type { Trade } from './tradeQueries';
import type { MistakeTag } from './mistakeTagQueries';

export type MistakePeriod = 'month' | 'all';

export interface MistakeState {
    tagIds: string[];
    reviewed: boolean;
}

export interface MistakeRow {
    tagId: string;
    name: string;
    isHidden: boolean;
    count: number;
    winRate: number;
    avgPnl: number;
    netPnl: number;
    cost: number | null;
}

export interface MistakeAnalysis {
    totalCount: number;
    reviewedCount: number;
    cleanCount: number;
    mistakeTradeCount: number;
    cleanAvgPnl: number | null;
    totalCost: number | null;
    smallSample: boolean;
    rows: MistakeRow[];
}

export const SMALL_SAMPLE_CLEAN_TRADES = 5;

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const tagIdsOf = (t: Trade) => t.mistake_tag_ids ?? [];

/** 'month' = the calendar month containing `now`, by entry time in local time. */
export function filterByPeriod(trades: Trade[], period: MistakePeriod, now: Date): Trade[] {
    if (period === 'all') return trades;
    const year = now.getFullYear();
    const month = now.getMonth();
    return trades.filter(t => {
        if (!t.entry_time) return false;
        const d = new Date(t.entry_time);
        return d.getFullYear() === year && d.getMonth() === month;
    });
}

/**
 * What mistakes cost, measured against trades explicitly marked clean.
 * Unreviewed trades are excluded: an untagged trade isn't necessarily clean.
 */
export function analyzeMistakes(
    trades: Trade[],
    tags: MistakeTag[],
    period: MistakePeriod,
    now: Date
): MistakeAnalysis {
    const scoped = filterByPeriod(trades, period, now);
    const reviewed = scoped.filter(t => t.mistakes_reviewed === true);
    const clean = reviewed.filter(t => tagIdsOf(t).length === 0);
    const mistakeTrades = reviewed.filter(t => tagIdsOf(t).length > 0);

    const cleanAvgPnl = clean.length ? sum(clean.map(t => t.pnl)) / clean.length : null;

    const costOf = (group: Trade[]): number | null => {
        if (cleanAvgPnl === null || group.length === 0) return null;
        const groupAvg = sum(group.map(t => t.pnl)) / group.length;
        return round2((cleanAvgPnl - groupAvg) * group.length);
    };

    const rows: MistakeRow[] = [];
    for (const tag of tags) {
        const group = mistakeTrades.filter(t => tagIdsOf(t).includes(tag.id));
        if (group.length === 0) continue;
        const net = sum(group.map(t => t.pnl));
        rows.push({
            tagId: tag.id,
            name: tag.name,
            isHidden: tag.is_hidden,
            count: group.length,
            winRate: round2((group.filter(t => t.pnl > 0).length / group.length) * 100),
            avgPnl: round2(net / group.length),
            netPnl: round2(net),
            cost: costOf(group),
        });
    }

    // Biggest cost first; rows without a cost go last, ordered by count.
    rows.sort((a, b) => {
        if (a.cost === null && b.cost === null) return b.count - a.count;
        if (a.cost === null) return 1;
        if (b.cost === null) return -1;
        return b.cost - a.cost;
    });

    return {
        totalCount: scoped.length,
        reviewedCount: reviewed.length,
        cleanCount: clean.length,
        mistakeTradeCount: mistakeTrades.length,
        cleanAvgPnl: cleanAvgPnl === null ? null : round2(cleanAvgPnl),
        totalCost: costOf(mistakeTrades),
        smallSample: clean.length < SMALL_SAMPLE_CLEAN_TRADES,
        rows,
    };
}

/**
 * Trade-sheet chip logic. Picking a tag toggles it; 'none' marks the trade
 * clean (or un-reviews it if it already was). Removing the last tag returns
 * to unreviewed, so a trade only becomes clean by an explicit "No mistakes".
 */
export function toggleMistake(state: MistakeState, choice: string): MistakeState {
    if (choice === 'none') {
        const isClean = state.reviewed && state.tagIds.length === 0;
        return isClean ? { tagIds: [], reviewed: false } : { tagIds: [], reviewed: true };
    }
    const tagIds = state.tagIds.includes(choice)
        ? state.tagIds.filter(id => id !== choice)
        : [...state.tagIds, choice];
    return tagIds.length ? { tagIds, reviewed: true } : { tagIds: [], reviewed: false };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/mistakeStats.test.ts && npm run typecheck`
Expected: PASS (13 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mistakeStats.ts src/lib/mistakeStats.test.ts
git commit -m "feat(mistakes): add mistake cost analysis and toggle logic"
```

---

### Task 5: Manage tags page

**Files:**
- Create: `src/app/settings/mistakes/page.tsx`

**Interfaces:**
- Consumes: Task 3 `fetchMistakeTags`, `createMistakeTag`, `renameMistakeTag`, `setMistakeTagHidden`, `validateMistakeTagName`, `nextMistakeSortOrder`, `mistakeTagsQueryKey`, `MistakeTag`, `MISTAKE_TAG_NAME_MAX`; `getSupabase`.
- Produces: route `/settings/mistakes`.

- [ ] **Step 1: Implement the page**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, EyeOff, Pencil, Plus, Check, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabase } from '@/lib/supabase';
import {
    createMistakeTag,
    fetchMistakeTags,
    MISTAKE_TAG_NAME_MAX,
    MistakeTag,
    mistakeTagsQueryKey,
    nextMistakeSortOrder,
    renameMistakeTag,
    setMistakeTagHidden,
    validateMistakeTagName,
} from '@/lib/mistakeTagQueries';

export default function MistakeTagsPage() {
    const queryClient = useQueryClient();
    const { data: tags = [], isLoading, isError } = useQuery({
        queryKey: mistakeTagsQueryKey,
        queryFn: () => fetchMistakeTags(),
    });

    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = () => queryClient.invalidateQueries({ queryKey: mistakeTagsQueryKey });

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setBusy(false);
        }
    };

    const handleAdd = () => {
        const problem = validateMistakeTagName(newName, tags);
        if (problem) return setError(problem);
        run(async () => {
            const { data: { user } } = await getSupabase().auth.getUser();
            if (!user) throw new Error('Not signed in');
            await createMistakeTag(user.id, newName, nextMistakeSortOrder(tags));
            setNewName('');
        });
    };

    const handleRename = (tag: MistakeTag) => {
        const problem = validateMistakeTagName(editName, tags, tag.id);
        if (problem) return setError(problem);
        run(async () => {
            await renameMistakeTag(tag.id, editName);
            setEditingId(null);
        });
    };

    const visible = tags.filter(t => !t.is_hidden);
    const hidden = tags.filter(t => t.is_hidden);

    const renderRow = (tag: MistakeTag) => (
        <div key={tag.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            {editingId === tag.id ? (
                <>
                    <Input
                        value={editName}
                        maxLength={MISTAKE_TAG_NAME_MAX}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleRename(tag)}
                        className="h-8 bg-zinc-900 border-zinc-700"
                        autoFocus
                    />
                    <Button size="icon" variant="ghost" disabled={busy} onClick={() => handleRename(tag)} aria-label="Save name">
                        <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel">
                        <X className="w-4 h-4" />
                    </Button>
                </>
            ) : (
                <>
                    <span className={`flex-1 text-sm ${tag.is_hidden ? 'text-zinc-500' : 'text-zinc-200'}`}>{tag.name}</span>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditingId(tag.id); setEditName(tag.name); setError(null); }}
                        className="text-zinc-500 hover:text-white"
                        aria-label={`Rename ${tag.name}`}
                    >
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => run(() => setMistakeTagHidden(tag.id, !tag.is_hidden))}
                        className="text-zinc-500 hover:text-white"
                        aria-label={tag.is_hidden ? `Show ${tag.name}` : `Hide ${tag.name}`}
                    >
                        {tag.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                </>
            )}
        </div>
    );

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto px-4 space-y-6">
                <div className="flex items-center gap-3">
                    <Link href="/history">
                        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Mistake tags</h1>
                        <p className="text-sm text-zinc-400">The mistakes you can tag on a trade. Hidden tags stay on old trades.</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Input
                        value={newName}
                        maxLength={MISTAKE_TAG_NAME_MAX}
                        placeholder="New mistake, e.g. Traded the news"
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        className="bg-zinc-900/50 border-zinc-700"
                    />
                    <Button onClick={handleAdd} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500">
                        <Plus className="w-4 h-4 mr-2" />
                        Add
                    </Button>
                </div>

                {error && <p className="text-sm text-rose-400">{error}</p>}
                {isError && <p className="text-sm text-rose-400">Couldn&apos;t load mistake tags.</p>}
                {isLoading && <p className="text-sm text-zinc-500">Loading…</p>}

                <div className="space-y-2">{visible.map(renderRow)}</div>

                {hidden.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wider text-zinc-500">Hidden</p>
                        {hidden.map(renderRow)}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run build`
Expected: success; build lists `○ /settings/mistakes` (or `ƒ`).

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/mistakes/page.tsx
git commit -m "feat(mistakes): add page to add, rename and hide mistake tags"
```

---

### Task 6: Tag mistakes in the trade sheet; badge in History

**Files:**
- Create: `src/components/dashboard/MistakePicker.tsx`
- Modify: `src/components/dashboard/TradeDetailSheet.tsx`
- Modify: `src/components/dashboard/TradeListItem.tsx`

**Interfaces:**
- Consumes: Task 2 `fullTrade` in the sheet; Task 3 `fetchMistakeTags`, `mistakeTagsQueryKey`, `MistakeTag`; Task 4 `MistakeState`, `toggleMistake`.
- Produces: `MistakePicker({ tags, state, onChange, loadError }: { tags: MistakeTag[]; state: MistakeState; onChange: (s: MistakeState) => void; loadError: boolean })`.

- [ ] **Step 1: Implement `src/components/dashboard/MistakePicker.tsx`**

```tsx
'use client';

import Link from 'next/link';
import type { MistakeTag } from '@/lib/mistakeTagQueries';
import { MistakeState, toggleMistake } from '@/lib/mistakeStats';

interface MistakePickerProps {
    tags: MistakeTag[];
    state: MistakeState;
    onChange: (state: MistakeState) => void;
    loadError: boolean;
}

const chip = 'px-3 py-1 rounded-full text-xs font-medium border transition-colors';

export function MistakePicker({ tags, state, onChange, loadError }: MistakePickerProps) {
    // Visible tags, plus hidden ones already on this trade so they can be removed.
    const shown = tags.filter(t => !t.is_hidden || state.tagIds.includes(t.id));
    const isClean = state.reviewed && state.tagIds.length === 0;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400 font-medium">Mistakes</label>
                <Link href="/settings/mistakes" className="text-xs text-blue-400 hover:underline">
                    Manage tags
                </Link>
            </div>
            {loadError ? (
                <p className="text-xs text-rose-400">Couldn&apos;t load mistake tags.</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onChange(toggleMistake(state, 'none'))}
                        className={`${chip} ${isClean
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                    >
                        No mistakes
                    </button>
                    {shown.map(tag => {
                        const active = state.tagIds.includes(tag.id);
                        return (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => onChange(toggleMistake(state, tag.id))}
                                className={`${chip} ${active
                                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                            >
                                {tag.name}
                            </button>
                        );
                    })}
                </div>
            )}
            {!state.reviewed && !loadError && (
                <p className="text-xs text-zinc-500">Not reviewed — pick the mistakes you made, or &quot;No mistakes&quot;.</p>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Wire it into `TradeDetailSheet.tsx`**

Add imports:

```tsx
import { MistakePicker } from '@/components/dashboard/MistakePicker';
import { fetchMistakeTags, mistakeTagsQueryKey } from '@/lib/mistakeTagQueries';
import type { MistakeState } from '@/lib/mistakeStats';
```

Next to the other `useState` calls:

```tsx
    const [mistakeState, setMistakeState] = useState<MistakeState>({ tagIds: [], reviewed: false });
    const { data: mistakeTags = [], isError: mistakeTagsError } = useQuery({
        queryKey: mistakeTagsQueryKey,
        queryFn: () => fetchMistakeTags(),
        enabled: isOpen,
    });
```

In the "Reset form once the full trade row is loaded" effect (from Task 2), add inside `if (fullTrade) { … }`:

```tsx
            setMistakeState({
                tagIds: fullTrade.mistake_tag_ids ?? [],
                reviewed: fullTrade.mistakes_reviewed ?? false,
            });
```

In `handleSave`, add to the object passed to `updateTrade` (after `screenshot_url`):

```tsx
                mistake_tag_ids: mistakeState.tagIds,
                mistakes_reviewed: mistakeState.reviewed,
```

Directly after the closing `</div>` of the `{/* Psychology Tag */}` block, add:

```tsx
                        {/* Mistakes */}
                        <MistakePicker
                            tags={mistakeTags}
                            state={mistakeState}
                            onChange={setMistakeState}
                            loadError={mistakeTagsError}
                        />
```

After a successful save, analytics must see the change. In `handleSave`, after the `setQueryData` line from Task 2, add:

```tsx
                queryClient.invalidateQueries({ queryKey: tradeQueryKeys.all });
```

- [ ] **Step 3: Add the History badge** — in `TradeListItem.tsx`, inside the `<div className="flex items-center gap-2 mb-1">` row, after the `{trade.setup_type && (…)}` block, add:

```tsx
                    {(trade.mistake_tag_ids?.length ?? 0) > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-rose-500/10 text-rose-400 shrink-0">
                            {trade.mistake_tag_ids!.length} mistake{trade.mistake_tag_ids!.length > 1 ? 's' : ''}
                        </span>
                    )}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/MistakePicker.tsx src/components/dashboard/TradeDetailSheet.tsx src/components/dashboard/TradeListItem.tsx
git commit -m "feat(mistakes): tag mistakes in the trade sheet and show them in History"
```

---

### Task 7: Analytics section

**Files:**
- Create: `src/components/analytics/MistakeAnalysis.tsx`
- Modify: `src/app/analytics/page.tsx`

**Interfaces:**
- Consumes: Task 3 `fetchMistakeTags`, `mistakeTagsQueryKey`; Task 4 `analyzeMistakes`, `MistakePeriod`; `formatCurrency`, `formatPercent` from `@/lib/analyticsStats`; `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/card`.
- Produces: `MistakeAnalysis({ trades }: { trades: Trade[] })`.

- [ ] **Step 1: Implement `src/components/analytics/MistakeAnalysis.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Trade } from '@/lib/tradeQueries';
import { fetchMistakeTags, mistakeTagsQueryKey } from '@/lib/mistakeTagQueries';
import { analyzeMistakes, MistakePeriod } from '@/lib/mistakeStats';
import { formatCurrency, formatPercent } from '@/lib/analyticsStats';

const PERIOD_LABEL: Record<MistakePeriod, string> = { month: 'this month', all: 'all time' };

export function MistakeAnalysis({ trades }: { trades: Trade[] }) {
    const [period, setPeriod] = useState<MistakePeriod>('month');
    const { data: tags = [], isError } = useQuery({
        queryKey: mistakeTagsQueryKey,
        queryFn: () => fetchMistakeTags(),
    });

    const analysis = useMemo(
        () => analyzeMistakes(trades, tags, period, new Date()),
        [trades, tags, period]
    );

    const costColor = (cost: number | null) =>
        cost === null ? 'text-zinc-500' : cost > 0 ? 'text-rose-400' : 'text-emerald-400';

    return (
        <Card className="glass-card border-zinc-800/50">
            <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-500/10">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-semibold text-white">Mistakes</CardTitle>
                            <p className="text-sm text-zinc-400">
                                {analysis.reviewedCount} of {analysis.totalCount} trades reviewed
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {(['month', 'all'] as MistakePeriod[]).map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1 rounded-md text-xs ${period === p ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                            >
                                {p === 'month' ? 'This month' : 'All time'}
                            </button>
                        ))}
                        <Link href="/settings/mistakes" className="text-xs text-blue-400 hover:underline ml-2">
                            Manage tags
                        </Link>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {isError && <p className="text-sm text-rose-400">Couldn&apos;t load mistake tags.</p>}

                {analysis.reviewedCount === 0 ? (
                    <p className="text-sm text-zinc-400">
                        No reviewed trades {PERIOD_LABEL[period]}. Open a trade in History and tag its mistakes — or
                        mark it &quot;No mistakes&quot; — to see what your habits cost.
                    </p>
                ) : (
                    <>
                        <div>
                            {analysis.totalCost === null ? (
                                <p className="text-sm text-zinc-400">
                                    Mark trades with <span className="text-zinc-200">No mistakes</span> to compare against.
                                </p>
                            ) : (
                                <p className="text-2xl font-bold text-white">
                                    Mistakes cost you{' '}
                                    <span className={costColor(analysis.totalCost)}>{formatCurrency(analysis.totalCost)}</span>{' '}
                                    <span className="text-base font-normal text-zinc-400">{PERIOD_LABEL[period]}</span>
                                </p>
                            )}
                            <p className="text-xs text-zinc-500 mt-1">
                                {analysis.mistakeTradeCount} mistake trade{analysis.mistakeTradeCount === 1 ? '' : 's'} vs{' '}
                                {analysis.cleanCount} clean
                                {analysis.cleanAvgPnl !== null && ` (avg ${formatCurrency(analysis.cleanAvgPnl)})`}
                                {analysis.smallSample && analysis.cleanCount > 0 && ' · small sample — treat as rough'}
                            </p>
                        </div>

                        {analysis.rows.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                                            <th className="py-2 pr-4 font-medium">Mistake</th>
                                            <th className="py-2 pr-4 font-medium text-right">Trades</th>
                                            <th className="py-2 pr-4 font-medium text-right">Win rate</th>
                                            <th className="py-2 pr-4 font-medium text-right">Avg P&amp;L</th>
                                            <th className="py-2 pr-4 font-medium text-right">Net P&amp;L</th>
                                            <th className="py-2 font-medium text-right">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analysis.rows.map(row => (
                                            <tr key={row.tagId} className="border-t border-zinc-800/60">
                                                <td className={`py-2 pr-4 ${row.isHidden ? 'text-zinc-500' : 'text-zinc-200'}`}>
                                                    {row.name}{row.isHidden && ' (hidden)'}
                                                </td>
                                                <td className="py-2 pr-4 text-right text-zinc-300">{row.count}</td>
                                                <td className="py-2 pr-4 text-right text-zinc-300">{formatPercent(row.winRate)}</td>
                                                <td className="py-2 pr-4 text-right text-zinc-300">{formatCurrency(row.avgPnl)}</td>
                                                <td className="py-2 pr-4 text-right text-zinc-300">{formatCurrency(row.netPnl)}</td>
                                                <td className={`py-2 text-right font-medium ${costColor(row.cost)}`}>
                                                    {row.cost === null ? '—' : formatCurrency(row.cost)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-xs text-zinc-500 mt-2">
                                    A trade with several mistakes counts toward each one, so rows can add up to more than the total.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
```

- [ ] **Step 2: Check `formatPercent`'s input scale**

Run: `sed -n 355,380p src/lib/analyticsStats.ts`
If `formatPercent` expects a 0–1 fraction (multiplies by 100), pass `row.winRate / 100` instead of `row.winRate`. If it expects a 0–100 value, keep as written. Record which in the ledger.

- [ ] **Step 3: Render it on the Analytics page** — in `src/app/analytics/page.tsx`, add the import:

```tsx
import { MistakeAnalysis } from '@/components/analytics/MistakeAnalysis';
```

Directly before the `{/* Performance Summary Table */}` comment, add:

```tsx
                    {/* Mistakes */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <MistakeAnalysis trades={trades} />
                    </motion.div>
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/MistakeAnalysis.tsx src/app/analytics/page.tsx
git commit -m "feat(mistakes): show what each mistake costs in Analytics"
```

---

### Task 8: End-to-end check (with the user)

**Files:** none.

- [ ] **Step 1: Seeding** — user opens the app in two tabs at once, then runs in the SQL editor:
  `select user_id, count(*) from mistake_tags group by user_id;` → 8.
- [ ] **Step 2: Data-loss fix** — open a trade that already has notes and a screenshot from History (after a full page reload); confirm notes/screenshot appear in the form; change only the rating; Save; reload; notes and screenshot still there. Repeat once from Calendar.
- [ ] **Step 3: Tagging** — tag one trade "Moved stop" + "Oversized", mark two trades "No mistakes", leave others untouched. History shows "2 mistakes" badge. Reopen: selections persist. Un-tick both tags → hint returns to "Not reviewed".
- [ ] **Step 4: Tag management** — add a tag, rename it, try renaming to "oversized" (rejected), hide "Overtrading" (disappears from picker, still on trades that have it).
- [ ] **Step 5: Analytics** — Mistakes section shows "N of M trades reviewed"; verify the headline cost by hand from the tagged trades; toggle This month / All time.
- [ ] **Step 6: Report** results plainly, including anything that failed or was skipped.
