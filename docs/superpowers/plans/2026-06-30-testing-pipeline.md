# Testing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vitest-based automated testing pipeline with unit tests for the core stats/AI pure logic and a GitHub Actions CI workflow.

**Architecture:** Vitest runs in a Node environment against side-effect-free functions in `src/lib`. Tests are co-located (`foo.test.ts` beside `foo.ts`) and build trade data through a single `makeTrade` fixture factory. A GitHub Actions workflow runs lint → typecheck → test → build on push and PR.

**Tech Stack:** Vitest, TypeScript, GitHub Actions, Node 20.

## Global Constraints

- Test runner: **Vitest**, `environment: 'node'`, include glob `src/**/*.test.ts`.
- These are **characterization tests of existing code** — the function under test already exists, so each test is expected to **PASS** on first run. A failure means either the test expectation is wrong or a real bug was found; investigate, don't silently "fix" the assertion.
- PnL is stored in **dollars** (not cents).
- Co-locate tests next to source. Fixtures live in `src/lib/__fixtures__/`.
- Do **not** modify or migrate the existing `src/utils/csvParser.test.js` — it is out of scope and must remain untouched.
- Node 20 in CI; dependencies installed with `npm ci`.

---

### Task 1: Test tooling & fixture factory

**Files:**
- Modify: `package.json` (add devDependency + scripts)
- Create: `vitest.config.ts`
- Create: `src/lib/__fixtures__/trades.ts`
- Test: `src/lib/__fixtures__/trades.test.ts`

**Interfaces:**
- Consumes: `Trade` from `src/lib/tradeQueries.ts` (required fields: `id`, `trade_id`, `symbol`, `pnl`).
- Produces: `makeTrade(overrides?: Partial<Trade>): Trade` — used by all later test tasks.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`
Expected: `vitest` added to `devDependencies`; install completes without error.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
```

- [ ] **Step 3: Add npm scripts**

In `package.json`, replace the `"scripts"` block so it reads:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
```

- [ ] **Step 4: Create the fixture factory**

Create `src/lib/__fixtures__/trades.ts`:

```ts
import { Trade } from '../tradeQueries';

let counter = 0;

/**
 * Build a complete Trade for tests. Override only the fields a test cares about.
 * Defaults represent a neutral break-even trade with a 5-minute duration.
 */
export function makeTrade(overrides: Partial<Trade> = {}): Trade {
    counter += 1;
    return {
        id: `trade-${counter}`,
        trade_id: `key-${counter}`,
        symbol: 'NQ',
        pnl: 0,
        entry_time: '2026-01-01T10:00:00.000Z',
        exit_time: '2026-01-01T10:05:00.000Z',
        duration: '5min',
        setup_type: null,
        is_valid_setup: null,
        psychology_tag: null,
        ...overrides,
    };
}
```

- [ ] **Step 5: Write the fixture test**

Create `src/lib/__fixtures__/trades.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeTrade } from './trades';

describe('makeTrade', () => {
    it('returns a complete trade with default values', () => {
        const trade = makeTrade();
        expect(trade.symbol).toBe('NQ');
        expect(trade.pnl).toBe(0);
        expect(typeof trade.id).toBe('string');
        expect(typeof trade.trade_id).toBe('string');
    });

    it('applies overrides', () => {
        const trade = makeTrade({ pnl: 150, psychology_tag: 'Revenge' });
        expect(trade.pnl).toBe(150);
        expect(trade.psychology_tag).toBe('Revenge');
    });

    it('gives each trade a unique id', () => {
        expect(makeTrade().id).not.toBe(makeTrade().id);
    });
});
```

- [ ] **Step 6: Run the test suite**

Run: `npm test`
Expected: PASS — 1 test file, 3 tests passing. (Confirms Vitest is wired correctly.)

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/__fixtures__/
git commit -m "$(cat <<'EOF'
test: add Vitest tooling and trade fixture factory

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: analyticsStats tests

**Files:**
- Test: `src/lib/analyticsStats.test.ts`

**Interfaces:**
- Consumes: `makeTrade` from `src/lib/__fixtures__/trades.ts`; `calculateAnalyticsStats(trades: Trade[]): AnalyticsStats` and `generateEquityCurveData(trades: Trade[]): EquityCurvePoint[]` from `src/lib/analyticsStats.ts`.
- Note: `profitFactor` is clamped — `Infinity` (no losses) becomes `0`. `maxDrawdown` is computed over an equity curve starting at 0, sorted by `exit_time`.

- [ ] **Step 1: Write the test**

Create `src/lib/analyticsStats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateAnalyticsStats, generateEquityCurveData } from './analyticsStats';
import { makeTrade } from './__fixtures__/trades';

describe('calculateAnalyticsStats', () => {
    it('returns zeroed stats for an empty array', () => {
        const stats = calculateAnalyticsStats([]);
        expect(stats.totalTrades).toBe(0);
        expect(stats.totalNetPnL).toBe(0);
        expect(stats.winRate).toBe(0);
        expect(stats.maxDrawdown).toBe(0);
    });

    it('computes pnl, win rate, profit factor and counts for a mixed set', () => {
        const trades = [
            makeTrade({ pnl: 100, exit_time: '2026-01-01T10:00:00.000Z' }),
            makeTrade({ pnl: -40, exit_time: '2026-01-01T11:00:00.000Z' }),
            makeTrade({ pnl: -30, exit_time: '2026-01-01T12:00:00.000Z' }),
            makeTrade({ pnl: 50, exit_time: '2026-01-01T13:00:00.000Z' }),
        ];
        const stats = calculateAnalyticsStats(trades);
        expect(stats.totalTrades).toBe(4);
        expect(stats.winningTrades).toBe(2);
        expect(stats.losingTrades).toBe(2);
        expect(stats.totalNetPnL).toBe(80);
        expect(stats.winRate).toBe(50);
        expect(stats.profitFactor).toBeCloseTo(150 / 70, 5);
    });

    it('tracks max drawdown across the equity curve (sorted by exit time)', () => {
        const trades = [
            makeTrade({ pnl: 100, exit_time: '2026-01-01T10:00:00.000Z' }),
            makeTrade({ pnl: -40, exit_time: '2026-01-01T11:00:00.000Z' }),
            makeTrade({ pnl: -30, exit_time: '2026-01-01T12:00:00.000Z' }),
            makeTrade({ pnl: 50, exit_time: '2026-01-01T13:00:00.000Z' }),
        ];
        // equity: 100 -> 60 -> 30 -> 80; peak 100, deepest trough 30 => drawdown 70
        const stats = calculateAnalyticsStats(trades);
        expect(stats.maxDrawdown).toBe(70);
        expect(stats.maxDrawdownPercent).toBe(70);
    });

    it('returns profitFactor 0 when there are no losing trades (Infinity is clamped)', () => {
        const trades = [makeTrade({ pnl: 100 }), makeTrade({ pnl: 50 })];
        const stats = calculateAnalyticsStats(trades);
        expect(stats.winRate).toBe(100);
        expect(stats.profitFactor).toBe(0);
    });
});

describe('generateEquityCurveData', () => {
    it('returns an empty array for no trades', () => {
        expect(generateEquityCurveData([])).toEqual([]);
    });

    it('produces a cumulative running total ordered by exit time', () => {
        const trades = [
            makeTrade({ pnl: 100, exit_time: '2026-01-01T10:00:00.000Z' }),
            makeTrade({ pnl: -40, exit_time: '2026-01-01T11:00:00.000Z' }),
            makeTrade({ pnl: -30, exit_time: '2026-01-01T12:00:00.000Z' }),
            makeTrade({ pnl: 50, exit_time: '2026-01-01T13:00:00.000Z' }),
        ];
        const curve = generateEquityCurveData(trades);
        expect(curve.map((p) => p.cumulativePnL)).toEqual([100, 60, 30, 80]);
        expect(curve).toHaveLength(4);
    });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- analyticsStats`
Expected: PASS — all `analyticsStats` tests green. If `maxDrawdown` or `profitFactor` fail, stop and investigate (possible real bug), do not adjust expectations blindly.

- [ ] **Step 3: Commit**

```bash
git add src/lib/analyticsStats.test.ts
git commit -m "$(cat <<'EOF'
test: cover analyticsStats pnl, win rate, drawdown and equity curve

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: tradeStats tests

**Files:**
- Test: `src/lib/tradeStats.test.ts`

**Interfaces:**
- Consumes: `makeTrade`; `calculateStats(trades: Trade[]): TradeStats`, `formatDuration(seconds: number): string`, `formatPnL(pnl: number): { text: string; isPositive: boolean }` from `src/lib/tradeStats.ts`.
- Note: `disciplineRate` = validSetup / trades-with-non-null `is_valid_setup`. `avgDurationSeconds` parses strings like `"2min"`/`"1hr 30min"`.

- [ ] **Step 1: Write the test**

Create `src/lib/tradeStats.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calculateStats, formatDuration, formatPnL } from './tradeStats';
import { makeTrade } from './__fixtures__/trades';

describe('calculateStats', () => {
    it('returns zeroed stats for an empty array', () => {
        const stats = calculateStats([]);
        expect(stats.totalTrades).toBe(0);
        expect(stats.totalPnL).toBe(0);
        expect(stats.winRate).toBe(0);
        expect(stats.disciplineRate).toBe(0);
    });

    it('computes pnl, win rate, avg duration and discipline rate', () => {
        const trades = [
            makeTrade({ pnl: 100, duration: '1min', is_valid_setup: true }),
            makeTrade({ pnl: -50, duration: '2min', is_valid_setup: false }),
            makeTrade({ pnl: 25, duration: null, is_valid_setup: null }),
        ];
        const stats = calculateStats(trades);
        expect(stats.totalPnL).toBe(75);
        expect(stats.winningTrades).toBe(2);
        expect(stats.losingTrades).toBe(1);
        expect(stats.winRate).toBeCloseTo(66.6667, 3);
        expect(stats.avgDurationSeconds).toBe(60); // (60 + 120 + 0) / 3
        expect(stats.disciplineRate).toBe(50);     // 1 valid of 2 trades with setup info
    });
});

describe('formatDuration', () => {
    it('formats common durations', () => {
        expect(formatDuration(0)).toBe('-');
        expect(formatDuration(45)).toBe('45s');
        expect(formatDuration(90)).toBe('1m 30s');
        expect(formatDuration(3661)).toBe('1h 1m');
    });
});

describe('formatPnL', () => {
    it('formats positive, negative and zero pnl with sign', () => {
        expect(formatPnL(100)).toEqual({ text: '+$100.00', isPositive: true });
        expect(formatPnL(-50)).toEqual({ text: '-$50.00', isPositive: false });
        expect(formatPnL(0)).toEqual({ text: '+$0.00', isPositive: true });
    });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- tradeStats`
Expected: PASS — all `tradeStats` tests green.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tradeStats.test.ts
git commit -m "$(cat <<'EOF'
test: cover tradeStats calculations and formatters

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: analyzeEmotionCorrelation tests

**Files:**
- Test: `src/lib/aiMentor.test.ts`

**Interfaces:**
- Consumes: `makeTrade`; `analyzeEmotionCorrelation(trades: Trade[]): EmotionWarning[]` from `src/lib/aiMentor.ts`.
- Note: `normalAvgLoss` = average absolute loss across all losing trades. A tag warns only if its average loss > `1.5 * normalAvgLoss`. Dangerous tags (`Revenge`, `FOMO`, `Overconfident`, `Impatient`, `Fearful`, `Tilted`) are forced to `high` severity. `tradeCount` counts all trades with the tag (wins included).

- [ ] **Step 1: Write the test**

Create `src/lib/aiMentor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { analyzeEmotionCorrelation } from './aiMentor';
import { makeTrade } from './__fixtures__/trades';

describe('analyzeEmotionCorrelation', () => {
    it('returns no warnings for an empty array', () => {
        expect(analyzeEmotionCorrelation([])).toEqual([]);
    });

    it('returns no warnings when there are no losing trades', () => {
        const trades = [
            makeTrade({ pnl: 100, psychology_tag: 'Calm' }),
            makeTrade({ pnl: 50, psychology_tag: 'Revenge' }),
        ];
        expect(analyzeEmotionCorrelation(trades)).toEqual([]);
    });

    it('flags a dangerous tag whose losses exceed 1.5x the normal average loss', () => {
        const trades = [
            makeTrade({ pnl: -100, psychology_tag: 'Revenge' }),
            makeTrade({ pnl: -100, psychology_tag: 'Revenge' }),
            makeTrade({ pnl: -20, psychology_tag: 'Calm' }),
            makeTrade({ pnl: -20, psychology_tag: 'Calm' }),
        ];
        // normal avg loss = (100+100+20+20)/4 = 60; Revenge avg = 100 > 90 => warn
        const warnings = analyzeEmotionCorrelation(trades);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].tag).toBe('Revenge');
        expect(warnings[0].severity).toBe('high');
        expect(warnings[0].tradeCount).toBe(2);
    });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- aiMentor`
Expected: PASS — all `aiMentor` tests green.

- [ ] **Step 3: Commit**

```bash
git add src/lib/aiMentor.test.ts
git commit -m "$(cat <<'EOF'
test: cover analyzeEmotionCorrelation warning logic

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: GitHub Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `lint`, `typecheck`, `test`, and `build` npm scripts defined in Task 1.

- [ ] **Step 1: Verify the full pipeline passes locally first**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: every step exits 0. If `lint` or `typecheck` surface pre-existing issues, fix them in this task before adding CI (CI must be green on first run).

- [ ] **Step 2: Create the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "$(cat <<'EOF'
ci: run lint, typecheck, test and build on push and PR

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: (After pushing) confirm the workflow runs green**

Run: `gh run list --workflow ci.yml --limit 1`
Expected: the most recent run shows `completed / success`.

---

## Self-Review

**Spec coverage:**
- Vitest runner + Node env + config → Task 1 ✓
- `test`, `test:watch`, `typecheck` scripts → Task 1 ✓
- Fixture factory `makeTrade` → Task 1 ✓
- analyticsStats (`calculateAnalyticsStats`, `generateEquityCurveData`) → Task 2 ✓
- tradeStats (`calculateStats`, `formatDuration`, `formatPnL`) → Task 3 ✓
- aiMentor (`analyzeEmotionCorrelation`) → Task 4 ✓
- CI: lint → typecheck → test → build, Node 20, build env placeholders → Task 5 ✓
- Existing `csvParser.test.js` untouched (not referenced by any task) ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**Type consistency:** `makeTrade` signature identical across Tasks 1–4; function names and return shapes (`AnalyticsStats`, `TradeStats`, `EmotionWarning`) match the source modules. ✓
