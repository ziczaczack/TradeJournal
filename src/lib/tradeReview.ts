import type { Trade } from './tradeQueries';

export type ReviewTemplate = 'full' | 'basic';
export type ReviewAnswers = Record<string, string>;

export interface ReviewQuestion {
    id: string;
    label: string;
}

export const REVIEW_TEMPLATES: Record<
    ReviewTemplate,
    { label: string; questions: ReviewQuestion[]; includesChart: boolean }
> = {
    full: {
        label: 'Full',
        includesChart: true,
        questions: [
            { id: 'htf_analysis', label: 'Higher-timeframe analysis' },
            { id: 'entry_reason', label: 'Reason for entry' },
            { id: 'stop_reason', label: 'Reason for stop placement' },
            { id: 'execution', label: 'Actual execution' },
            { id: 'emotions', label: 'Emotions before entry and while holding' },
            { id: 'advice', label: 'Advice to my pre-trade self' },
        ],
    },
    basic: {
        label: 'Basic',
        includesChart: false,
        questions: [
            { id: 'standout', label: 'What stood out in this trade, good or bad?' },
            { id: 'redo', label: 'If I did it again, what would I do?' },
        ],
    },
};

export const MAX_ANSWER_LENGTH = 2000;
export const MAX_DAY_NOTE_LENGTH = 5000;
// Stored answers are checked in bytes (DB constraint is 64000). maxLength counts
// characters, and CJK characters take 3 bytes in UTF-8, so this must comfortably
// exceed every answer at MAX_ANSWER_LENGTH (8 × 2000 × 3 ≈ 48 KB).
export const MAX_REVIEW_BYTES = 60000;

export function reviewAnswersBytes(answers: ReviewAnswers): number {
    return new TextEncoder().encode(JSON.stringify(answers)).length;
}

const KNOWN_IDS = new Set(
    Object.values(REVIEW_TEMPLATES).flatMap(t => t.questions.map(q => q.id))
);

const round2 = (n: number) => Math.round(n * 100) / 100;

export function reviewProgress(
    template: ReviewTemplate | null,
    answers: ReviewAnswers,
    hasScreenshot: boolean
): { done: number; total: number } {
    if (!template) return { done: 0, total: 0 };
    const def = REVIEW_TEMPLATES[template];
    const answered = def.questions.filter(q => (answers[q.id] ?? '').trim() !== '').length;
    const chart = def.includesChart ? 1 : 0;
    return {
        done: answered + (def.includesChart && hasScreenshot ? 1 : 0),
        total: def.questions.length + chart,
    };
}

/** Trim, drop empty/non-string/unknown answers, cap length. Keeps both templates' answers. */
export function cleanAnswers(answers: Record<string, unknown>): ReviewAnswers {
    const cleaned: ReviewAnswers = {};
    for (const [id, value] of Object.entries(answers)) {
        if (!KNOWN_IDS.has(id) || typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (trimmed) cleaned[id] = trimmed.slice(0, MAX_ANSWER_LENGTH);
    }
    return cleaned;
}

/** The write-up fields for a trade update. An untouched write-up (null template) stays unwritten. */
export function writeUpToSave(
    template: ReviewTemplate | null,
    answers: ReviewAnswers
): { review_template: ReviewTemplate | null; review_answers: ReviewAnswers } {
    return { review_template: template, review_answers: cleanAnswers(answers) };
}

// ============================================
// Days (local time)
// ============================================

const pad = (n: number) => String(n).padStart(2, '0');

export function toDayKey(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A valid local YYYY-MM-DD, or null. */
export function parseDayKey(value: string | null | undefined): string | null {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return toDayKey(date) === value ? value : null;
}

function dayToDate(day: string, offsetDays = 0): Date {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d + offsetDays);
}

export function shiftDay(day: string, delta: number): string {
    return toDayKey(dayToDate(day, delta));
}

/** Local midnight to the next local midnight (end exclusive), as ISO instants. */
export function localDayBounds(day: string): { start: string; end: string } {
    return { start: dayToDate(day).toISOString(), end: dayToDate(day, 1).toISOString() };
}

/** Today if it has trades, else the latest day with a trade, else today. */
export function defaultJournalDay(entryTimes: (string | null | undefined)[], today: Date): string {
    const todayKey = toDayKey(today);
    const days = entryTimes
        .filter((t): t is string => !!t)
        .map(t => toDayKey(new Date(t)))
        .filter(d => d <= todayKey);
    if (days.includes(todayKey) || days.length === 0) return todayKey;
    return days.reduce((latest, d) => (d > latest ? d : latest));
}

export function summarizeDay(trades: Trade[]): {
    count: number;
    netPnl: number;
    winRate: number;
    mistakeCount: number;
    writtenUp: number;
} {
    const count = trades.length;
    const wins = trades.filter(t => t.pnl > 0).length;
    return {
        count,
        netPnl: round2(trades.reduce((sum, t) => sum + t.pnl, 0)),
        winRate: count ? round2((wins / count) * 100) : 0,
        mistakeCount: trades.reduce((sum, t) => sum + (t.mistake_tag_ids?.length ?? 0), 0),
        writtenUp: trades.filter(
            t => reviewProgress(t.review_template ?? null, t.review_answers ?? {}, !!t.screenshot_url).done > 0
        ).length,
    };
}
