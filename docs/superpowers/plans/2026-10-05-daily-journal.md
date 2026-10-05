# Daily Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-trade write-ups (Full or Basic template) in the trade sheet, a per-day note, and a `/journal` page to review a day.

**Architecture:** Two new columns on `trading_journal` (`review_template`, `review_answers jsonb`) and a `daily_notes` table. Template definitions, progress, answer cleaning and day math are pure functions in `src/lib/tradeReview.ts`. The journal page loads full rows for one local day under a `['trades', 'day', …]` query key, so the sheet's existing `invalidateQueries(['trades'])` refreshes it.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query v5, Supabase, Vitest (node env), Radix UI, lucide-react, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-05-daily-journal-design.md`

## Global Constraints

- No new npm dependencies or environment variables.
- Migration is idempotent, applied manually by the user in the Supabase SQL editor **before Task 4** (the first code that writes the new columns).
- English labels everywhere. No AI in v1.
- Answer max 2,000 chars; stored answers JSON ≤ 20,000 bytes; day note max 5,000 chars.
- Full = 6 questions + entry chart (the trade's `screenshot_url`) → total 7. Basic = 2 questions → total 2.
- List queries (`fetchTrades`, `fetchTradesByMonth`) must NOT select `review_answers`.
- Day membership = local calendar day of `entry_time` as the browser parses it (same convention as Calendar/History display).
- Tests: Vitest node env, `src/**/*.test.ts`. `npm test`, `npm run typecheck`, `npm run build` must pass; lint advisory.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XMmNrr8vJZzXfhzxkyyYTj
  ```

## Review Focus

1. **DST day bounds**: on a daylight-saving change day, the day is 23 or 25 hours long; trades just before local midnight must not fall into the wrong day, and consecutive days must tile without gap or overlap. Pinned in Task 2 (test forces `TZ=America/New_York`).
2. **Untouched write-up stays "not written"**: opening and saving a trade without touching the write-up must not stamp `review_template = 'basic'`. Pinned in Task 4 (pure `writeUpToSave` helper, tested in Task 2).
3. **Template switch loses nothing**: Full→Basic→Full keeps every answer; cleaning keeps both templates' keys and drops unknown keys and non-strings. Pinned in Task 2.
4. **Unsaved day note**: switching day or leaving with unsaved text asks first; switching after saving does not. Pinned by design in Task 5 + manual check in Task 7.
5. **`?date=` garbage** (e.g. `?date=banana`, `2026-02-30`): must fall back to the default day, not crash. Pinned in Task 2 (`parseDayKey`).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261005_daily_journal.sql` | trade columns, `daily_notes`, RLS, updated_at trigger |
| `src/lib/tradeReview.ts` | templates, progress, cleaning, day keys/bounds, summary (pure) |
| `src/lib/tradeReview.test.ts` | tests for the above |
| `src/lib/journalQueries.ts` | `fetchTradesForDay`, `fetchDailyNote`, `saveDailyNote` |
| `src/lib/journalQueries.test.ts` | fake-client tests |
| `src/lib/tradeQueries.ts` | `Trade`/`TradeUpdate` fields |
| `src/components/dashboard/TradeWriteUp.tsx` | write-up form section |
| `src/components/dashboard/TradeDetailSheet.tsx` | state, reset, save |
| `src/app/journal/page.tsx` | journal page (Suspense wrapper + content) |
| `src/components/journal/DayNoteEditor.tsx` | day note textarea + save |
| `src/components/layout/DashboardLayout.tsx` | "Journal" nav item |
| `src/app/calendar/page.tsx` | "Open daily journal →" link |

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/20261005_daily_journal.sql`

**Interfaces:**
- Produces: `trading_journal.review_template text`, `trading_journal.review_answers jsonb`; table `public.daily_notes(id, user_id, note_date, note, created_at, updated_at)` unique `(user_id, note_date)`.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================
-- Daily Journal
-- ============================================
-- Per-trade write-ups (Full / Basic template answers) and one note per user
-- per day. Idempotent: safe to re-run on the live DB (which has drifted from
-- these files).

ALTER TABLE public.trading_journal
    ADD COLUMN IF NOT EXISTS review_template TEXT;
ALTER TABLE public.trading_journal
    ADD COLUMN IF NOT EXISTS review_answers JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trading_journal_review_template_check') THEN
        ALTER TABLE public.trading_journal
            ADD CONSTRAINT trading_journal_review_template_check
            CHECK (review_template IS NULL OR review_template IN ('full', 'basic'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'trading_journal_review_answers_size_check') THEN
        ALTER TABLE public.trading_journal
            ADD CONSTRAINT trading_journal_review_answers_size_check
            CHECK (octet_length(review_answers::text) <= 20000);
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.daily_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    note_date DATE NOT NULL,
    note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 5000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, note_date)
);

ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own daily notes" ON public.daily_notes;
CREATE POLICY "Users can view their own daily notes"
    ON public.daily_notes FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own daily notes" ON public.daily_notes;
CREATE POLICY "Users can create their own daily notes"
    ON public.daily_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own daily notes" ON public.daily_notes;
CREATE POLICY "Users can update their own daily notes"
    ON public.daily_notes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_daily_notes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_daily_notes_updated_at ON public.daily_notes;
CREATE TRIGGER trigger_daily_notes_updated_at
    BEFORE UPDATE ON public.daily_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_daily_notes_updated_at();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261005_daily_journal.sql
git commit -m "feat(journal): add daily journal migration"
```

- [ ] **Step 3: Gate — user applies the migration (before Task 4)**

Ask the user to run it in the Supabase SQL editor, then:

```sql
select column_name from information_schema.columns
 where table_name = 'trading_journal' and column_name in ('review_template', 'review_answers');  -- expect 2 rows
select to_regclass('public.daily_notes');  -- expect daily_notes
```

Tasks 2–3 can proceed meanwhile; Task 4 waits for this.

---

### Task 2: Pure write-up and day helpers

**Files:**
- Create: `src/lib/tradeReview.ts`
- Create: `src/lib/tradeReview.test.ts`

**Interfaces:**
- Consumes: `Trade` from `./tradeQueries`; `makeTrade` from `./__fixtures__/trades`.
- Produces:
  - `type ReviewTemplate = 'full' | 'basic'`; `type ReviewAnswers = Record<string, string>`
  - `interface ReviewQuestion { id: string; label: string }`
  - `REVIEW_TEMPLATES: Record<ReviewTemplate, { label: string; questions: ReviewQuestion[]; includesChart: boolean }>`
  - `MAX_ANSWER_LENGTH = 2000`, `MAX_DAY_NOTE_LENGTH = 5000`
  - `reviewProgress(template: ReviewTemplate | null, answers: ReviewAnswers, hasScreenshot: boolean): { done: number; total: number }`
  - `cleanAnswers(answers: Record<string, unknown>): ReviewAnswers`
  - `writeUpToSave(template: ReviewTemplate | null, answers: ReviewAnswers): { review_template: ReviewTemplate | null; review_answers: ReviewAnswers }`
  - `toDayKey(date: Date): string`
  - `parseDayKey(value: string | null | undefined): string | null`
  - `shiftDay(day: string, delta: number): string`
  - `localDayBounds(day: string): { start: string; end: string }`
  - `defaultJournalDay(entryTimes: (string | null | undefined)[], today: Date): string`
  - `summarizeDay(trades: Trade[]): { count: number; netPnl: number; winRate: number; mistakeCount: number; writtenUp: number }`

- [ ] **Step 1: Write the failing tests** — `src/lib/tradeReview.test.ts`

```ts
// Day math is local-time; pin a DST-observing zone so results are deterministic.
process.env.TZ = 'America/New_York';

import { describe, it, expect } from 'vitest';
import { makeTrade } from './__fixtures__/trades';
import {
    cleanAnswers,
    defaultJournalDay,
    localDayBounds,
    MAX_ANSWER_LENGTH,
    parseDayKey,
    REVIEW_TEMPLATES,
    reviewProgress,
    shiftDay,
    summarizeDay,
    toDayKey,
    writeUpToSave,
} from './tradeReview';

describe('REVIEW_TEMPLATES', () => {
    it('has unique question ids that do not overlap between templates', () => {
        const full = REVIEW_TEMPLATES.full.questions.map(q => q.id);
        const basic = REVIEW_TEMPLATES.basic.questions.map(q => q.id);
        expect(new Set(full).size).toBe(6);
        expect(new Set(basic).size).toBe(2);
        expect(full.filter(id => basic.includes(id))).toEqual([]);
        expect(REVIEW_TEMPLATES.full.includesChart).toBe(true);
        expect(REVIEW_TEMPLATES.basic.includesChart).toBe(false);
    });
});

describe('reviewProgress', () => {
    it('counts Full answers plus the chart, out of 7', () => {
        expect(reviewProgress('full', { entry_reason: 'x', stop_reason: 'y' }, true)).toEqual({ done: 3, total: 7 });
        expect(reviewProgress('full', { entry_reason: 'x' }, false)).toEqual({ done: 1, total: 7 });
    });

    it('counts Basic answers out of 2, ignoring blanks and the other template', () => {
        expect(reviewProgress('basic', { standout: 'x', redo: '   ', entry_reason: 'z' }, true)).toEqual({ done: 1, total: 2 });
    });

    it('is 0/0 when no template is chosen', () => {
        expect(reviewProgress(null, { standout: 'x' }, true)).toEqual({ done: 0, total: 0 });
    });
});

describe('cleanAnswers', () => {
    it('trims, drops empties, non-strings and unknown keys, caps length, keeps both templates', () => {
        const cleaned = cleanAnswers({
            entry_reason: '  sweep  ',
            standout: 'x'.repeat(MAX_ANSWER_LENGTH + 50),
            redo: '   ',
            advice: 42,
            bogus: 'nope',
        });
        expect(cleaned).toEqual({ entry_reason: 'sweep', standout: 'x'.repeat(MAX_ANSWER_LENGTH) });
    });
});

describe('writeUpToSave', () => {
    it('keeps an untouched write-up unwritten', () => {
        expect(writeUpToSave(null, {})).toEqual({ review_template: null, review_answers: {} });
    });

    it('saves the template with cleaned answers', () => {
        expect(writeUpToSave('basic', { standout: ' a ', redo: '' })).toEqual({
            review_template: 'basic',
            review_answers: { standout: 'a' },
        });
    });

    it('keeps the other template\'s answers when switched', () => {
        expect(writeUpToSave('basic', { entry_reason: 'kept', standout: 'b' }).review_answers)
            .toEqual({ entry_reason: 'kept', standout: 'b' });
    });
});

describe('day keys', () => {
    it('formats and parses local YYYY-MM-DD', () => {
        expect(toDayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
        expect(parseDayKey('2026-10-05')).toBe('2026-10-05');
    });

    it('rejects garbage and impossible dates', () => {
        for (const bad of ['banana', '2026-02-30', '2026-13-01', '', null, undefined, '2026-1-5']) {
            expect(parseDayKey(bad)).toBeNull();
        }
    });

    it('shifts across month and year ends', () => {
        expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
        expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    });
});

describe('localDayBounds', () => {
    it('spans local midnight to the next local midnight', () => {
        expect(localDayBounds('2026-10-05')).toEqual({
            start: '2026-10-05T04:00:00.000Z',
            end: '2026-10-06T04:00:00.000Z',
        });
    });

    it('handles a 23-hour DST day and tiles with the next day', () => {
        const day = localDayBounds('2026-03-08');
        expect(day).toEqual({ start: '2026-03-08T05:00:00.000Z', end: '2026-03-09T04:00:00.000Z' });
        expect(localDayBounds('2026-03-09').start).toBe(day.end);
    });
});

describe('defaultJournalDay', () => {
    const today = new Date(2026, 9, 5, 15, 0);

    it('is today when there are trades today', () => {
        expect(defaultJournalDay([new Date(2026, 9, 5, 9, 30).toISOString()], today)).toBe('2026-10-05');
    });

    it('is the latest earlier trading day otherwise', () => {
        const times = [new Date(2026, 9, 1, 9).toISOString(), new Date(2026, 9, 2, 9).toISOString(), null];
        expect(defaultJournalDay(times, today)).toBe('2026-10-02');
    });

    it('is today when there are no trades', () => {
        expect(defaultJournalDay([], today)).toBe('2026-10-05');
    });
});

describe('summarizeDay', () => {
    it('summarizes count, P&L, win rate, mistakes and write-ups', () => {
        const trades = [
            makeTrade({ pnl: 100, mistake_tag_ids: ['a', 'b'], review_template: 'basic', review_answers: { standout: 'x' } }),
            makeTrade({ pnl: -40.5, mistake_tag_ids: [], review_template: 'full', review_answers: {} }),
            makeTrade({ pnl: 0 }),
        ];
        expect(summarizeDay(trades)).toEqual({ count: 3, netPnl: 59.5, winRate: 33.33, mistakeCount: 2, writtenUp: 1 });
    });

    it('handles an empty day', () => {
        expect(summarizeDay([])).toEqual({ count: 0, netPnl: 0, winRate: 0, mistakeCount: 0, writtenUp: 0 });
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/tradeReview.test.ts`
Expected: FAIL — cannot resolve `./tradeReview`.

- [ ] **Step 3: Implement `src/lib/tradeReview.ts`**

```ts
import type { Trade } from './tradeQueries';

export type ReviewTemplate = 'full' | 'basic';
export type ReviewAnswers = Record<string, string>;

export interface ReviewQuestion {
    id: string;
    label: string;
}

export const REVIEW_TEMPLATES: Record<
    ReviewTemplate,
    { label: string; questions: ReviewQuestion[]; includesChart: boolean }
> = {
    full: {
        label: 'Full',
        includesChart: true,
        questions: [
            { id: 'htf_analysis', label: 'Higher-timeframe analysis' },
            { id: 'entry_reason', label: 'Reason for entry' },
            { id: 'stop_reason', label: 'Reason for stop placement' },
            { id: 'execution', label: 'Actual execution' },
            { id: 'emotions', label: 'Emotions before entry and while holding' },
            { id: 'advice', label: 'Advice to my pre-trade self' },
        ],
    },
    basic: {
        label: 'Basic',
        includesChart: false,
        questions: [
            { id: 'standout', label: 'What stood out in this trade, good or bad?' },
            { id: 'redo', label: 'If I did it again, what would I do?' },
        ],
    },
};

export const MAX_ANSWER_LENGTH = 2000;
export const MAX_DAY_NOTE_LENGTH = 5000;

const KNOWN_IDS = new Set(
    Object.values(REVIEW_TEMPLATES).flatMap(t => t.questions.map(q => q.id))
);

const round2 = (n: number) => Math.round(n * 100) / 100;

export function reviewProgress(
    template: ReviewTemplate | null,
    answers: ReviewAnswers,
    hasScreenshot: boolean
): { done: number; total: number } {
    if (!template) return { done: 0, total: 0 };
    const def = REVIEW_TEMPLATES[template];
    const answered = def.questions.filter(q => (answers[q.id] ?? '').trim() !== '').length;
    const chart = def.includesChart ? 1 : 0;
    return {
        done: answered + (def.includesChart && hasScreenshot ? 1 : 0),
        total: def.questions.length + chart,
    };
}

/** Trim, drop empty/non-string/unknown answers, cap length. Keeps both templates' answers. */
export function cleanAnswers(answers: Record<string, unknown>): ReviewAnswers {
    const cleaned: ReviewAnswers = {};
    for (const [id, value] of Object.entries(answers)) {
        if (!KNOWN_IDS.has(id) || typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (trimmed) cleaned[id] = trimmed.slice(0, MAX_ANSWER_LENGTH);
    }
    return cleaned;
}

/** The write-up fields for a trade update. An untouched write-up (null template) stays unwritten. */
export function writeUpToSave(
    template: ReviewTemplate | null,
    answers: ReviewAnswers
): { review_template: ReviewTemplate | null; review_answers: ReviewAnswers } {
    return { review_template: template, review_answers: cleanAnswers(answers) };
}

// ============================================
// Days (local time)
// ============================================

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A valid local YYYY-MM-DD, or null. */
export function parseDayKey(value: string | null | undefined): string | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return toDayKey(date) === value ? value : null;
}

function dayToDate(day: string, offsetDays = 0): Date {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d + offsetDays);
}

export function shiftDay(day: string, delta: number): string {
    return toDayKey(dayToDate(day, delta));
}

/** Local midnight to the next local midnight (end exclusive), as ISO instants. */
export function localDayBounds(day: string): { start: string; end: string } {
    return { start: dayToDate(day).toISOString(), end: dayToDate(day, 1).toISOString() };
}

/** Today if it has trades, else the latest day with a trade, else today. */
export function defaultJournalDay(entryTimes: (string | null | undefined)[], today: Date): string {
    const todayKey = toDayKey(today);
    const days = entryTimes
        .filter((t): t is string => !!t)
        .map(t => toDayKey(new Date(t)))
        .filter(d => d <= todayKey);
    if (days.includes(todayKey) || days.length === 0) return todayKey;
    return days.reduce((latest, d) => (d > latest ? d : latest));
}

export function summarizeDay(trades: Trade[]): {
    count: number;
    netPnl: number;
    winRate: number;
    mistakeCount: number;
    writtenUp: number;
} {
    const count = trades.length;
    const wins = trades.filter(t => t.pnl > 0).length;
    return {
        count,
        netPnl: round2(trades.reduce((sum, t) => sum + t.pnl, 0)),
        winRate: count ? round2((wins / count) * 100) : 0,
        mistakeCount: trades.reduce((sum, t) => sum + (t.mistake_tag_ids?.length ?? 0), 0),
        writtenUp: trades.filter(
            t => reviewProgress(t.review_template ?? null, t.review_answers ?? {}, !!t.screenshot_url).done > 0
        ).length,
    };
}
```

Note: `summarizeDay` references `Trade.review_template` / `review_answers`, which Task 3 adds. Add them now to `src/lib/tradeQueries.ts` as part of this task so the test compiles — in `interface Trade` after `mistakes_reviewed?: boolean;`:

```ts
    review_template?: 'full' | 'basic' | null;
    review_answers?: Record<string, string>;
```

and in `interface TradeUpdate` after `mistakes_reviewed?: boolean;`:

```ts
    review_template?: 'full' | 'basic' | null;
    review_answers?: Record<string, string>;
```

(Literal types rather than importing `ReviewTemplate` avoid an import cycle between `tradeQueries.ts` and `tradeReview.ts`.)

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/tradeReview.test.ts && npm run typecheck`
Expected: PASS (all); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tradeReview.ts src/lib/tradeReview.test.ts src/lib/tradeQueries.ts
git commit -m "feat(journal): add write-up templates and day helpers"
```

---

### Task 3: Journal queries

**Files:**
- Create: `src/lib/journalQueries.ts`
- Create: `src/lib/journalQueries.test.ts`

**Interfaces:**
- Consumes: `localDayBounds` (Task 2); `Trade`; `getSupabase`.
- Produces:
  - `journalQueryKeys = { day: (day: string, accountId?: string) => ['trades', 'day', day, accountId ?? null] as const, note: (day: string) => ['dailyNote', day] as const }`
  - `fetchTradesForDay(day: string, accountId?: string, client?): Promise<Trade[]>`
  - `fetchDailyNote(day: string, client?): Promise<string>`
  - `saveDailyNote(userId: string, day: string, note: string, client?): Promise<void>`

- [ ] **Step 1: Write the failing tests** — `src/lib/journalQueries.test.ts`

```ts
process.env.TZ = 'America/New_York';

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('./supabase', () => ({ getSupabase: () => { throw new Error('use the injected client'); } }));

const { fetchDailyNote, fetchTradesForDay, journalQueryKeys, saveDailyNote } = await import('./journalQueries');

/** Records every builder call; resolves to `result` when awaited. */
function recordingClient(result: { data?: unknown; error?: unknown }) {
    const calls: [string, ...unknown[]][] = [];
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'gte', 'lt', 'eq', 'order', 'maybeSingle', 'upsert']) {
        builder[method] = (...args: unknown[]) => {
            calls.push([method, ...args]);
            return builder;
        };
    }
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...result });
    const client = {
        from: (table: string) => {
            calls.push(['from', table]);
            return builder;
        },
    } as unknown as SupabaseClient;
    return { client, calls };
}

describe('journalQueryKeys', () => {
    it('keeps day trades under the trades key so trade saves refresh them', () => {
        expect(journalQueryKeys.day('2026-10-05', 'acct')[0]).toBe('trades');
    });
});

describe('fetchTradesForDay', () => {
    it('loads full rows inside the local day, oldest first, for the account', async () => {
        const rows = [{ id: 't1' }];
        const { client, calls } = recordingClient({ data: rows });
        expect(await fetchTradesForDay('2026-10-05', 'acct', client)).toEqual(rows);
        expect(calls).toEqual([
            ['from', 'trading_journal'],
            ['select', '*'],
            ['gte', 'entry_time', '2026-10-05T04:00:00.000Z'],
            ['lt', 'entry_time', '2026-10-06T04:00:00.000Z'],
            ['order', 'entry_time', { ascending: true }],
            ['eq', 'account_id', 'acct'],
        ]);
    });

    it('omits the account filter when none is given', async () => {
        const { client, calls } = recordingClient({ data: [] });
        await fetchTradesForDay('2026-10-05', undefined, client);
        expect(calls.some(c => c[0] === 'eq')).toBe(false);
    });
});

describe('daily note', () => {
    it('returns an empty note when there is none', async () => {
        const { client, calls } = recordingClient({ data: null });
        expect(await fetchDailyNote('2026-10-05', client)).toBe('');
        expect(calls).toContainEqual(['eq', 'note_date', '2026-10-05']);
    });

    it('returns the stored note', async () => {
        const { client } = recordingClient({ data: { note: 'Stayed patient.' } });
        expect(await fetchDailyNote('2026-10-05', client)).toBe('Stayed patient.');
    });

    it('upserts on (user_id, note_date)', async () => {
        const { client, calls } = recordingClient({});
        await saveDailyNote('u1', '2026-10-05', 'Good day', client);
        expect(calls).toContainEqual([
            'upsert',
            { user_id: 'u1', note_date: '2026-10-05', note: 'Good day' },
            { onConflict: 'user_id,note_date' },
        ]);
    });

    it('throws on error', async () => {
        const { client } = recordingClient({ error: { message: 'rls' } });
        await expect(saveDailyNote('u1', '2026-10-05', 'x', client)).rejects.toMatchObject({ message: 'rls' });
    });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/journalQueries.test.ts`
Expected: FAIL — cannot resolve `./journalQueries`.

- [ ] **Step 3: Implement `src/lib/journalQueries.ts`**

```ts
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { Trade } from './tradeQueries';
import { localDayBounds } from './tradeReview';

export const journalQueryKeys = {
    // Under 'trades' so the trade sheet's invalidateQueries(['trades']) refreshes the day.
    day: (day: string, accountId?: string) => ['trades', 'day', day, accountId ?? null] as const,
    note: (day: string) => ['dailyNote', day] as const,
};

/** Full rows (write-ups included) for trades entered on a local day. */
export async function fetchTradesForDay(
    day: string,
    accountId?: string,
    client: SupabaseClient = getSupabase()
): Promise<Trade[]> {
    const { start, end } = localDayBounds(day);
    let query = client
        .from('trading_journal')
        .select('*')
        .gte('entry_time', start)
        .lt('entry_time', end)
        .order('entry_time', { ascending: true });

    if (accountId) {
        query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching trades for day:', error);
        throw error;
    }
    return data as Trade[];
}

export async function fetchDailyNote(day: string, client: SupabaseClient = getSupabase()): Promise<string> {
    const { data, error } = await client
        .from('daily_notes')
        .select('note')
        .eq('note_date', day)
        .maybeSingle();

    if (error) {
        console.error('Error fetching daily note:', error);
        throw error;
    }
    return (data as { note: string } | null)?.note ?? '';
}

export async function saveDailyNote(
    userId: string,
    day: string,
    note: string,
    client: SupabaseClient = getSupabase()
): Promise<void> {
    const { error } = await client
        .from('daily_notes')
        .upsert({ user_id: userId, note_date: day, note }, { onConflict: 'user_id,note_date' });

    if (error) {
        console.error('Error saving daily note:', error);
        throw error;
    }
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/journalQueries.test.ts && npm run typecheck`
Expected: PASS (7 tests); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/journalQueries.ts src/lib/journalQueries.test.ts
git commit -m "feat(journal): add day trade and daily note queries"
```

---

### Task 4: Write-up in the trade sheet

**Files:**
- Create: `src/components/dashboard/TradeWriteUp.tsx`
- Modify: `src/components/dashboard/TradeDetailSheet.tsx`

**Interfaces:**
- Consumes: Task 2 `REVIEW_TEMPLATES`, `ReviewTemplate`, `ReviewAnswers`, `reviewProgress`, `writeUpToSave`, `MAX_ANSWER_LENGTH`.
- Produces: `TradeWriteUp({ template, answers, hasScreenshot, onChange }: { template: ReviewTemplate | null; answers: ReviewAnswers; hasScreenshot: boolean; onChange: (template: ReviewTemplate, answers: ReviewAnswers) => void })`.

**Precondition:** the Task 1 gate passed.

- [ ] **Step 1: Implement `src/components/dashboard/TradeWriteUp.tsx`**

```tsx
'use client';

import { Textarea } from '@/components/ui/textarea';
import {
    MAX_ANSWER_LENGTH,
    REVIEW_TEMPLATES,
    ReviewAnswers,
    ReviewTemplate,
    reviewProgress,
} from '@/lib/tradeReview';

interface TradeWriteUpProps {
    /** null = not written yet; shown as Basic until the user types or picks. */
    template: ReviewTemplate | null;
    answers: ReviewAnswers;
    hasScreenshot: boolean;
    onChange: (template: ReviewTemplate, answers: ReviewAnswers) => void;
}

export function TradeWriteUp({ template, answers, hasScreenshot, onChange }: TradeWriteUpProps) {
    const shown: ReviewTemplate = template ?? 'basic';
    const def = REVIEW_TEMPLATES[shown];
    const progress = reviewProgress(shown, answers, hasScreenshot);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400 font-medium">
                    Write-up{' '}
                    <span className="text-xs text-zinc-500">
                        {template ? `${progress.done}/${progress.total}` : 'not written'}
                    </span>
                </label>
                <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
                    {(['full', 'basic'] as ReviewTemplate[]).map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => onChange(t, answers)}
                            className={`px-3 py-1 ${shown === t ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            {REVIEW_TEMPLATES[t].label}
                        </button>
                    ))}
                </div>
            </div>

            {def.questions.map(q => (
                <div key={q.id} className="space-y-1">
                    <p className="text-xs text-zinc-400">{q.label}</p>
                    <Textarea
                        value={answers[q.id] ?? ''}
                        maxLength={MAX_ANSWER_LENGTH}
                        onChange={e => onChange(shown, { ...answers, [q.id]: e.target.value })}
                        className="bg-zinc-900/50 border-zinc-700/50 min-h-[64px] focus:ring-blue-500/30 focus:border-zinc-600 resize-none"
                    />
                </div>
            ))}

            {def.includesChart && (
                <p className={`text-xs ${hasScreenshot ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    Entry chart: {hasScreenshot
                        ? 'screenshot attached.'
                        : 'upload your chart above, marking entry, target and stop.'}
                </p>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Wire into `TradeDetailSheet.tsx`**

Add imports:

```tsx
import { TradeWriteUp } from '@/components/dashboard/TradeWriteUp';
import { ReviewAnswers, ReviewTemplate, writeUpToSave } from '@/lib/tradeReview';
```

Next to the other `useState` calls:

```tsx
    const [reviewTemplate, setReviewTemplate] = useState<ReviewTemplate | null>(null);
    const [reviewAnswers, setReviewAnswers] = useState<ReviewAnswers>({});
```

In the form-reset effect, inside the `if (isOpen && fullTrade && fullTrade.id === trade?.id) { … }` block, after `setMistakeState(…)`, add:

```tsx
            setReviewTemplate(fullTrade.review_template ?? null);
            setReviewAnswers(fullTrade.review_answers ?? {});
```

In `handleSave`, add to the `updateTrade` object after `mistakes_reviewed: mistakeState.reviewed,`:

```tsx
                ...writeUpToSave(reviewTemplate, reviewAnswers),
```

Directly after the `<ScreenshotUploader … />` element (inside the same parent `<div>`, before its closing `</div>`), add:

```tsx

                        {/* Write-up */}
                        <TradeWriteUp
                            template={reviewTemplate}
                            answers={reviewAnswers}
                            hasScreenshot={!!screenshotUrl}
                            onChange={(template, answers) => {
                                setReviewTemplate(template);
                                setReviewAnswers(answers);
                            }}
                        />
```

(Placed after the uploader — not after Notes as the spec says — so "upload your chart above" is literally true. Same section, one element lower.)

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/TradeWriteUp.tsx src/components/dashboard/TradeDetailSheet.tsx
git commit -m "feat(journal): write Full or Basic trade write-ups in the trade sheet"
```

---

### Task 5: Journal page and nav

**Files:**
- Create: `src/components/journal/DayNoteEditor.tsx`
- Create: `src/app/journal/page.tsx`
- Modify: `src/components/layout/DashboardLayout.tsx` (lucide import + `navItems`)

**Interfaces:**
- Consumes: Task 2 helpers (`parseDayKey`, `defaultJournalDay`, `shiftDay`, `summarizeDay`, `reviewProgress`, `REVIEW_TEMPLATES`, `MAX_DAY_NOTE_LENGTH`); Task 3 (`journalQueryKeys`, `fetchTradesForDay`, `fetchDailyNote`, `saveDailyNote`); `useTradesForCurrentAccount`; `useAccount`; `TradeDetailSheet`; `formatPnL` from `@/lib/tradeStats`; `formatCurrency` from `@/lib/analyticsStats`.
- Produces: route `/journal` (`?date=YYYY-MM-DD`); `DayNoteEditor({ day, initialNote, onDirtyChange }: { day: string; initialNote: string; onDirtyChange: (dirty: boolean) => void })`.

- [ ] **Step 1: Implement `src/components/journal/DayNoteEditor.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getSupabase } from '@/lib/supabase';
import { journalQueryKeys, saveDailyNote } from '@/lib/journalQueries';
import { MAX_DAY_NOTE_LENGTH } from '@/lib/tradeReview';

interface DayNoteEditorProps {
    day: string;
    initialNote: string;
    onDirtyChange: (dirty: boolean) => void;
}

/** Mount with key={day} so the draft resets per day without an effect. */
export function DayNoteEditor({ day, initialNote, onDirtyChange }: DayNoteEditorProps) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState(initialNote);
    const [saved, setSaved] = useState(initialNote);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dirty = draft !== saved;

    const handleChange = (value: string) => {
        setDraft(value);
        onDirtyChange(value !== saved);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const { data: { user } } = await getSupabase().auth.getUser();
            if (!user) throw new Error('Not signed in');
            const note = draft.trim();
            await saveDailyNote(user.id, day, note);
            setDraft(note);
            setSaved(note);
            onDirtyChange(false);
            queryClient.setQueryData(journalQueryKeys.note(day), note);
        } catch {
            setError('Couldn’t save your note. Your text is still here — try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300">What did I do today?</label>
                {dirty && <span className="text-xs text-amber-400">Unsaved</span>}
            </div>
            <Textarea
                value={draft}
                maxLength={MAX_DAY_NOTE_LENGTH}
                onChange={e => handleChange(e.target.value)}
                placeholder="How did the session go? What did you notice about yourself?"
                className="bg-zinc-900/50 border-zinc-700/50 min-h-[110px] resize-none"
            />
            <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving || !dirty} className="bg-blue-600 hover:bg-blue-500">
                    {saving ? 'Saving…' : 'Save note'}
                </Button>
                {error && <p className="text-sm text-rose-400">{error}</p>}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Implement `src/app/journal/page.tsx`**

```tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ChevronDown, NotebookPen } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TradeDetailSheet } from '@/components/dashboard/TradeDetailSheet';
import { DayNoteEditor } from '@/components/journal/DayNoteEditor';
import { useAccount } from '@/components/providers/AccountContext';
import { useTradesForCurrentAccount } from '@/hooks/useTrades';
import { fetchDailyNote, fetchTradesForDay, journalQueryKeys } from '@/lib/journalQueries';
import type { Trade } from '@/lib/tradeQueries';
import { formatPnL } from '@/lib/tradeStats';
import { formatCurrency } from '@/lib/analyticsStats';
import {
    defaultJournalDay,
    parseDayKey,
    REVIEW_TEMPLATES,
    reviewProgress,
    shiftDay,
    summarizeDay,
} from '@/lib/tradeReview';

const UNSAVED_PROMPT = 'You have an unsaved note for this day. Leave without saving?';

function formatDayTitle(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
}

function formatTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function JournalContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { currentAccount, isLoading: accountLoading } = useAccount();
    const accountId = currentAccount?.id;

    // Default day needs the account's trade dates (cached list query).
    const { data: allTrades, isLoading: listLoading } = useTradesForCurrentAccount();
    const requestedDay = parseDayKey(searchParams.get('date'));
    const day = requestedDay
        ?? (listLoading || accountLoading ? null : defaultJournalDay((allTrades ?? []).map(t => t.entry_time), new Date()));

    const [noteDirty, setNoteDirty] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [sheetTrade, setSheetTrade] = useState<Trade | null>(null);

    // Warn before closing the tab with an unsaved note.
    useEffect(() => {
        if (!noteDirty) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [noteDirty]);

    const tradesQuery = useQuery({
        queryKey: journalQueryKeys.day(day ?? '', accountId),
        queryFn: () => fetchTradesForDay(day!, accountId),
        enabled: !!day && !accountLoading,
    });
    const noteQuery = useQuery({
        queryKey: journalQueryKeys.note(day ?? ''),
        queryFn: () => fetchDailyNote(day!),
        enabled: !!day,
        staleTime: Infinity,
    });

    const trades = useMemo(() => tradesQuery.data ?? [], [tradesQuery.data]);
    const summary = useMemo(() => summarizeDay(trades), [trades]);

    const goTo = (next: string) => {
        if (noteDirty && !window.confirm(UNSAVED_PROMPT)) return;
        setNoteDirty(false);
        setExpanded(new Set());
        router.replace(`/journal?date=${next}`);
    };

    const toggleExpanded = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    if (!day) {
        return <p className="text-sm text-zinc-500">Loading…</p>;
    }

    return (
        <div className="space-y-6">
            {/* Day picker */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <NotebookPen className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Daily journal</h1>
                        <p className="text-sm text-zinc-400">{formatDayTitle(day)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => goTo(shiftDay(day, -1))} aria-label="Previous day">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Input
                        type="date"
                        value={day}
                        onChange={e => { const next = parseDayKey(e.target.value); if (next) goTo(next); }}
                        className="w-[160px] bg-zinc-900/50 border-zinc-700"
                    />
                    <Button variant="ghost" size="icon" onClick={() => goTo(shiftDay(day, 1))} aria-label="Next day">
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Day summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    ['Trades', String(summary.count)],
                    ['Net P&L', formatCurrency(summary.netPnl)],
                    ['Win rate', `${summary.winRate.toFixed(1)}%`],
                    ['Mistakes', String(summary.mistakeCount)],
                    ['Written up', `${summary.writtenUp} of ${summary.count}`],
                ].map(([label, value]) => (
                    <div key={label} className="glass-card p-3 rounded-xl border border-zinc-800/50">
                        <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
                        <p className="text-lg font-semibold text-white">{value}</p>
                    </div>
                ))}
            </div>

            {/* Day note */}
            <div className="glass-card p-4 rounded-xl border border-zinc-800/50">
                {noteQuery.isError ? (
                    <p className="text-sm text-rose-400">Couldn&apos;t load your note for this day.</p>
                ) : noteQuery.data === undefined ? (
                    <p className="text-sm text-zinc-500">Loading note…</p>
                ) : (
                    <DayNoteEditor key={day} day={day} initialNote={noteQuery.data} onDirtyChange={setNoteDirty} />
                )}
            </div>

            {/* Trades */}
            <div className="space-y-2">
                <h2 className="text-lg font-semibold text-white">Trades</h2>
                {tradesQuery.isError && (
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-rose-400">Couldn&apos;t load this day&apos;s trades.</p>
                        <Button size="sm" variant="outline" onClick={() => tradesQuery.refetch()}>Retry</Button>
                    </div>
                )}
                {tradesQuery.isLoading && <p className="text-sm text-zinc-500">Loading trades…</p>}
                {tradesQuery.isSuccess && trades.length === 0 && (
                    <p className="text-sm text-zinc-500">No trades on this day.</p>
                )}
                {trades.map(trade => {
                    const template = trade.review_template ?? null;
                    const answers = trade.review_answers ?? {};
                    const progress = reviewProgress(template, answers, !!trade.screenshot_url);
                    const pnl = formatPnL(trade.pnl);
                    const isOpen = expanded.has(trade.id);
                    return (
                        <div key={trade.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40">
                            <div className="flex items-center gap-3 px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() => toggleExpanded(trade.id)}
                                    className="flex flex-1 items-center gap-3 text-left"
                                    aria-expanded={isOpen}
                                >
                                    <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                    <span className="font-semibold text-white">{trade.symbol}</span>
                                    <span className="text-xs text-zinc-500">{formatTime(trade.entry_time)}</span>
                                    <span className={`font-mono text-sm ${pnl.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{pnl.text}</span>
                                    <span className="text-xs text-zinc-400">
                                        {template ? `${REVIEW_TEMPLATES[template].label} ${progress.done}/${progress.total}` : 'Not written'}
                                    </span>
                                </button>
                                <Button size="sm" variant="outline" onClick={() => setSheetTrade(trade)} className="border-zinc-700">
                                    {template ? 'Edit' : 'Write'}
                                </Button>
                            </div>
                            {isOpen && (
                                <div className="border-t border-zinc-800/60 px-4 py-3 space-y-3">
                                    {!template && <p className="text-sm text-zinc-500">No write-up yet.</p>}
                                    {template && REVIEW_TEMPLATES[template].questions.map(q => (
                                        <div key={q.id}>
                                            <p className="text-xs text-zinc-500">{q.label}</p>
                                            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{answers[q.id] || '—'}</p>
                                        </div>
                                    ))}
                                    {template && REVIEW_TEMPLATES[template].includesChart && trade.screenshot_url && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={trade.screenshot_url} alt="Entry chart" className="max-h-80 rounded-lg border border-zinc-800" />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <TradeDetailSheet
                trade={sheetTrade}
                isOpen={!!sheetTrade}
                onClose={() => setSheetTrade(null)}
                onUpdate={() => { /* the day refetches via invalidateQueries(['trades']) */ }}
            />
        </div>
    );
}

export default function JournalPage() {
    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4">
                {/* useSearchParams needs a Suspense boundary in the App Router */}
                <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
                    <JournalContent />
                </Suspense>
            </div>
        </DashboardLayout>
    );
}
```

- [ ] **Step 3: Add the nav item** — in `src/components/layout/DashboardLayout.tsx`, add `NotebookPen` to the `lucide-react` import list (after `BookOpen`), and in `navItems` insert after the History entry:

```tsx
    { href: '/journal', label: 'Journal', icon: NotebookPen },
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass; build lists `/journal`.

- [ ] **Step 5: Commit**

```bash
git add src/components/journal/DayNoteEditor.tsx src/app/journal/page.tsx src/components/layout/DashboardLayout.tsx
git commit -m "feat(journal): add daily journal page"
```

---

### Task 6: Calendar link

**Files:**
- Modify: `src/app/calendar/page.tsx`

- [ ] **Step 1: Add the link**

Add `import Link from 'next/link';` with the other imports. In the trade-list header, replace the `{selectedDate && ( <Button … Clear </Button> )}` block with:

```tsx
                                    {selectedDate && (
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/journal?date=${format(selectedDate, 'yyyy-MM-dd')}`}
                                                className="text-sm text-blue-400 hover:underline"
                                            >
                                                Open daily journal →
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedDate(null)}
                                                className="text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                                            >
                                                <X className="w-4 h-4 mr-1" />
                                                Clear
                                            </Button>
                                        </div>
                                    )}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run build`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add src/app/calendar/page.tsx
git commit -m "feat(journal): link calendar days to the daily journal"
```

---

### Task 7: End-to-end check (with the user)

**Files:** none.

- [ ] **Step 1:** Open a trade → Write-up shows "not written" (Basic shown). Save without touching it → still "Not written" on the Journal page.
- [ ] **Step 2:** Fill Basic, Save. Switch to Full, fill two questions, Save. Switch back to Basic → Basic answers still there; switch to Full → Full answers still there. With a screenshot, Full shows 3/7.
- [ ] **Step 3:** Journal page: the day shows the trade with "Full 3/7", expand shows answers and the chart, "Written up 1 of N" correct.
- [ ] **Step 4:** Day note: type, see "Unsaved"; press → and confirm the prompt appears; cancel; Save; press → (no prompt); come back ← → note is there.
- [ ] **Step 5:** Calendar: select a day → "Open daily journal →" lands on that day; the day's trades match what Calendar/History show for that day (overnight trades excepted).
- [ ] **Step 6:** `/journal?date=banana` falls back to the default day.
- [ ] **Step 7:** Report results plainly, including anything that failed or was skipped.
