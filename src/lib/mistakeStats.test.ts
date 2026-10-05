import { describe, it, expect } from 'vitest';
import { makeTrade } from './__fixtures__/trades';
import type { MistakeTag } from './mistakeTagQueries';
import { analyzeMistakes, filterByPeriod, toggleMistake } from './mistakeStats';

const tag = (id: string, name: string, is_hidden = false): MistakeTag => ({
    id, user_id: 'u1', name, sort_order: 0, is_hidden, created_at: '',
});
const TAGS = [tag('stop', 'Moved stop'), tag('size', 'Oversized'), tag('old', 'Old habit', true)];
const NOW = new Date(2026, 9, 15, 12, 0); // Oct 15 2026, local time
const inOct = new Date(2026, 9, 10, 10, 0).toISOString();

const clean = (pnl: number) => makeTrade({ pnl, entry_time: inOct, mistakes_reviewed: true, mistake_tag_ids: [] });
const mistake = (pnl: number, ids: string[]) =>
    makeTrade({ pnl, entry_time: inOct, mistakes_reviewed: true, mistake_tag_ids: ids });
const unreviewed = (pnl: number) => makeTrade({ pnl, entry_time: inOct, mistakes_reviewed: false, mistake_tag_ids: [] });

describe('analyzeMistakes', () => {
    it('compares against clean trades and ignores unreviewed ones', () => {
        const trades = [clean(100), clean(200), mistake(-50, ['stop']), unreviewed(-9999)];
        const a = analyzeMistakes(trades, TAGS, 'all', NOW);
        expect(a).toMatchObject({
            totalCount: 4,
            reviewedCount: 3,
            cleanCount: 2,
            mistakeTradeCount: 1,
            cleanAvgPnl: 150,
            totalCost: 200, // (150 - -50) * 1
        });
        expect(a.rows).toEqual([
            { tagId: 'stop', name: 'Moved stop', isHidden: false, count: 1, winRate: 0, avgPnl: -50, netPnl: -50, cost: 200 },
        ]);
    });

    it('counts a multi-tag trade once in the total but in every tag row', () => {
        const trades = [clean(100), mistake(-100, ['stop', 'size']), mistake(50, ['size'])];
        const a = analyzeMistakes(trades, TAGS, 'all', NOW);
        expect(a.mistakeTradeCount).toBe(2);
        expect(a.totalCost).toBe(250); // (100 - (-25)) * 2
        const size = a.rows.find(r => r.tagId === 'size')!;
        const stop = a.rows.find(r => r.tagId === 'stop')!;
        expect(size).toMatchObject({ count: 2, winRate: 50, avgPnl: -25, netPnl: -50, cost: 250 });
        expect(stop).toMatchObject({ count: 1, cost: 200 });
    });

    it('sorts rows by cost, biggest first, and omits tags with no trades', () => {
        const trades = [clean(100), mistake(-100, ['stop', 'size']), mistake(50, ['size'])];
        expect(analyzeMistakes(trades, TAGS, 'all', NOW).rows.map(r => r.tagId)).toEqual(['size', 'stop']);
    });

    it('returns null costs when there are no clean trades, sorted by count', () => {
        const trades = [mistake(-10, ['stop']), mistake(-10, ['size']), mistake(-10, ['size'])];
        const a = analyzeMistakes(trades, TAGS, 'all', NOW);
        expect(a.cleanAvgPnl).toBeNull();
        expect(a.totalCost).toBeNull();
        expect(a.rows.map(r => [r.tagId, r.cost])).toEqual([['size', null], ['stop', null]]);
    });

    it('flags a small clean sample', () => {
        const few = [clean(1), clean(1), mistake(0, ['stop'])];
        expect(analyzeMistakes(few, TAGS, 'all', NOW).smallSample).toBe(true);
        const enough = [...Array.from({ length: 5 }, () => clean(1)), mistake(0, ['stop'])];
        expect(analyzeMistakes(enough, TAGS, 'all', NOW).smallSample).toBe(false);
    });

    it('reports a negative cost when the mistake trades beat clean ones', () => {
        const a = analyzeMistakes([clean(10), mistake(110, ['stop'])], TAGS, 'all', NOW);
        expect(a.totalCost).toBe(-100);
    });

    it('still reports hidden tags that are on trades', () => {
        const a = analyzeMistakes([clean(0), mistake(-5, ['old'])], TAGS, 'all', NOW);
        expect(a.rows[0]).toMatchObject({ tagId: 'old', name: 'Old habit', isHidden: true });
    });

    it('counts trades with unknown tag ids in the total without a row', () => {
        const a = analyzeMistakes([clean(0), mistake(-5, ['ghost'])], TAGS, 'all', NOW);
        expect(a.mistakeTradeCount).toBe(1);
        expect(a.totalCost).toBe(5);
        expect(a.rows).toEqual([]);
    });

    it('treats missing fields on old trades as unreviewed', () => {
        const a = analyzeMistakes([makeTrade({ pnl: 5, entry_time: inOct })], TAGS, 'all', NOW);
        expect(a).toMatchObject({ totalCount: 1, reviewedCount: 0, totalCost: null, rows: [] });
    });
});

describe('filterByPeriod', () => {
    it('keeps only trades in the calendar month of now (local time) for "month"', () => {
        const first = makeTrade({ entry_time: new Date(2026, 9, 1, 0, 30).toISOString() });
        const prevLast = makeTrade({ entry_time: new Date(2026, 8, 30, 23, 30).toISOString() });
        const noTime = makeTrade({ entry_time: null });
        expect(filterByPeriod([first, prevLast, noTime], 'month', NOW)).toEqual([first]);
        expect(filterByPeriod([first, prevLast, noTime], 'all', NOW)).toHaveLength(3);
    });
});

describe('toggleMistake', () => {
    const unreviewedState = { tagIds: [], reviewed: false };

    it('adds and removes tags, marking the trade reviewed', () => {
        const one = toggleMistake(unreviewedState, 'stop');
        expect(one).toEqual({ tagIds: ['stop'], reviewed: true });
        expect(toggleMistake(one, 'size')).toEqual({ tagIds: ['stop', 'size'], reviewed: true });
    });

    it('returns to unreviewed when the last tag is removed (clean must be explicit)', () => {
        expect(toggleMistake({ tagIds: ['stop'], reviewed: true }, 'stop')).toEqual(unreviewedState);
    });

    it('"none" marks clean, clearing tags; choosing it again un-reviews', () => {
        const isClean = toggleMistake({ tagIds: ['stop'], reviewed: true }, 'none');
        expect(isClean).toEqual({ tagIds: [], reviewed: true });
        expect(toggleMistake(isClean, 'none')).toEqual(unreviewedState);
    });
});
