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

    it('caps rules and long text to what fits on the 1200x630 card', () => {
        const big = {
            ...setup,
            name: 'n'.repeat(500),
            description: 'd'.repeat(2000),
            rules: Array.from({ length: 20 }, () => 'r'.repeat(500)),
        };
        const p = buildPlaybookSharePayload(big, [], { resultMode: 'usd', includeScreenshot: false }, null);
        expect(p.rules).toHaveLength(MAX_RULES);
        expect(p.name).toHaveLength(60);
        expect(p.rules[0]).toHaveLength(90);
        expect(p.description).toHaveLength(140);
    });

    it('caps a long setup name on trade cards', () => {
        const p = buildTradeSharePayload(trade({ setup_type: 's'.repeat(500) }), opts, null);
        expect(p.setupName).toHaveLength(40);
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
