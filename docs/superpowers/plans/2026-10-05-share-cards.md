# Share Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trader share a single trade or a playbook setup as a PNG card and as a revocable public link (`/share/<token>`) that unfurls into the same card.

**Architecture:** The client builds a privacy-filtered JSON snapshot (pure functions), which is either POSTed to a stateless image route for download/copy, or stored in a new `shares` table under a random token. Anonymous viewers read snapshots only through a token-gated `SECURITY DEFINER` SQL function. One Satori-compatible `ShareCard` component renders everywhere (dialog preview, PNG route, OG image).

**Tech Stack:** Next.js 16 App Router, React 19, `next/og` `ImageResponse` (built in, no new deps), Supabase (Postgres + RLS + RPC), Vitest (node env), Radix Dialog, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-05-share-cards-design.md`

## Global Constraints

- No new npm dependencies and no new environment variables.
- Server code has only the anon key: never read `trading_journal`, `accounts`, or `playbook_setups` from share routes. Public reads go through `get_share(p_token text)` only.
- Payloads never contain account name, account id, user id, email, trade id, or setup id.
- Only the chosen result mode (`points` | `usd` | `percent`) is stored. Default mode order: `points` → `percent` → `usd`.
- Screenshot and notes are opt-in (default off). `screenshotUrl` is only accepted when its host equals the host of `NEXT_PUBLIC_SUPABASE_URL`.
- Serialized payload ≤ 16 KB. Notes ≤ 500 chars. Rules ≤ 6, each ≤ 200 chars. Description ≤ 200 chars.
- Card size 1200×630; inline styles + flexbox only; every element with more than one child sets `display: 'flex'` (Satori requirement). No emoji or ★/✓ glyphs (default `next/og` font lacks them).
- Share routes are dynamic (`export const dynamic = 'force-dynamic'`) — CI builds with a placeholder Supabase URL.
- Migration is idempotent and applied manually by the user in the Supabase SQL editor (live DB has drifted from `supabase/migrations`).
- Tests: Vitest node env, files match `src/**/*.test.ts`. `npm test`, `npm run typecheck`, `npm run build` must pass. Lint is advisory (pre-existing errors).
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XMmNrr8vJZzXfhzxkyyYTj
  ```

## Review Focus

1. **Missing prices stored as 0** — the Tradovate importer writes `parseFloat(x) || 0`, so a missing price is `0`, not `null`. Expect points to be unavailable (not a huge bogus number) and the price to render as "—". Pinned in Task 2.
2. **Trades from list views lack `notes`/`screenshot_url`** — `fetchTrades` doesn't select them; the dialog must use the sheet's form state, and the builder must omit absent/whitespace-only notes even when "include notes" is on. Pinned in Task 2.
3. **Floating-point noise** — `5001.25 − 5000.1` must show `1.15`, not `1.1500000000004`. Pinned in Task 2.
4. **Oversized setup content** — 20 rules or a 2,000-char description must be capped, not overflow the card or exceed 16 KB. Pinned in Task 2.
5. **Blank form values** — the playbook form allows empty rule rows and blank timeframes; the validator rejects empty strings, so the builder must drop/null them or every share of such a setup fails. Pinned in Task 2.
6. **Tampered stored payload** — an owner can write any JSON to their own row via the API; `fetchSharedCard` must re-validate, so a foreign `screenshotUrl` is never fetched by the server. Pinned in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261005_shares.sql` | `shares` table, RLS, column grants, `get_share` RPC |
| `src/lib/sharePayload.ts` | Types, token, result formatting, trade/playbook payload builders (pure) |
| `src/lib/sharePayload.test.ts` | Builder/format/token tests |
| `src/lib/shareValidation.ts` | `validateSharedCard`, `supabaseImageHost` (pure) |
| `src/lib/shareValidation.test.ts` | Validator tests |
| `src/lib/shareQueries.ts` | `createShare`, `listSharesForSource`, `revokeShare`, `fetchSharedCard` |
| `src/lib/shareQueries.test.ts` | Query tests with a fake client |
| `src/components/share/ShareCard.tsx` | Pure 1200×630 card JSX (trade + playbook + unavailable) |
| `src/components/share/renderShareImage.tsx` | `ImageResponse` wrapper; inlines screenshot as data URL |
| `src/app/api/share/image/route.ts` | `POST` payload → PNG |
| `src/app/share/[token]/page.tsx` | Public page + metadata |
| `src/app/share/[token]/opengraph-image.tsx` | OG image for unfurls |
| `src/app/share/[token]/not-found.tsx` | "This link is no longer available" |
| `src/components/share/ShareDialog.tsx` | Options, preview, download/copy/link/revoke |
| `src/components/dashboard/TradeDetailSheet.tsx` | Add Share button |
| `src/app/playbook/page.tsx` | Add Share button per setup |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20261005_shares.sql`

**Interfaces:**
- Produces: table `public.shares(id, token, user_id, kind, source_id, payload, created_at, revoked_at)`; RPC `get_share(p_token text) returns jsonb` → `{kind, payload, created_at}` or `null`.

- [ ] **Step 1: Write the migration**

```sql
-- ============================================
-- Share Cards
-- ============================================
-- Frozen, privacy-filtered snapshots of a trade or playbook setup, readable by
-- anyone holding the token via get_share(). Idempotent: safe to re-run on the
-- live DB (which has drifted from these files).

CREATE TABLE IF NOT EXISTS public.shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('trade', 'playbook')),
    source_id UUID NOT NULL,
    payload JSONB NOT NULL CHECK (octet_length(payload::text) <= 16384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shares_owner_source ON public.shares(user_id, kind, source_id);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own shares" ON public.shares;
CREATE POLICY "Users can view their own shares"
    ON public.shares FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own shares" ON public.shares;
CREATE POLICY "Users can create their own shares"
    ON public.shares FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can revoke their own shares" ON public.shares;
CREATE POLICY "Users can revoke their own shares"
    ON public.shares FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Owners may only change revoked_at; the snapshot itself is immutable.
REVOKE UPDATE ON public.shares FROM anon, authenticated;
GRANT UPDATE (revoked_at) ON public.shares TO authenticated;

-- The only public read path: exact token match, not revoked.
CREATE OR REPLACE FUNCTION public.get_share(p_token TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT jsonb_build_object('kind', s.kind, 'payload', s.payload, 'created_at', s.created_at)
    FROM public.shares s
    WHERE s.token = p_token AND s.revoked_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_share(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_share(TEXT) TO anon, authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261005_shares.sql
git commit -m "feat(share): add shares table and get_share RPC migration"
```

(Applied by the user in Task 8; nothing in Tasks 2–7 needs the live table.)

---

### Task 2: Payload builders

**Files:**
- Create: `src/lib/sharePayload.ts`
- Test: `src/lib/sharePayload.test.ts`

**Interfaces:**
- Consumes: `Trade` from `src/lib/tradeQueries.ts`, `PlaybookSetup` from `src/lib/playbookQueries.ts`.
- Produces:
  - types `ShareKind`, `ResultMode`, `ShareResult`, `TradeSharePayload`, `PlaybookSharePayload`, `SharedCard`, `TradeShareOptions`, `PlaybookShareOptions`
  - consts `MAX_NOTES_LENGTH = 500`, `MAX_RULES = 6`, `MAX_TEXT_LENGTH = 200`
  - `tradePoints(trade: Trade): number | null`
  - `availableTradeResultModes(trade: Trade, initialBalance: number | null): ResultMode[]`
  - `availablePlaybookResultModes(initialBalance: number | null): ResultMode[]`
  - `defaultResultMode(modes: ResultMode[]): ResultMode`
  - `buildTradeSharePayload(trade: Trade, options: TradeShareOptions, initialBalance: number | null): TradeSharePayload` (throws if mode unavailable)
  - `buildPlaybookSharePayload(setup: PlaybookSetup, trades: Trade[], options: PlaybookShareOptions, initialBalance: number | null): PlaybookSharePayload`
  - `formatShareResult(result: ShareResult): string`
  - `generateShareToken(): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import type { Trade } from './tradeQueries';
import type { PlaybookSetup } from './playbookQueries';
import {
    availablePlaybookResultModes,
    availableTradeResultModes,
    buildPlaybookSharePayload,
    buildTradeSharePayload,
    defaultResultMode,
    formatShareResult,
    generateShareToken,
    MAX_NOTES_LENGTH,
    MAX_RULES,
    MAX_TEXT_LENGTH,
    tradePoints,
} from './sharePayload';

function trade(overrides: Partial<Trade> = {}): Trade {
    return {
        id: 'trade-uuid',
        user_id: 'user-uuid',
        account_id: 'account-uuid',
        trade_id: 'tradovate-id',
        symbol: 'MNQZ6',
        pnl: 250,
        buy_price: 20000,
        sell_price: 20012.5,
        quantity: 2,
        entry_time: '2026-10-01T13:30:00Z',
        exit_time: '2026-10-01T13:45:00Z',
        duration: '15m',
        setup_type: 'Silver Bullet',
        rating: 4,
        notes: 'Waited for the sweep.',
        screenshot_url: 'https://abc.supabase.co/storage/v1/object/public/trade-screenshots/u/t/1.png',
        ...overrides,
    };
}

const opts = { resultMode: 'points' as const, includeScreenshot: false, includeNotes: false };

describe('tradePoints', () => {
    it('is sell minus buy, rounded to 2 decimals', () => {
        expect(tradePoints(trade({ buy_price: 5000.1, sell_price: 5001.25 }))).toBe(1.15);
    });

    it('is null when a price is missing or stored as 0 by the importer', () => {
        expect(tradePoints(trade({ buy_price: null }))).toBeNull();
        expect(tradePoints(trade({ sell_price: 0 }))).toBeNull();
    });
});

describe('result modes', () => {
    it('offers points, usd and percent when everything is known', () => {
        expect(availableTradeResultModes(trade(), 50000)).toEqual(['points', 'usd', 'percent']);
    });

    it('drops points without prices and percent without a balance', () => {
        expect(availableTradeResultModes(trade({ buy_price: 0 }), 0)).toEqual(['usd']);
        expect(availablePlaybookResultModes(null)).toEqual(['points', 'usd']);
    });

    it('defaults to points, then percent, then usd', () => {
        expect(defaultResultMode(['points', 'usd', 'percent'])).toBe('points');
        expect(defaultResultMode(['usd', 'percent'])).toBe('percent');
        expect(defaultResultMode(['usd'])).toBe('usd');
    });
});

describe('buildTradeSharePayload', () => {
    it('builds a long trade card with only the chosen result', () => {
        const p = buildTradeSharePayload(trade(), opts, 50000);
        expect(p).toEqual({
            v: 1,
            symbol: 'MNQZ6',
            side: 'long',
            entryPrice: 20000,
            exitPrice: 20012.5,
            entryTime: '2026-10-01T13:30:00Z',
            duration: '15m',
            setupName: 'Silver Bullet',
            rating: 4,
            result: { mode: 'points', value: 12.5 },
        });
    });

    it('detects a short (bought after sold) and orders entry/exit accordingly', () => {
        const p = buildTradeSharePayload(
            trade({ entry_time: '2026-10-01T14:00:00Z', exit_time: '2026-10-01T13:40:00Z' }),
            opts,
            null
        );
        expect(p.side).toBe('short');
        expect(p.entryPrice).toBe(20012.5);
        expect(p.exitPrice).toBe(20000);
        expect(p.entryTime).toBe('2026-10-01T13:40:00Z');
    });

    it('computes usd and percent values', () => {
        expect(buildTradeSharePayload(trade(), { ...opts, resultMode: 'usd' }, null).result)
            .toEqual({ mode: 'usd', value: 250 });
        expect(buildTradeSharePayload(trade(), { ...opts, resultMode: 'percent' }, 50000).result)
            .toEqual({ mode: 'percent', value: 0.5 });
    });

    it('throws when the chosen mode is unavailable', () => {
        expect(() => buildTradeSharePayload(trade(), { ...opts, resultMode: 'percent' }, 0)).toThrow();
        expect(() => buildTradeSharePayload(trade({ buy_price: 0 }), opts, null)).toThrow();
    });

    it('never includes ids, account data, or $ when another mode is chosen', () => {
        const json = JSON.stringify(buildTradeSharePayload(trade(), opts, 50000));
        for (const secret of ['trade-uuid', 'user-uuid', 'account-uuid', 'tradovate-id', '250', '"pnl"']) {
            expect(json).not.toContain(secret);
        }
    });

    it('includes screenshot and notes only when toggled on', () => {
        const off = buildTradeSharePayload(trade(), opts, null);
        expect(off).not.toHaveProperty('screenshotUrl');
        expect(off).not.toHaveProperty('notes');

        const on = buildTradeSharePayload(trade(), { ...opts, includeScreenshot: true, includeNotes: true }, null);
        expect(on.screenshotUrl).toBe(trade().screenshot_url);
        expect(on.notes).toBe('Waited for the sweep.');
    });

    it('omits absent or whitespace-only notes even when toggled on, and caps length', () => {
        const on = { ...opts, includeScreenshot: true, includeNotes: true };
        expect(buildTradeSharePayload(trade({ notes: undefined, screenshot_url: undefined }), on, null))
            .not.toHaveProperty('notes');
        expect(buildTradeSharePayload(trade({ notes: '   ' }), on, null)).not.toHaveProperty('notes');
        expect(buildTradeSharePayload(trade({ notes: 'x'.repeat(2000) }), on, null).notes)
            .toHaveLength(MAX_NOTES_LENGTH);
    });

    it('maps missing optional fields to null', () => {
        const p = buildTradeSharePayload(
            trade({ duration: undefined, setup_type: null, rating: undefined, entry_time: null }),
            opts,
            null
        );
        expect(p.duration).toBeNull();
        expect(p.setupName).toBeNull();
        expect(p.rating).toBeNull();
        expect(p.entryTime).toBeNull();
        expect(p.side).toBe('long');
    });
});

describe('buildPlaybookSharePayload', () => {
    const setup: PlaybookSetup = {
        id: 'setup-uuid',
        user_id: 'user-uuid',
        name: 'Silver Bullet',
        description: '10-11am FVG entry',
        timeframe: '1m',
        win_rate_target: 60,
        screenshot_url: null,
        rules: ['Sweep liquidity', 'FVG forms', 'Enter on retrace'],
        created_at: '',
        updated_at: '',
    };
    const trades = [
        trade({ pnl: 100, buy_price: 100, sell_price: 110 }),
        trade({ pnl: -50, buy_price: 100, sell_price: 95 }),
        trade({ pnl: 200, buy_price: 0, sell_price: 0 }),
        trade({ setup_type: 'Other', pnl: 999 }),
    ];

    it('computes stats from trades whose setup_type matches the setup name', () => {
        const p = buildPlaybookSharePayload(setup, trades, { resultMode: 'usd', includeScreenshot: false }, null);
        expect(p.stats).toEqual({ tradeCount: 3, winRate: 66.67, avgResult: { mode: 'usd', value: 83.33 } });
        expect(p).toMatchObject({
            v: 1,
            name: 'Silver Bullet',
            timeframe: '1m',
            description: '10-11am FVG entry',
            rules: ['Sweep liquidity', 'FVG forms', 'Enter on retrace'],
            winRateTarget: 60,
        });
        expect(JSON.stringify(p)).not.toContain('setup-uuid');
    });

    it('averages points over priced trades only, and percent over the balance', () => {
        expect(buildPlaybookSharePayload(setup, trades, { resultMode: 'points', includeScreenshot: false }, null)
            .stats.avgResult).toEqual({ mode: 'points', value: 2.5 });
        expect(buildPlaybookSharePayload(setup, trades, { resultMode: 'percent', includeScreenshot: false }, 10000)
            .stats.avgResult).toEqual({ mode: 'percent', value: 0.83 });
    });

    it('handles zero matching trades', () => {
        const p = buildPlaybookSharePayload(setup, [], { resultMode: 'usd', includeScreenshot: false }, null);
        expect(p.stats).toEqual({ tradeCount: 0, winRate: 0, avgResult: null });
    });

    it('caps rules and long text', () => {
        const big = { ...setup, description: 'd'.repeat(2000), rules: Array.from({ length: 20 }, () => 'r'.repeat(500)) };
        const p = buildPlaybookSharePayload(big, [], { resultMode: 'usd', includeScreenshot: false }, null);
        expect(p.rules).toHaveLength(MAX_RULES);
        expect(p.rules[0]).toHaveLength(MAX_TEXT_LENGTH);
        expect(p.description).toHaveLength(MAX_TEXT_LENGTH);
    });

    it('drops blank rules and maps a blank timeframe to null', () => {
        const messy = { ...setup, timeframe: '  ', rules: ['', '  Sweep  ', '   '] };
        const p = buildPlaybookSharePayload(messy, [], { resultMode: 'usd', includeScreenshot: false }, null);
        expect(p.rules).toEqual(['Sweep']);
        expect(p.timeframe).toBeNull();
    });

    it('includes the example screenshot only when toggled on', () => {
        const withShot = { ...setup, screenshot_url: 'https://abc.supabase.co/x.png' };
        expect(buildPlaybookSharePayload(withShot, [], { resultMode: 'usd', includeScreenshot: false }, null))
            .not.toHaveProperty('screenshotUrl');
        expect(buildPlaybookSharePayload(withShot, [], { resultMode: 'usd', includeScreenshot: true }, null).screenshotUrl)
            .toBe('https://abc.supabase.co/x.png');
    });
});

describe('formatShareResult', () => {
    it('formats each mode with a sign', () => {
        expect(formatShareResult({ mode: 'points', value: 12.5 })).toBe('+12.50 pts');
        expect(formatShareResult({ mode: 'usd', value: -1234.5 })).toBe('-$1,234.50');
        expect(formatShareResult({ mode: 'percent', value: 0.5 })).toBe('+0.50%');
        expect(formatShareResult({ mode: 'usd', value: 0 })).toBe('$0.00');
    });
});

describe('generateShareToken', () => {
    it('is 22 url-safe characters and unique', () => {
        const a = generateShareToken();
        expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
        expect(generateShareToken()).not.toBe(a);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/sharePayload.test.ts`
Expected: FAIL — cannot resolve `./sharePayload`.

- [ ] **Step 3: Implement `src/lib/sharePayload.ts`**

```ts
import type { Trade } from './tradeQueries';
import type { PlaybookSetup } from './playbookQueries';

// ============================================
// Types
// ============================================

export type ShareKind = 'trade' | 'playbook';
export type ResultMode = 'points' | 'usd' | 'percent';

export interface ShareResult {
    mode: ResultMode;
    value: number;
}

export interface TradeSharePayload {
    v: 1;
    symbol: string;
    side: 'long' | 'short';
    entryPrice: number | null;
    exitPrice: number | null;
    entryTime: string | null;
    duration: string | null;
    setupName: string | null;
    rating: number | null;
    result: ShareResult;
    screenshotUrl?: string;
    notes?: string;
}

export interface PlaybookSharePayload {
    v: 1;
    name: string;
    timeframe: string | null;
    description: string | null;
    rules: string[];
    winRateTarget: number;
    stats: { tradeCount: number; winRate: number; avgResult: ShareResult | null };
    screenshotUrl?: string;
}

export type SharedCard =
    | { kind: 'trade'; payload: TradeSharePayload }
    | { kind: 'playbook'; payload: PlaybookSharePayload };

export interface TradeShareOptions {
    resultMode: ResultMode;
    includeScreenshot: boolean;
    includeNotes: boolean;
}

export interface PlaybookShareOptions {
    resultMode: ResultMode;
    includeScreenshot: boolean;
}

export const MAX_NOTES_LENGTH = 500;
export const MAX_RULES = 6;
export const MAX_TEXT_LENGTH = 200;

// ============================================
// Helpers
// ============================================

const round2 = (n: number) => Math.round(n * 100) / 100;

const truncate = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text;

// The Tradovate importer stores unparseable prices as 0, so treat <= 0 as missing.
function price(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function percentOf(pnl: number, initialBalance: number | null): number | null {
    return initialBalance && initialBalance > 0 ? round2((pnl / initialBalance) * 100) : null;
}

/** Price points gained per contract: sell − buy, for longs and shorts alike. */
export function tradePoints(trade: Trade): number | null {
    const buy = price(trade.buy_price);
    const sell = price(trade.sell_price);
    return buy === null || sell === null ? null : round2(sell - buy);
}

// The importer always stores entry_time = bought time and exit_time = sold
// time, so a short is a trade that was sold before it was bought.
function isShort(trade: Trade): boolean {
    if (!trade.entry_time || !trade.exit_time) return false;
    return new Date(trade.entry_time).getTime() > new Date(trade.exit_time).getTime();
}

// ============================================
// Result modes
// ============================================

export function availableTradeResultModes(trade: Trade, initialBalance: number | null): ResultMode[] {
    const modes: ResultMode[] = [];
    if (tradePoints(trade) !== null) modes.push('points');
    modes.push('usd');
    if (initialBalance && initialBalance > 0) modes.push('percent');
    return modes;
}

export function availablePlaybookResultModes(initialBalance: number | null): ResultMode[] {
    const modes: ResultMode[] = ['points', 'usd'];
    if (initialBalance && initialBalance > 0) modes.push('percent');
    return modes;
}

/** Prefer modes that hide account size: points, then percent, then usd. */
export function defaultResultMode(modes: ResultMode[]): ResultMode {
    if (modes.includes('points')) return 'points';
    if (modes.includes('percent')) return 'percent';
    return 'usd';
}

// ============================================
// Builders
// ============================================

export function buildTradeSharePayload(
    trade: Trade,
    options: TradeShareOptions,
    initialBalance: number | null
): TradeSharePayload {
    const value =
        options.resultMode === 'points'
            ? tradePoints(trade)
            : options.resultMode === 'usd'
                ? round2(trade.pnl)
                : percentOf(trade.pnl, initialBalance);

    if (value === null) {
        throw new Error(`Result mode "${options.resultMode}" is not available for this trade`);
    }

    const short = isShort(trade);
    const buy = price(trade.buy_price);
    const sell = price(trade.sell_price);

    const payload: TradeSharePayload = {
        v: 1,
        symbol: trade.symbol,
        side: short ? 'short' : 'long',
        entryPrice: short ? sell : buy,
        exitPrice: short ? buy : sell,
        entryTime: (short ? trade.exit_time : trade.entry_time) || null,
        duration: trade.duration?.trim() || null,
        setupName: trade.setup_type?.trim() ? truncate(trade.setup_type.trim(), MAX_TEXT_LENGTH) : null,
        rating: trade.rating ?? null,
        result: { mode: options.resultMode, value },
    };

    if (options.includeScreenshot && trade.screenshot_url) {
        payload.screenshotUrl = trade.screenshot_url;
    }

    const notes = trade.notes?.trim();
    if (options.includeNotes && notes) {
        payload.notes = truncate(notes, MAX_NOTES_LENGTH);
    }

    return payload;
}

function averageResult(
    trades: Trade[],
    mode: ResultMode,
    initialBalance: number | null
): ShareResult | null {
    if (mode === 'points') {
        const points = trades.map(tradePoints).filter((p): p is number => p !== null);
        if (points.length === 0) return null;
        return { mode, value: round2(points.reduce((a, b) => a + b, 0) / points.length) };
    }

    if (trades.length === 0) return null;
    const avgPnl = trades.reduce((sum, t) => sum + t.pnl, 0) / trades.length;

    if (mode === 'usd') return { mode, value: round2(avgPnl) };

    const percent = percentOf(avgPnl, initialBalance);
    return percent === null ? null : { mode, value: percent };
}

export function buildPlaybookSharePayload(
    setup: PlaybookSetup,
    trades: Trade[],
    options: PlaybookShareOptions,
    initialBalance: number | null
): PlaybookSharePayload {
    const matched = trades.filter(t => t.setup_type === setup.name);
    const wins = matched.filter(t => t.pnl > 0).length;
    const description = setup.description?.trim();

    const payload: PlaybookSharePayload = {
        v: 1,
        name: truncate(setup.name, MAX_TEXT_LENGTH),
        timeframe: setup.timeframe?.trim() || null,
        description: description ? truncate(description, MAX_TEXT_LENGTH) : null,
        // The playbook form allows blank rule rows; drop them (the validator rejects empty strings).
        rules: setup.rules
            .map(rule => rule.trim())
            .filter(Boolean)
            .slice(0, MAX_RULES)
            .map(rule => truncate(rule, MAX_TEXT_LENGTH)),
        winRateTarget: setup.win_rate_target,
        stats: {
            tradeCount: matched.length,
            winRate: matched.length ? round2((wins / matched.length) * 100) : 0,
            avgResult: averageResult(matched, options.resultMode, initialBalance),
        },
    };

    if (options.includeScreenshot && setup.screenshot_url) {
        payload.screenshotUrl = setup.screenshot_url;
    }

    return payload;
}

// ============================================
// Formatting & tokens
// ============================================

export function formatShareResult(result: ShareResult): string {
    const sign = result.value > 0 ? '+' : result.value < 0 ? '-' : '';
    const abs = Math.abs(result.value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    if (result.mode === 'usd') return `${sign}$${abs}`;
    if (result.mode === 'percent') return `${sign}${abs}%`;
    return `${sign}${abs} pts`;
}

/** 128 random bits, base64url-encoded (22 chars). */
export function generateShareToken(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/sharePayload.test.ts`
Expected: PASS (all tests). Note the expected averages: usd `(100 − 50 + 200) / 3 = 83.33`; points over the two priced trades `(10 + −5) / 2 = 2.5`; percent `83.33 / 10000 × 100 = 0.83`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sharePayload.ts src/lib/sharePayload.test.ts
git commit -m "feat(share): add privacy-filtered share payload builders"
```

---

### Task 3: Payload validation

**Files:**
- Create: `src/lib/shareValidation.ts`
- Test: `src/lib/shareValidation.test.ts`

**Interfaces:**
- Consumes: types and `MAX_*` consts from `src/lib/sharePayload.ts`.
- Produces:
  - `MAX_PAYLOAD_BYTES = 16 * 1024`
  - `type ValidationResult = { ok: true; card: SharedCard } | { ok: false; error: string }`
  - `validateSharedCard(input: unknown, allowedImageHost: string): ValidationResult` — returns a **rebuilt** card containing only known keys.
  - `supabaseImageHost(): string` — host of `NEXT_PUBLIC_SUPABASE_URL`, or `''`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { validateSharedCard } from './shareValidation';

const HOST = 'abc.supabase.co';

const tradeCard = {
    kind: 'trade',
    payload: {
        v: 1,
        symbol: 'MNQZ6',
        side: 'long',
        entryPrice: 20000,
        exitPrice: 20012.5,
        entryTime: '2026-10-01T13:30:00Z',
        duration: '15m',
        setupName: null,
        rating: null,
        result: { mode: 'points', value: 12.5 },
    },
};

const playbookCard = {
    kind: 'playbook',
    payload: {
        v: 1,
        name: 'Silver Bullet',
        timeframe: null,
        description: null,
        rules: ['Sweep liquidity'],
        winRateTarget: 60,
        stats: { tradeCount: 0, winRate: 0, avgResult: null },
    },
};

describe('validateSharedCard', () => {
    it('accepts valid trade and playbook cards', () => {
        expect(validateSharedCard(tradeCard, HOST)).toEqual({ ok: true, card: tradeCard });
        expect(validateSharedCard(playbookCard, HOST)).toEqual({ ok: true, card: playbookCard });
    });

    it('strips unknown keys', () => {
        const result = validateSharedCard(
            { ...tradeCard, extra: 1, payload: { ...tradeCard.payload, pnl: 999, userId: 'x' } },
            HOST
        );
        expect(result).toEqual({ ok: true, card: tradeCard });
    });

    it('rejects non-objects, unknown kinds and wrong versions', () => {
        expect(validateSharedCard(null, HOST).ok).toBe(false);
        expect(validateSharedCard({ kind: 'recap', payload: {} }, HOST).ok).toBe(false);
        expect(validateSharedCard({ ...tradeCard, payload: { ...tradeCard.payload, v: 2 } }, HOST).ok).toBe(false);
    });

    it('rejects wrong field types', () => {
        const bad = [
            { ...tradeCard.payload, symbol: '' },
            { ...tradeCard.payload, side: 'up' },
            { ...tradeCard.payload, entryPrice: '20000' },
            { ...tradeCard.payload, result: { mode: 'btc', value: 1 } },
            { ...tradeCard.payload, result: { mode: 'usd', value: Infinity } },
        ];
        for (const payload of bad) {
            expect(validateSharedCard({ kind: 'trade', payload }, HOST).ok).toBe(false);
        }
        expect(validateSharedCard(
            { kind: 'playbook', payload: { ...playbookCard.payload, rules: Array(7).fill('r') } },
            HOST
        ).ok).toBe(false);
    });

    it('rejects oversized payloads', () => {
        const payload = { ...tradeCard.payload, notes: 'x'.repeat(17 * 1024) };
        const result = validateSharedCard({ kind: 'trade', payload }, HOST);
        expect(result.ok).toBe(false);
    });

    it('only accepts screenshots hosted on the Supabase host', () => {
        const withShot = (url: string) => ({ kind: 'trade', payload: { ...tradeCard.payload, screenshotUrl: url } });
        expect(validateSharedCard(withShot(`https://${HOST}/storage/v1/object/public/a.png`), HOST).ok).toBe(true);
        expect(validateSharedCard(withShot('https://evil.example.com/a.png'), HOST).ok).toBe(false);
        expect(validateSharedCard(withShot('http://169.254.169.254/latest'), HOST).ok).toBe(false);
        expect(validateSharedCard(withShot('not a url'), HOST).ok).toBe(false);
        expect(validateSharedCard(withShot(`https://${HOST}/a.png`), '').ok).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/shareValidation.test.ts`
Expected: FAIL — cannot resolve `./shareValidation`.

- [ ] **Step 3: Implement `src/lib/shareValidation.ts`**

```ts
import {
    MAX_NOTES_LENGTH,
    MAX_RULES,
    MAX_TEXT_LENGTH,
    PlaybookSharePayload,
    ResultMode,
    ShareResult,
    SharedCard,
    TradeSharePayload,
} from './sharePayload';

export const MAX_PAYLOAD_BYTES = 16 * 1024;

export type ValidationResult = { ok: true; card: SharedCard } | { ok: false; error: string };

type Obj = Record<string, unknown>;

class InvalidPayload extends Error {}

const RESULT_MODES: ResultMode[] = ['points', 'usd', 'percent'];

function fail(message: string): never {
    throw new InvalidPayload(message);
}

function obj(value: unknown, field: string): Obj {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${field} must be an object`);
    return value as Obj;
}

function str(value: unknown, field: string, max: number): string {
    if (typeof value !== 'string' || value.length === 0 || value.length > max) fail(`${field} is invalid`);
    return value;
}

function strOrNull(value: unknown, field: string, max: number): string | null {
    return value === null ? null : str(value, field, max);
}

function num(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${field} must be a finite number`);
    return value;
}

function numOrNull(value: unknown, field: string): number | null {
    return value === null ? null : num(value, field);
}

function result(value: unknown, field: string): ShareResult {
    const o = obj(value, field);
    if (!RESULT_MODES.includes(o.mode as ResultMode)) fail(`${field}.mode is invalid`);
    return { mode: o.mode as ResultMode, value: num(o.value, `${field}.value`) };
}

function screenshot(value: unknown, allowedImageHost: string): string | undefined {
    if (value === undefined) return undefined;
    const url = str(value, 'screenshotUrl', 2048);
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        fail('screenshotUrl is not a URL');
    }
    if (!allowedImageHost || parsed.protocol !== 'https:' || parsed.host !== allowedImageHost) {
        fail('screenshotUrl must be hosted on this app\'s storage');
    }
    return url;
}

function tradePayload(p: Obj, host: string): TradeSharePayload {
    if (p.side !== 'long' && p.side !== 'short') fail('side is invalid');
    const payload: TradeSharePayload = {
        v: 1,
        symbol: str(p.symbol, 'symbol', 40),
        side: p.side,
        entryPrice: numOrNull(p.entryPrice, 'entryPrice'),
        exitPrice: numOrNull(p.exitPrice, 'exitPrice'),
        entryTime: strOrNull(p.entryTime, 'entryTime', 64),
        duration: strOrNull(p.duration, 'duration', 64),
        setupName: strOrNull(p.setupName, 'setupName', MAX_TEXT_LENGTH),
        rating: numOrNull(p.rating, 'rating'),
        result: result(p.result, 'result'),
    };
    const shot = screenshot(p.screenshotUrl, host);
    if (shot) payload.screenshotUrl = shot;
    if (p.notes !== undefined) payload.notes = str(p.notes, 'notes', MAX_NOTES_LENGTH);
    return payload;
}

function playbookPayload(p: Obj, host: string): PlaybookSharePayload {
    if (!Array.isArray(p.rules) || p.rules.length > MAX_RULES) fail('rules is invalid');
    const stats = obj(p.stats, 'stats');
    const payload: PlaybookSharePayload = {
        v: 1,
        name: str(p.name, 'name', MAX_TEXT_LENGTH),
        timeframe: strOrNull(p.timeframe, 'timeframe', 64),
        description: strOrNull(p.description, 'description', MAX_TEXT_LENGTH),
        rules: p.rules.map((rule, i) => str(rule, `rules[${i}]`, MAX_TEXT_LENGTH)),
        winRateTarget: num(p.winRateTarget, 'winRateTarget'),
        stats: {
            tradeCount: num(stats.tradeCount, 'stats.tradeCount'),
            winRate: num(stats.winRate, 'stats.winRate'),
            avgResult: stats.avgResult === null ? null : result(stats.avgResult, 'stats.avgResult'),
        },
    };
    const shot = screenshot(p.screenshotUrl, host);
    if (shot) payload.screenshotUrl = shot;
    return payload;
}

/**
 * Validate an untrusted share card and rebuild it with only known keys.
 * Used before storing a share, by the image API, and on every public read.
 */
export function validateSharedCard(input: unknown, allowedImageHost: string): ValidationResult {
    try {
        const card = obj(input, 'card');
        const payload = obj(card.payload, 'payload');

        if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_PAYLOAD_BYTES) {
            fail('payload is too large');
        }
        if (payload.v !== 1) fail('unsupported payload version');

        if (card.kind === 'trade') {
            return { ok: true, card: { kind: 'trade', payload: tradePayload(payload, allowedImageHost) } };
        }
        if (card.kind === 'playbook') {
            return { ok: true, card: { kind: 'playbook', payload: playbookPayload(payload, allowedImageHost) } };
        }
        fail('kind is invalid');
    } catch (error) {
        if (error instanceof InvalidPayload) return { ok: false, error: error.message };
        throw error;
    }
}

/** Host of the project's Supabase URL — the only host screenshots may come from. */
export function supabaseImageHost(): string {
    try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host;
    } catch {
        return '';
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/shareValidation.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shareValidation.ts src/lib/shareValidation.test.ts
git commit -m "feat(share): validate untrusted share payloads"
```

---

### Task 4: Share queries

**Files:**
- Create: `src/lib/shareQueries.ts`
- Test: `src/lib/shareQueries.test.ts`

**Interfaces:**
- Consumes: `generateShareToken`, `SharedCard`, `ShareKind` (Task 2); `validateSharedCard`, `supabaseImageHost` (Task 3); `getSupabase` from `./supabase`.
- Produces:
  - `interface ShareLink { id: string; token: string; kind: ShareKind; source_id: string; created_at: string; revoked_at: string | null }`
  - `createShare(userId: string, sourceId: string, card: SharedCard, client?: SupabaseClient): Promise<ShareLink>`
  - `listSharesForSource(kind: ShareKind, sourceId: string, client?): Promise<ShareLink[]>`
  - `revokeShare(shareId: string, client?): Promise<void>`
  - `fetchSharedCard(token: string, client?): Promise<SharedCard | null>`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('./supabase', () => ({ getSupabase: () => { throw new Error('use the injected client'); } }));
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');

const { createShare, fetchSharedCard } = await import('./shareQueries');

const card = {
    kind: 'playbook' as const,
    payload: {
        v: 1 as const,
        name: 'Silver Bullet',
        timeframe: null,
        description: null,
        rules: [],
        winRateTarget: 60,
        stats: { tradeCount: 0, winRate: 0, avgResult: null },
    },
};

function insertClient(errors: ({ code: string; message: string } | null)[]) {
    const inserted: Record<string, unknown>[] = [];
    const client = {
        from: () => ({
            insert: (row: Record<string, unknown>) => {
                inserted.push(row);
                const error = errors[inserted.length - 1] ?? null;
                return {
                    select: () => ({
                        single: async () => ({ data: error ? null : { id: 's1', ...row }, error }),
                    }),
                };
            },
        }),
    } as unknown as SupabaseClient;
    return { client, inserted };
}

function rpcClient(data: unknown) {
    return { rpc: async () => ({ data, error: null }) } as unknown as SupabaseClient;
}

describe('createShare', () => {
    it('stores the card under a fresh token', async () => {
        const { client, inserted } = insertClient([null]);
        const link = await createShare('user-1', 'setup-1', card, client);
        expect(inserted[0]).toMatchObject({ user_id: 'user-1', kind: 'playbook', source_id: 'setup-1', payload: card.payload });
        expect(link.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    });

    it('retries once with a new token on a unique violation', async () => {
        const { client, inserted } = insertClient([{ code: '23505', message: 'dup' }, null]);
        await createShare('user-1', 'setup-1', card, client);
        expect(inserted).toHaveLength(2);
        expect(inserted[0].token).not.toBe(inserted[1].token);
    });

    it('throws other errors without retrying', async () => {
        const { client, inserted } = insertClient([{ code: '42501', message: 'rls' }]);
        await expect(createShare('user-1', 'setup-1', card, client)).rejects.toMatchObject({ code: '42501' });
        expect(inserted).toHaveLength(1);
    });

    it('refuses an invalid card before touching the database', async () => {
        const { client, inserted } = insertClient([null]);
        const bad = { ...card, payload: { ...card.payload, screenshotUrl: 'https://evil.example.com/x.png' } };
        await expect(createShare('user-1', 'setup-1', bad, client)).rejects.toThrow();
        expect(inserted).toHaveLength(0);
    });
});

describe('fetchSharedCard', () => {
    it('returns null for unknown or revoked tokens', async () => {
        expect(await fetchSharedCard('nope', rpcClient(null))).toBeNull();
    });

    it('returns the validated card', async () => {
        const data = { kind: 'playbook', payload: card.payload, created_at: '2026-10-05T00:00:00Z' };
        expect(await fetchSharedCard('tok', rpcClient(data))).toEqual(card);
    });

    it('treats a tampered stored payload as unavailable', async () => {
        const data = {
            kind: 'playbook',
            payload: { ...card.payload, screenshotUrl: 'http://169.254.169.254/latest' },
            created_at: '2026-10-05T00:00:00Z',
        };
        expect(await fetchSharedCard('tok', rpcClient(data))).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/shareQueries.test.ts`
Expected: FAIL — cannot resolve `./shareQueries`.

- [ ] **Step 3: Implement `src/lib/shareQueries.ts`**

```ts
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { generateShareToken, SharedCard, ShareKind } from './sharePayload';
import { supabaseImageHost, validateSharedCard } from './shareValidation';

export interface ShareLink {
    id: string;
    token: string;
    kind: ShareKind;
    source_id: string;
    created_at: string;
    revoked_at: string | null;
}

const LINK_COLUMNS = 'id, token, kind, source_id, created_at, revoked_at';
const UNIQUE_VIOLATION = '23505';

/**
 * Store a share snapshot under a new random token. Retries once on the
 * (astronomically unlikely) token collision.
 */
export async function createShare(
    userId: string,
    sourceId: string,
    card: SharedCard,
    client: SupabaseClient = getSupabase()
): Promise<ShareLink> {
    const validated = validateSharedCard(card, supabaseImageHost());
    if (!validated.ok) {
        throw new Error(`Cannot share: ${validated.error}`);
    }

    for (let attempt = 0; ; attempt++) {
        const { data, error } = await client
            .from('shares')
            .insert({
                token: generateShareToken(),
                user_id: userId,
                kind: validated.card.kind,
                source_id: sourceId,
                payload: validated.card.payload,
            })
            .select(LINK_COLUMNS)
            .single();

        if (!error) return data as ShareLink;
        if (error.code !== UNIQUE_VIOLATION || attempt >= 1) {
            console.error('Error creating share:', error);
            throw error;
        }
    }
}

/** Active (non-revoked) links for one trade or setup, newest first. */
export async function listSharesForSource(
    kind: ShareKind,
    sourceId: string,
    client: SupabaseClient = getSupabase()
): Promise<ShareLink[]> {
    const { data, error } = await client
        .from('shares')
        .select(LINK_COLUMNS)
        .eq('kind', kind)
        .eq('source_id', sourceId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error listing shares:', error);
        throw error;
    }

    return data as ShareLink[];
}

export async function revokeShare(
    shareId: string,
    client: SupabaseClient = getSupabase()
): Promise<void> {
    const { error } = await client
        .from('shares')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', shareId);

    if (error) {
        console.error('Error revoking share:', error);
        throw error;
    }
}

/**
 * Public read by token via the get_share RPC. Returns null for unknown,
 * revoked, or invalid (tampered) snapshots.
 */
export async function fetchSharedCard(
    token: string,
    client: SupabaseClient = getSupabase()
): Promise<SharedCard | null> {
    const { data, error } = await client.rpc('get_share', { p_token: token });

    if (error) {
        console.error('Error fetching shared card:', error);
        throw error;
    }
    if (!data) return null;

    const validated = validateSharedCard(data, supabaseImageHost());
    return validated.ok ? validated.card : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/shareQueries.test.ts && npm run typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shareQueries.ts src/lib/shareQueries.test.ts
git commit -m "feat(share): add share link queries"
```

---

### Task 5: Card component and image API

**Files:**
- Create: `src/components/share/ShareCard.tsx`
- Create: `src/components/share/renderShareImage.tsx`
- Create: `src/app/api/share/image/route.ts`

**Interfaces:**
- Consumes: `SharedCard`, `TradeSharePayload`, `PlaybookSharePayload`, `formatShareResult` (Task 2); `validateSharedCard`, `supabaseImageHost` (Task 3).
- Produces:
  - `SHARE_CARD_WIDTH = 1200`, `SHARE_CARD_HEIGHT = 630`
  - `ShareCard({ card }: { card: SharedCard | null })` — `null` renders the "Link unavailable" card
  - `renderShareImage(card: SharedCard | null): Promise<ImageResponse>`
  - `POST /api/share/image` — body `SharedCard` JSON → `image/png`, or `400 {error}`

- [ ] **Step 1: Implement `src/components/share/ShareCard.tsx`**

```tsx
import type { CSSProperties, ReactNode } from 'react';
import {
    formatShareResult,
    PlaybookSharePayload,
    SharedCard,
    TradeSharePayload,
} from '@/lib/sharePayload';

// Rendered by next/og (Satori) and in the DOM for the dialog preview, so it
// must stick to inline styles and flexbox: every element with more than one
// child sets display: flex. Avoid emoji/★/✓ — the default OG font lacks them.

export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;

const colors = {
    bg: '#09090b',
    panel: '#18181b',
    border: '#27272a',
    text: '#fafafa',
    muted: '#a1a1aa',
    faint: '#71717a',
    win: '#34d399',
    loss: '#fb7185',
    accent: '#60a5fa',
};

const frame: CSSProperties = {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    background: colors.bg,
    color: colors.text,
    padding: 48,
    fontFamily: 'sans-serif',
    boxSizing: 'border-box',
};

function formatPrice(value: number | null): string {
    return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

// Futures traders read times in exchange time; show ET explicitly.
function formatEntryTime(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })} ET`;
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '33%', marginBottom: 20 }}>
            <div style={{ display: 'flex', fontSize: 16, color: colors.faint, textTransform: 'uppercase', letterSpacing: 1 }}>
                {label}
            </div>
            <div style={{ display: 'flex', fontSize: 26, color: colors.text, marginTop: 4 }}>{value}</div>
        </div>
    );
}

function Badge({ children, color }: { children: ReactNode; color: string }) {
    return (
        <div
            style={{
                display: 'flex',
                fontSize: 20,
                fontWeight: 700,
                color,
                border: `2px solid ${color}`,
                borderRadius: 8,
                padding: '4px 12px',
                marginLeft: 16,
            }}
        >
            {children}
        </div>
    );
}

function Footer() {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', fontSize: 18, color: colors.faint }}>
            <div style={{ display: 'flex' }}>My Trading Journal</div>
        </div>
    );
}

function Screenshot({ url }: { url: string }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={url}
            alt=""
            width={460}
            height={330}
            style={{ objectFit: 'cover', borderRadius: 12, border: `1px solid ${colors.border}`, marginLeft: 40 }}
        />
    );
}

function TradeCard({ p }: { p: TradeSharePayload }) {
    const resultColor = p.result.value >= 0 ? colors.win : colors.loss;
    return (
        <div style={frame}>
            <div style={{ display: 'flex', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>{p.symbol}</div>
                        <Badge color={p.side === 'long' ? colors.win : colors.loss}>
                            {p.side === 'long' ? 'LONG' : 'SHORT'}
                        </Badge>
                    </div>
                    <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, color: resultColor, margin: '16px 0 28px' }}>
                        {formatShareResult(p.result)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        <Stat label="Entry" value={formatPrice(p.entryPrice)} />
                        <Stat label="Exit" value={formatPrice(p.exitPrice)} />
                        <Stat label="Duration" value={p.duration ?? '—'} />
                        <Stat label="Opened" value={formatEntryTime(p.entryTime)} />
                        <Stat label="Setup" value={p.setupName ?? '—'} />
                        <Stat label="Rating" value={p.rating ? `${p.rating}/5` : '—'} />
                    </div>
                    {p.notes && (
                        <div style={{ display: 'flex', fontSize: 20, color: colors.muted, fontStyle: 'italic', maxHeight: 84, overflow: 'hidden' }}>
                            {`“${p.notes}”`}
                        </div>
                    )}
                </div>
                {p.screenshotUrl && <Screenshot url={p.screenshotUrl} />}
            </div>
            <Footer />
        </div>
    );
}

function PlaybookCard({ p }: { p: PlaybookSharePayload }) {
    const { stats } = p;
    return (
        <div style={frame}>
            <div style={{ display: 'flex', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', fontSize: 18, color: colors.accent, textTransform: 'uppercase', letterSpacing: 2 }}>
                        Playbook setup
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                        <div style={{ display: 'flex', fontSize: 48, fontWeight: 700 }}>{p.name}</div>
                        {p.timeframe && <Badge color={colors.accent}>{p.timeframe}</Badge>}
                    </div>
                    {p.description && (
                        <div style={{ display: 'flex', fontSize: 22, color: colors.muted, marginTop: 12 }}>{p.description}</div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20 }}>
                        {p.rules.map((rule, i) => (
                            <div key={i} style={{ display: 'flex', fontSize: 20, color: colors.text, marginBottom: 6 }}>
                                {`${i + 1}. ${rule}`}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', marginTop: 'auto', paddingTop: 16 }}>
                        <Stat label="Trades" value={String(stats.tradeCount)} />
                        <Stat label="Win rate" value={`${stats.winRate.toFixed(1)}% / ${p.winRateTarget}% target`} />
                        <Stat label="Avg result" value={stats.avgResult ? formatShareResult(stats.avgResult) : '—'} />
                    </div>
                </div>
                {p.screenshotUrl && <Screenshot url={p.screenshotUrl} />}
            </div>
            <Footer />
        </div>
    );
}

function UnavailableCard() {
    return (
        <div style={{ ...frame, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', fontSize: 48, fontWeight: 700 }}>Link unavailable</div>
            <div style={{ display: 'flex', fontSize: 24, color: colors.muted, marginTop: 12 }}>
                This shared card was removed or never existed.
            </div>
        </div>
    );
}

export function ShareCard({ card }: { card: SharedCard | null }) {
    if (!card) return <UnavailableCard />;
    return card.kind === 'trade' ? <TradeCard p={card.payload} /> : <PlaybookCard p={card.payload} />;
}
```

- [ ] **Step 2: Implement `src/components/share/renderShareImage.tsx`**

```tsx
import { ImageResponse } from 'next/og';
import type { SharedCard } from '@/lib/sharePayload';
import { ShareCard, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from './ShareCard';

const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

// Fetch the screenshot ourselves so a slow/broken image degrades to a card
// without it instead of failing the whole render.
async function toDataUrl(url: string): Promise<string | undefined> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok || !type.startsWith('image/')) return undefined;
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_SCREENSHOT_BYTES) return undefined;
        return `data:${type};base64,${buffer.toString('base64')}`;
    } catch {
        return undefined;
    }
}

/** Render a (validated) card — or the "unavailable" card for null — to PNG. */
export async function renderShareImage(card: SharedCard | null): Promise<ImageResponse> {
    let resolved = card;
    if (card?.payload.screenshotUrl) {
        const screenshotUrl = await toDataUrl(card.payload.screenshotUrl);
        resolved = card.kind === 'trade'
            ? { kind: 'trade', payload: { ...card.payload, screenshotUrl } }
            : { kind: 'playbook', payload: { ...card.payload, screenshotUrl } };
    }

    return new ImageResponse(<ShareCard card={resolved} />, {
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
    });
}
```

- [ ] **Step 3: Implement `src/app/api/share/image/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { renderShareImage } from '@/components/share/renderShareImage';
import { MAX_PAYLOAD_BYTES, supabaseImageHost, validateSharedCard } from '@/lib/shareValidation';

export const dynamic = 'force-dynamic';

/**
 * POST a share card ({ kind, payload }) and get the PNG back.
 * Stateless: no database access, so it powers Download / Copy image
 * without creating a public link.
 */
export async function POST(request: NextRequest) {
    const text = await request.text();
    if (text.length > MAX_PAYLOAD_BYTES * 2) {
        return NextResponse.json({ error: 'Payload is too large' }, { status: 400 });
    }

    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const result = validateSharedCard(body, supabaseImageHost());
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return renderShareImage(result.card);
}
```

- [ ] **Step 4: Verify typecheck, build, and a real render**

Run: `npm run typecheck && npm run build`
Expected: both succeed; build output lists `ƒ /api/share/image`.

Then start the dev server in the background (`npm run dev`) and run:

```bash
curl -s -o "$TMP/card.png" -w "%{http_code} %{content_type}\n" -X POST http://localhost:3000/api/share/image \
  -H "content-type: application/json" \
  -d '{"kind":"trade","payload":{"v":1,"symbol":"MNQZ6","side":"long","entryPrice":20000,"exitPrice":20012.5,"entryTime":"2026-10-01T13:30:00Z","duration":"15m","setupName":"Silver Bullet","rating":4,"result":{"mode":"points","value":12.5},"notes":"Waited for the sweep."}}'
curl -s -w " %{http_code}\n" -X POST http://localhost:3000/api/share/image -H "content-type: application/json" -d '{"kind":"trade","payload":{}}'
```

Expected: `200 image/png`, then `{"error":"..."} 400`. Open `$TMP/card.png` (Read tool) and confirm the card looks right: symbol, LONG badge, green `+12.50 pts`, six stats, notes, footer. Repeat with a playbook payload and check it too. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/components/share/ShareCard.tsx src/components/share/renderShareImage.tsx src/app/api/share/image/route.ts
git commit -m "feat(share): render share cards to PNG"
```

---

### Task 6: Public share page and OG image

**Files:**
- Create: `src/app/share/[token]/page.tsx`
- Create: `src/app/share/[token]/opengraph-image.tsx`
- Create: `src/app/share/[token]/not-found.tsx`

**Interfaces:**
- Consumes: `fetchSharedCard` (Task 4), `renderShareImage` (Task 5), `formatShareResult`, `SharedCard` (Task 2), `getSupabase`.
- Produces: public routes `/share/[token]` and `/share/[token]/opengraph-image`.

- [ ] **Step 1: Implement `src/app/share/[token]/opengraph-image.tsx`**

```tsx
import { getSupabase } from '@/lib/supabase';
import { fetchSharedCard } from '@/lib/shareQueries';
import { renderShareImage } from '@/components/share/renderShareImage';
import type { SharedCard } from '@/lib/sharePayload';

export const dynamic = 'force-dynamic';
export const alt = 'Shared trading card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    let card: SharedCard | null = null;
    try {
        card = await fetchSharedCard(token, getSupabase());
    } catch {
        // Unfurls must never show an error image — fall through to "unavailable".
    }
    return renderShareImage(card);
}
```

- [ ] **Step 2: Implement `src/app/share/[token]/not-found.tsx`**

```tsx
import Link from 'next/link';

export default function ShareNotFound() {
    return (
        <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <h1 className="text-2xl font-bold text-white">This link is no longer available</h1>
            <p className="text-zinc-400 text-sm">The owner may have revoked it, or the address is wrong.</p>
            <Link href="/" className="text-blue-400 text-sm hover:underline">Go to My Trading Journal</Link>
        </main>
    );
}
```

- [ ] **Step 3: Implement `src/app/share/[token]/page.tsx`**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { fetchSharedCard } from '@/lib/shareQueries';
import { formatShareResult, SharedCard } from '@/lib/sharePayload';

// Public page: deliberately outside DashboardLayout (which gates on login).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

async function loadCard(token: string): Promise<SharedCard | null> {
    try {
        return await fetchSharedCard(token, getSupabase());
    } catch {
        return null;
    }
}

function cardTitle(card: SharedCard): string {
    if (card.kind === 'trade') {
        const p = card.payload;
        return `${p.symbol} ${p.side} · ${formatShareResult(p.result)}`;
    }
    return `${card.payload.name} · Playbook setup`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { token } = await params;
    const card = await loadCard(token);
    if (!card) return { title: 'Link unavailable' };

    // Absolute OG image URLs need a base; derive it from the request.
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const title = cardTitle(card);
    const description = 'Shared from My Trading Journal';

    return {
        metadataBase: host ? new URL(`${proto}://${host}`) : undefined,
        title,
        description,
        openGraph: { title, description },
        twitter: { card: 'summary_large_image', title, description },
    };
}

export default async function SharePage({ params }: Props) {
    const { token } = await params;
    const card = await loadCard(token);
    if (!card) notFound();

    return (
        <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-6 px-4 py-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`/share/${encodeURIComponent(token)}/opengraph-image`}
                alt={cardTitle(card)}
                width={1200}
                height={630}
                className="w-full max-w-3xl h-auto rounded-xl border border-zinc-800"
            />
            <p className="text-xs text-zinc-500">
                Shared from{' '}
                <Link href="/" className="text-zinc-300 hover:underline">My Trading Journal</Link>
            </p>
        </main>
    );
}
```

- [ ] **Step 4: Verify build and unknown-token behavior**

Run: `npm run typecheck && npm run build`
Expected: success; routes `ƒ /share/[token]` and `ƒ /share/[token]/opengraph-image` listed as dynamic.

Start `npm run dev` in the background, then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/share/doesnotexist
curl -s -o "$TMP/og.png" -w "%{http_code} %{content_type}\n" http://localhost:3000/share/doesnotexist/opengraph-image
```

Expected: `404`, then `200 image/png` showing the "Link unavailable" card. This works even before the migration is applied (the RPC error is caught and treated as unavailable). Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add "src/app/share/[token]"
git commit -m "feat(share): add public share page and OG image"
```

---

### Task 7: Share dialog and entry points

**Files:**
- Create: `src/components/share/ShareDialog.tsx`
- Modify: `src/components/dashboard/TradeDetailSheet.tsx` (imports; state; footer at the "Save Button" block ~line 341)
- Modify: `src/app/playbook/page.tsx` (imports; state; setup card buttons ~line 311; dialog render)

**Interfaces:**
- Consumes: Task 2 builders/modes, `SharedCard`; Task 4 `createShare`, `listSharesForSource`, `revokeShare`, `ShareLink`; Task 5 `ShareCard`, `SHARE_CARD_WIDTH`, `SHARE_CARD_HEIGHT`; `useAccount()` (`currentAccount?.initial_balance`); `useTradesForCurrentAccount()`; `getSupabase`.
- Produces:
  - `type ShareSource = { kind: 'trade'; trade: Trade } | { kind: 'playbook'; setup: PlaybookSetup; trades: Trade[] }`
  - `ShareDialog({ open, onOpenChange, source }: { open: boolean; onOpenChange: (open: boolean) => void; source: ShareSource })`

- [ ] **Step 1: Implement `src/components/share/ShareDialog.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, Link2, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/providers/AccountContext';
import { getSupabase } from '@/lib/supabase';
import type { Trade } from '@/lib/tradeQueries';
import type { PlaybookSetup } from '@/lib/playbookQueries';
import {
    availablePlaybookResultModes,
    availableTradeResultModes,
    buildPlaybookSharePayload,
    buildTradeSharePayload,
    defaultResultMode,
    ResultMode,
    SharedCard,
} from '@/lib/sharePayload';
import { createShare, listSharesForSource, revokeShare, ShareLink } from '@/lib/shareQueries';
import { ShareCard, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from './ShareCard';

export type ShareSource =
    | { kind: 'trade'; trade: Trade }
    | { kind: 'playbook'; setup: PlaybookSetup; trades: Trade[] };

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    source: ShareSource;
}

const MODE_LABELS: Record<ResultMode, string> = {
    points: 'Points',
    usd: '$ P&L',
    percent: '% of account',
};

const PREVIEW_SCALE = 0.5;

function shareUrl(token: string): string {
    return `${window.location.origin}/share/${token}`;
}

export function ShareDialog({ open, onOpenChange, source }: ShareDialogProps) {
    const { currentAccount } = useAccount();
    const initialBalance = currentAccount?.initial_balance ?? null;

    const [requestedMode, setRequestedMode] = useState<ResultMode | null>(null);
    const [includeScreenshot, setIncludeScreenshot] = useState(false);
    const [includeNotes, setIncludeNotes] = useState(false);
    const [links, setLinks] = useState<ShareLink[]>([]);
    const [busy, setBusy] = useState<'download' | 'copy' | 'link' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const sourceId = source.kind === 'trade' ? source.trade.id : source.setup.id;
    const hasScreenshot = source.kind === 'trade' ? !!source.trade.screenshot_url : !!source.setup.screenshot_url;
    const hasNotes = source.kind === 'trade' && !!source.trade.notes?.trim();

    const modes = source.kind === 'trade'
        ? availableTradeResultModes(source.trade, initialBalance)
        : availablePlaybookResultModes(initialBalance);
    const mode = requestedMode && modes.includes(requestedMode) ? requestedMode : defaultResultMode(modes);

    const card: SharedCard = useMemo(() => {
        if (source.kind === 'trade') {
            return {
                kind: 'trade',
                payload: buildTradeSharePayload(source.trade, { resultMode: mode, includeScreenshot, includeNotes }, initialBalance),
            };
        }
        return {
            kind: 'playbook',
            payload: buildPlaybookSharePayload(source.setup, source.trades, { resultMode: mode, includeScreenshot }, initialBalance),
        };
    }, [source, mode, includeScreenshot, includeNotes, initialBalance]);

    useEffect(() => {
        if (!open) return;
        listSharesForSource(source.kind, sourceId)
            .then(setLinks)
            .catch(() => setError('Could not load existing links.'));
    }, [open, source.kind, sourceId]);

    const fetchImage = async (): Promise<Blob> => {
        const res = await fetch('/api/share/image', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(card),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error ?? 'Could not render the image.');
        }
        return res.blob();
    };

    const run = async (action: 'download' | 'copy' | 'link', fn: () => Promise<void>, failure: string) => {
        setBusy(action);
        setError(null);
        try {
            await fn();
        } catch (err) {
            console.error(err);
            setError(failure);
        } finally {
            setBusy(null);
        }
    };

    const handleDownload = () => run('download', async () => {
        const url = URL.createObjectURL(await fetchImage());
        const a = document.createElement('a');
        a.href = url;
        a.download = `${source.kind === 'trade' ? source.trade.symbol : source.setup.name}-share.png`
            .replace(/[^\w.-]+/g, '-');
        a.click();
        URL.revokeObjectURL(url);
    }, 'Could not create the image.');

    const canCopyImage = typeof window !== 'undefined' && 'ClipboardItem' in window;

    // Pass the blob promise straight to ClipboardItem so Safari keeps the user gesture.
    const handleCopyImage = () => run('copy', async () => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': fetchImage() })]);
    }, 'Copying failed — use Download instead.');

    const handleCreateLink = () => run('link', async () => {
        const { data: { user } } = await getSupabase().auth.getUser();
        if (!user) throw new Error('Not signed in');
        const link = await createShare(user.id, sourceId, card);
        setLinks(prev => [link, ...prev]);
        await navigator.clipboard.writeText(shareUrl(link.token)).catch(() => undefined);
        setCopiedId(link.id);
    }, 'Could not create the link.');

    const handleCopyLink = async (link: ShareLink) => {
        await navigator.clipboard.writeText(shareUrl(link.token));
        setCopiedId(link.id);
    };

    const handleRevoke = async (link: ShareLink) => {
        setError(null);
        try {
            await revokeShare(link.id);
            setLinks(prev => prev.filter(l => l.id !== link.id));
        } catch {
            setError('Could not revoke the link.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="text-white">
                        Share {source.kind === 'trade' ? 'trade' : 'setup'}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        Only what you see on the card is shared. Account name and size are never included.
                    </DialogDescription>
                </DialogHeader>

                {/* Options */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-500 mr-1">Show result as</span>
                    {modes.map(m => (
                        <Button
                            key={m}
                            size="sm"
                            variant={m === mode ? 'default' : 'outline'}
                            onClick={() => setRequestedMode(m)}
                            className={m === mode ? 'bg-blue-600 hover:bg-blue-500' : 'border-zinc-700 text-zinc-300'}
                        >
                            {MODE_LABELS[m]}
                        </Button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
                    {hasScreenshot && (
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={includeScreenshot} onChange={e => setIncludeScreenshot(e.target.checked)} />
                            Include screenshot
                        </label>
                    )}
                    {hasNotes && (
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={includeNotes} onChange={e => setIncludeNotes(e.target.checked)} />
                            Include notes
                        </label>
                    )}
                </div>

                {/* Preview: the exact card that gets rendered */}
                <div
                    className="overflow-hidden rounded-lg border border-zinc-800 max-w-full"
                    style={{ width: SHARE_CARD_WIDTH * PREVIEW_SCALE, height: SHARE_CARD_HEIGHT * PREVIEW_SCALE }}
                >
                    <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
                        <ShareCard card={card} />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                    <Button onClick={handleDownload} disabled={busy !== null} variant="outline" className="border-zinc-700 text-zinc-200">
                        {busy === 'download' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Download PNG
                    </Button>
                    {canCopyImage && (
                        <Button onClick={handleCopyImage} disabled={busy !== null} variant="outline" className="border-zinc-700 text-zinc-200">
                            {busy === 'copy' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                            Copy image
                        </Button>
                    )}
                    <Button onClick={handleCreateLink} disabled={busy !== null} className="bg-emerald-600 hover:bg-emerald-500">
                        {busy === 'link' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                        Create link
                    </Button>
                </div>

                {error && <p className="text-sm text-rose-400">{error}</p>}

                {/* Existing links */}
                {links.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Active links</p>
                        {links.map(link => (
                            <div key={link.id} className="flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2">
                                <span className="flex-1 truncate font-mono text-xs text-zinc-300">{shareUrl(link.token)}</span>
                                <Button size="sm" variant="ghost" onClick={() => handleCopyLink(link)} className="text-zinc-400 hover:text-white">
                                    {copiedId === link.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleRevoke(link)} className="text-zinc-400 hover:text-rose-400">
                                    Revoke
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
```

- [ ] **Step 2: Add the Share button to `TradeDetailSheet.tsx`**

Add imports:

```tsx
import { Share2 } from 'lucide-react';
import { ShareDialog } from '@/components/share/ShareDialog';
```

Add state next to the other `useState` calls:

```tsx
    const [shareOpen, setShareOpen] = useState(false);
```

Replace the footer block starting at `{/* Save Button */}` — the `<div className="pt-4 border-t border-zinc-800/50">` wrapping the Save `<Button>` — with a flex row containing a Share button and the existing Save button (keep the Save button's props and children exactly as they are; only add `flex-1` to its className):

```tsx
                    {/* Save / Share */}
                    <div className="pt-4 border-t border-zinc-800/50 flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShareOpen(true)}
                            className="border-zinc-700 text-zinc-200"
                        >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all duration-200 btn-scale"
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </span>
                            ) : (
                                'Save Review'
                            )}
                        </Button>
                    </div>
```

(The only change to the Save button is `w-full` → `flex-1`.)

Immediately before `</SheetContent>`, render the dialog. It shares the form's current values, because list views don't load `notes`/`screenshot_url` onto `trade`:

```tsx
                <ShareDialog
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                    source={{
                        kind: 'trade',
                        trade: {
                            ...trade,
                            notes: notes || null,
                            screenshot_url: screenshotUrl || null,
                            setup_type: setupType === '__none__' ? null : setupType,
                            rating: rating > 0 ? rating : null,
                        },
                    }}
                />
```

- [ ] **Step 3: Add the Share button to `src/app/playbook/page.tsx`**

Add `Share2` to the existing `lucide-react` import list, and add:

```tsx
import { ShareDialog } from '@/components/share/ShareDialog';
import { useTradesForCurrentAccount } from '@/hooks/useTrades';
```

Inside `PlaybookPage`, next to the other state:

```tsx
    const [shareSetup, setShareSetup] = useState<PlaybookSetup | null>(null);
    const { data: accountTrades = [] } = useTradesForCurrentAccount();
```

In each setup card's button group (the `<div className="flex items-center gap-1">` holding the ChevronRight and Trash2 buttons), add before the edit button:

```tsx
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setShareSetup(setup)}
                                                    className="w-8 h-8 text-zinc-500 hover:text-white"
                                                    aria-label="Share setup"
                                                >
                                                    <Share2 className="w-4 h-4" />
                                                </Button>
```

Just before the closing `</DashboardLayout>`, render:

```tsx
            {shareSetup && (
                <ShareDialog
                    open
                    onOpenChange={(open) => !open && setShareSetup(null)}
                    source={{ kind: 'playbook', setup: shareSetup, trades: accountTrades }}
                />
            )}
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run typecheck && npm run build && npx eslint src/components/share src/lib/share*.ts "src/app/share" src/app/api/share`
Expected: all tests pass; typecheck and build succeed; no **new** lint errors in the new files (warnings acceptable). Pre-existing lint errors in modified files are out of scope.

- [ ] **Step 5: Commit**

```bash
git add src/components/share/ShareDialog.tsx src/components/dashboard/TradeDetailSheet.tsx src/app/playbook/page.tsx
git commit -m "feat(share): add share dialog to trades and playbook setups"
```

---

### Task 8: Apply migration and end-to-end check (with the user)

**Files:** none (verification only).

- [ ] **Step 1: User applies the migration**

Ask the user to paste `supabase/migrations/20261005_shares.sql` into the Supabase SQL editor and run it, then run:

```sql
select public.get_share('nonexistent');                          -- expect: NULL
select has_function_privilege('anon', 'public.get_share(text)', 'execute');  -- expect: true
select column_name, privilege_type from information_schema.column_privileges
 where table_name = 'shares' and grantee = 'authenticated' and privilege_type = 'UPDATE';  -- expect: only revoked_at
```

- [ ] **Step 2: Manual end-to-end in the running app**

With `npm run dev` and the user signed in:
1. History → open a trade → **Share**. Check default mode is Points, toggle $ / % and the preview updates; screenshot/notes off by default.
2. **Download PNG** → file matches the preview.
3. **Create link** → link appears under "Active links" and is on the clipboard.
4. Open the link in a private window (logged out) → card page renders; view source shows `og:image` with an absolute URL.
5. **Revoke** → reload the private window → "This link is no longer available"; `/opengraph-image` shows "Link unavailable".
6. Playbook → **Share** on a setup → stats match the Analytics page for that setup and account.

- [ ] **Step 3: Report**

Report results to the user plainly, including any step that failed or was skipped.
