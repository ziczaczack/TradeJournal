import type { Trade } from './tradeQueries';
import type { MistakeTag } from './mistakeTagQueries';

export type MistakePeriod = 'month' | 'all';

export interface MistakeState {
    tagIds: string[];
    reviewed: boolean;
}

export interface MistakeRow {
    tagId: string;
    name: string;
    isHidden: boolean;
    count: number;
    winRate: number;
    avgPnl: number;
    netPnl: number;
    cost: number | null;
}

export interface MistakeAnalysis {
    totalCount: number;
    reviewedCount: number;
    cleanCount: number;
    mistakeTradeCount: number;
    cleanAvgPnl: number | null;
    totalCost: number | null;
    smallSample: boolean;
    rows: MistakeRow[];
}

export const SMALL_SAMPLE_CLEAN_TRADES = 5;

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const tagIdsOf = (t: Trade) => t.mistake_tag_ids ?? [];

/** 'month' = the calendar month containing `now`, by entry time in local time. */
export function filterByPeriod(trades: Trade[], period: MistakePeriod, now: Date): Trade[] {
    if (period === 'all') return trades;
    const year = now.getFullYear();
    const month = now.getMonth();
    return trades.filter(t => {
        if (!t.entry_time) return false;
        const d = new Date(t.entry_time);
        return d.getFullYear() === year && d.getMonth() === month;
    });
}

/**
 * What mistakes cost, measured against trades explicitly marked clean.
 * Unreviewed trades are excluded: an untagged trade isn't necessarily clean.
 */
export function analyzeMistakes(
    trades: Trade[],
    tags: MistakeTag[],
    period: MistakePeriod,
    now: Date
): MistakeAnalysis {
    const scoped = filterByPeriod(trades, period, now);
    const reviewed = scoped.filter(t => t.mistakes_reviewed === true);
    const clean = reviewed.filter(t => tagIdsOf(t).length === 0);
    const mistakeTrades = reviewed.filter(t => tagIdsOf(t).length > 0);

    const cleanAvgPnl = clean.length ? sum(clean.map(t => t.pnl)) / clean.length : null;

    const costOf = (group: Trade[]): number | null => {
        if (cleanAvgPnl === null || group.length === 0) return null;
        const groupAvg = sum(group.map(t => t.pnl)) / group.length;
        return round2((cleanAvgPnl - groupAvg) * group.length);
    };

    const rows: MistakeRow[] = [];
    for (const tag of tags) {
        const group = mistakeTrades.filter(t => tagIdsOf(t).includes(tag.id));
        if (group.length === 0) continue;
        const net = sum(group.map(t => t.pnl));
        rows.push({
            tagId: tag.id,
            name: tag.name,
            isHidden: tag.is_hidden,
            count: group.length,
            winRate: round2((group.filter(t => t.pnl > 0).length / group.length) * 100),
            avgPnl: round2(net / group.length),
            netPnl: round2(net),
            cost: costOf(group),
        });
    }

    // Biggest cost first; rows without a cost go last, ordered by count.
    rows.sort((a, b) => {
        if (a.cost === null && b.cost === null) return b.count - a.count;
        if (a.cost === null) return 1;
        if (b.cost === null) return -1;
        return b.cost - a.cost;
    });

    return {
        totalCount: scoped.length,
        reviewedCount: reviewed.length,
        cleanCount: clean.length,
        mistakeTradeCount: mistakeTrades.length,
        cleanAvgPnl: cleanAvgPnl === null ? null : round2(cleanAvgPnl),
        totalCost: costOf(mistakeTrades),
        smallSample: clean.length < SMALL_SAMPLE_CLEAN_TRADES,
        rows,
    };
}

/**
 * Trade-sheet chip logic. Picking a tag toggles it; 'none' marks the trade
 * clean (or un-reviews it if it already was). Removing the last tag returns
 * to unreviewed, so a trade only becomes clean by an explicit "No mistakes".
 */
export function toggleMistake(state: MistakeState, choice: string): MistakeState {
    if (choice === 'none') {
        const isClean = state.reviewed && state.tagIds.length === 0;
        return isClean ? { tagIds: [], reviewed: false } : { tagIds: [], reviewed: true };
    }
    const tagIds = state.tagIds.includes(choice)
        ? state.tagIds.filter(id => id !== choice)
        : [...state.tagIds, choice];
    return tagIds.length ? { tagIds, reviewed: true } : { tagIds: [], reviewed: false };
}
