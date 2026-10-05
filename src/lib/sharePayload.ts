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
// Sized so a maximal card still fits 1200x630 (Satori doesn't clip overflow).
export const MAX_NAME_LENGTH = 60;
export const MAX_SETUP_NAME_LENGTH = 40;
export const MAX_RULE_LENGTH = 90;
export const MAX_DESCRIPTION_LENGTH = 140;

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
        setupName: trade.setup_type?.trim() ? truncate(trade.setup_type.trim(), MAX_SETUP_NAME_LENGTH) : null,
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
        name: truncate(setup.name, MAX_NAME_LENGTH),
        timeframe: setup.timeframe?.trim() || null,
        description: description ? truncate(description, MAX_DESCRIPTION_LENGTH) : null,
        // The playbook form allows blank rule rows; drop them (the validator rejects empty strings).
        rules: setup.rules
            .map(rule => rule.trim())
            .filter(Boolean)
            .slice(0, MAX_RULES)
            .map(rule => truncate(rule, MAX_RULE_LENGTH)),
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
