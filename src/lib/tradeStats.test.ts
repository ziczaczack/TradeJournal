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
