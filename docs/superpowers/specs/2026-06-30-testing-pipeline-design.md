# Testing Pipeline — Design

**Date:** 2026-06-30
**Status:** Approved

## Goal

Establish an automated testing pipeline for My Trading Journal. The project currently
has no test runner, no `test` script (only `dev`, `build`, `start`, `lint`), and no CI.
The only existing test is an ad-hoc `console.log`-assertion script
(`src/utils/csvParser.test.js`) that is run manually and wired into nothing.

This design adds a real runner, unit tests for the highest-value pure logic, and a CI
workflow — so regressions in the numbers users trust are caught automatically.

## Scope

**In scope:**
- Vitest as the test runner, configured for TypeScript + Node environment.
- `typecheck` and `test` npm scripts.
- Unit tests for three pure-logic modules (see Coverage).
- A shared trade fixture factory for building test data.
- A GitHub Actions CI workflow: lint → typecheck → test → build.

**Out of scope (explicitly, to keep this focused):**
- CSV parser tests — the existing ad-hoc `src/utils/csvParser.test.js` stays as-is and
  is not migrated into Vitest.
- React component / integration / e2e tests.
- Coverage thresholds / coverage reporting.

## Tooling

**Runner: Vitest.** Chosen over Jest because it runs TypeScript + ESM with near-zero
config alongside Next, is fast, and exposes a Jest-compatible API. Jest would require
`ts-jest`/babel configuration and ESM workarounds for no added benefit.

- `vitest.config.ts` at repo root: `test.environment = 'node'` (all targets are
  side-effect-free pure functions; no DOM is needed).
- No changes to `tsconfig.json` expected beyond what Vitest reads automatically.

## Conventions

- **Co-located tests:** `foo.test.ts` sits next to `foo.ts` in `src/lib/`.
- **Fixture factory:** `src/lib/__fixtures__/trades.ts` exports `makeTrade(overrides?)`
  returning a complete `Trade` with sensible defaults, so tests build arrays without
  repeating the full shape. Defaults represent a neutral winning trade; tests override
  only the fields relevant to each case (e.g. `pnl`, `psychology_tag`, `setup_type`,
  `entry_time`).

## Coverage (first batch)

### `src/lib/analyticsStats.ts`
- `calculateAnalyticsStats` — net PnL, win rate, profit factor, **max drawdown**.
  - Cases: empty array (returns zeroed stats), single trade, all wins, all losses,
    mixed set with hand-computed expected values, and a known sequence that produces a
    specific max drawdown.
- `generateEquityCurveData` — cumulative running PnL total.
  - Cases: empty array → empty curve; ordered sequence produces the expected
    monotonic cumulative points.

### `src/lib/tradeStats.ts`
- `calculateStats` — core dashboard stats over a mixed trade set.
- `formatDuration` — seconds → human string (e.g. boundaries at 0, <60s, minutes, hours).
- `formatPnL` — returns `{ text, isPositive }` for positive, negative, and zero PnL.

### `src/lib/aiMentor.ts`
- `analyzeEmotionCorrelation`:
  - A tag whose average loss is ≥ 1.5× the normal average loss produces a warning.
  - Dangerous tags (`Revenge`, `FOMO`, etc.) are flagged `high` severity.
  - A tag with no losing trades produces no warning.
  - Empty input → `[]`.

## npm Scripts

Added to `package.json`:
- `"test": "vitest run"`
- `"test:watch": "vitest"`
- `"typecheck": "tsc --noEmit"`

## CI — GitHub Actions

File: `.github/workflows/ci.yml`

- **Triggers:** `push` and `pull_request`.
- **Runtime:** Node 20, dependencies via `npm ci`.
- **Steps (in order):** lint → typecheck → test → build.
- **Build env:** the `build` step is given placeholder `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` values. The Supabase client initializes lazily
  (`getSupabase()` only throws when called at runtime), so placeholders are sufficient to
  compile a production build. No real secrets are required in CI.

## Success Criteria

- `npm test` runs the Vitest suite and all new tests pass locally.
- `npm run typecheck` passes.
- The CI workflow runs lint, typecheck, test, and build to completion on push/PR.
- The existing ad-hoc CSV test is left untouched and the production build is unaffected.
