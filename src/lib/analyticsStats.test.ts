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
