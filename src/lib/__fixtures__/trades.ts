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
