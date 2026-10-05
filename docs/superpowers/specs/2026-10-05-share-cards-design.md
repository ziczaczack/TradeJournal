# Share Cards — Design

Date: 2026-10-05
Status: Approved in brainstorming, pending spec review

## Goal

Let a trader share a single trade or a playbook setup as a polished image card
(for X, Discord, etc.) and, optionally, as a revocable public link that unfurls
into the same card — without exposing account size, identity, or any data the
user didn't choose to show.

## Scope

In v1:

- Card types: **single trade** and **playbook setup**.
- Share outputs: **Download PNG**, **Copy image**, and **public link** (`/share/<token>`).
- Per-share privacy: result shown as **points (default)**, **$ P&L**, or **% of account**.
- Revoke a link from the share dialog.

Out of v1 (deliberately): period recap cards, a Settings page listing all
shared links, community features, copying screenshots into a dedicated share
bucket.

## Constraints discovered

- Sessions live in browser localStorage; the server has **no service-role key**
  and no auth context. Server code can only use the anon client (or a token-bound
  client from `getSupabaseForToken`).
- No middleware: auth gating is client-side inside `DashboardLayout`. A route
  that doesn't use it is public.
- Trades have no stop-loss, so **R-multiple is unavailable**. Points = price
  difference; % uses `accounts.initial_balance`.
- Trades link to setups via `trading_journal.setup_type = playbook_setups.name`.
- Screenshots are public-bucket URLs (`trade-screenshots/<userId>/<tradeId>/…`).
- CI builds with a placeholder Supabase URL, so share routes must be dynamic
  (no build-time fetching).
- The live DB has drifted from `supabase/migrations`; the migration must be
  idempotent and applied manually in the Supabase SQL editor.

## Approach: frozen snapshot

At share time, the client builds a payload containing **only** what the card
displays and stores it under a random token. Anonymous viewers read it through
a single token-gated `SECURITY DEFINER` function. Public viewers never touch
`trading_journal`, `accounts`, or `playbook_setups`. Trade edits after sharing
do not change the card (re-share to update).

Rejected: live links (privacy rules enforced in SQL over real rows — larger
leak surface) and a service-role key (RLS-bypassing secret for a sharing feature).

## Data model

Migration `supabase/migrations/20261005_shares.sql` (idempotent):

```
shares
  id          uuid primary key default gen_random_uuid()
  token       text not null unique          -- 128-bit random, base64url (22 chars)
  user_id     uuid not null references auth.users(id) on delete cascade
  kind        text not null check (kind in ('trade','playbook'))
  source_id   uuid not null                 -- trade or setup id; owner-only
  payload     jsonb not null
  created_at  timestamptz not null default now()
  revoked_at  timestamptz
  index on (user_id, kind, source_id)
```

RLS enabled. Policies: owner `select`, `insert` (with check `auth.uid() = user_id`),
`update`. No delete policy — revoke = set `revoked_at`.

Public read:

```
get_share(p_token text) returns jsonb
  security definer, set search_path = public, stable
  returns jsonb_build_object('kind', kind, 'payload', payload, 'created_at', created_at)
  where token = p_token and revoked_at is null; null otherwise
grant execute on function get_share(text) to anon, authenticated;
```

Shares cannot be enumerated; a token never reveals user, trade, or setup ids.

## Payloads

Built client-side by pure functions in `src/lib/sharePayload.ts`.

```ts
type ResultMode = 'points' | 'usd' | 'percent';
type ShareResult = { mode: ResultMode; value: number };

interface TradeSharePayload {
  v: 1;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number | null;
  exitPrice: number | null;
  entryTime: string | null;
  duration: string | null;
  setupName: string | null;
  rating: number | null;
  result: ShareResult;              // only the chosen mode is stored
  screenshotUrl?: string;           // only if toggled on
  notes?: string;                   // only if toggled on (trimmed, max 500 chars)
}

interface PlaybookSharePayload {
  v: 1;
  name: string;
  timeframe: string | null;
  description: string | null;
  rules: string[];
  winRateTarget: number;
  stats: { tradeCount: number; winRate: number; avgResult: ShareResult | null };
  screenshotUrl?: string;           // only if toggled on
}
```

Rules:

- **Side**: the Tradovate importer always stores `entry_time` = bought time and
  `exit_time` = sold time (so for shorts `entry_time > exit_time`). Side is
  `short` when both times exist and `entry_time > exit_time`, else `long`.
  Card entry/exit price and entry time follow the real order: long → entry =
  buy, exit = sell, time = `entry_time`; short → entry = sell, exit = buy,
  time = `exit_time`. Missing prices/times → `null`, shown as "—".
- **Points**: `sell_price − buy_price` for both sides (profit per contract in
  price points). Null when either price is missing — then the `points` option
  is disabled.
- **Percent**: `pnl / initial_balance * 100`; the option is disabled when the
  balance is missing or 0.
- **Playbook stats**: trades with `setup_type === setup.name`; win = `pnl > 0`;
  `avgResult` null when there are zero trades.
- Never included: account name, account id, user id, email, trade id, setup id.

`validateSharePayload(kind, unknown)` (same module) checks shape and types,
caps serialized size at 16 KB, and only accepts `screenshotUrl` whose host is
the configured Supabase host. Used by the image API and before insert.

`generateShareToken()` → 16 random bytes via `crypto.getRandomValues`, base64url.

## Rendering

`src/components/share/ShareCard.tsx`: pure JSX, 1200×630, inline styles +
flexbox only (Satori-compatible), switches on `kind`. Dark theme matching the
app. Footer: "My Trading Journal".

Rendered in two places, both with `next/og` `ImageResponse` (no new dependency):

1. `POST /api/share/image` — body `{kind, payload}` → validated → PNG.
   Stateless, no DB access. Powers Download / Copy (no link needed).
   Invalid → 400 with message. Screenshot fetch failure → render without it.
2. `src/app/share/[token]/opengraph-image.tsx` — calls `get_share` with the
   anon client, renders the card; unknown/revoked → generic "Link unavailable"
   card (never an error image in chat unfurls).

Both routes are dynamic (`export const dynamic = 'force-dynamic'`).

## Public page

`src/app/share/[token]/page.tsx` (server component, no `DashboardLayout`):
`get_share` via anon client → card shown as `<img>` of the OG image, small
"Shared from My Trading Journal" footer, `generateMetadata` for title and
OG/Twitter tags. Unknown/revoked/error → `notFound()` with "This link is no
longer available".

## Share dialog

`src/components/share/ShareDialog.tsx` (Radix Dialog, like existing dialogs),
opened by a **Share** button in `TradeDetailSheet` and on each playbook setup.

1. Controls: result format (Points default / $ / %), include screenshot
   (off), include notes (trade only, off).
2. Live preview: the same `ShareCard`, CSS-scaled.
3. Actions: **Download PNG**, **Copy image** (hidden when
   `ClipboardItem` is unsupported; on rejection, suggests Download),
   **Create link** → insert row → show URL + Copy.
4. Existing active links for this item listed with **Revoke**.

Data access in `src/lib/shareQueries.ts`: `createShare`, `listSharesForSource`,
`revokeShare`, `fetchSharedCard(token)` (RPC). Token collision on insert →
one retry with a new token.

## Testing

Vitest (node env), following existing patterns:

- `sharePayload.test.ts`: points/$/% values incl. short trades and zero
  balance; only the chosen mode stored; toggled-off fields and all ids/account
  name absent; notes trimming; playbook stats incl. zero trades.
- Validator: rejects bad shapes, >16 KB, foreign screenshot hosts; accepts
  valid payloads.
- Token: 22 chars, base64url alphabet, distinct across calls.
- Manual E2E in the running app: create link → open logged out → revoke → 404.

## Rollout

1. User runs `20261005_shares.sql` in the Supabase SQL editor.
2. Verify: `select get_share('nonexistent');` returns null as anon; insert via
   the app and fetch by token.
3. No new environment variables.
