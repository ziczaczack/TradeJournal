// Day math is local-time; pin a DST-observing zone so results are deterministic.
process.env.TZ = 'America/New_York';

import { describe, it, expect } from 'vitest';
import { makeTrade } from './__fixtures__/trades';
import {
    cleanAnswers,
    defaultJournalDay,
    localDayBounds,
    MAX_ANSWER_LENGTH,
    parseDayKey,
    REVIEW_TEMPLATES,
    reviewProgress,
    shiftDay,
    summarizeDay,
    toDayKey,
    writeUpToSave,
} from './tradeReview';

describe('REVIEW_TEMPLATES', () => {
    it('has unique question ids that do not overlap between templates', () => {
        const full = REVIEW_TEMPLATES.full.questions.map(q => q.id);
        const basic = REVIEW_TEMPLATES.basic.questions.map(q => q.id);
        expect(new Set(full).size).toBe(6);
        expect(new Set(basic).size).toBe(2);
        expect(full.filter(id => basic.includes(id))).toEqual([]);
        expect(REVIEW_TEMPLATES.full.includesChart).toBe(true);
        expect(REVIEW_TEMPLATES.basic.includesChart).toBe(false);
    });
});

describe('reviewProgress', () => {
    it('counts Full answers plus the chart, out of 7', () => {
        expect(reviewProgress('full', { entry_reason: 'x', stop_reason: 'y' }, true)).toEqual({ done: 3, total: 7 });
        expect(reviewProgress('full', { entry_reason: 'x' }, false)).toEqual({ done: 1, total: 7 });
    });

    it('counts Basic answers out of 2, ignoring blanks and the other template', () => {
        expect(reviewProgress('basic', { standout: 'x', redo: '   ', entry_reason: 'z' }, true)).toEqual({ done: 1, total: 2 });
    });

    it('is 0/0 when no template is chosen', () => {
        expect(reviewProgress(null, { standout: 'x' }, true)).toEqual({ done: 0, total: 0 });
    });
});

describe('cleanAnswers', () => {
    it('trims, drops empties, non-strings and unknown keys, caps length, keeps both templates', () => {
        const cleaned = cleanAnswers({
            entry_reason: '  sweep  ',
            standout: 'x'.repeat(MAX_ANSWER_LENGTH + 50),
            redo: '   ',
            advice: 42,
            bogus: 'nope',
        });
        expect(cleaned).toEqual({ entry_reason: 'sweep', standout: 'x'.repeat(MAX_ANSWER_LENGTH) });
    });
});

describe('writeUpToSave', () => {
    it('keeps an untouched write-up unwritten', () => {
        expect(writeUpToSave(null, {})).toEqual({ review_template: null, review_answers: {} });
    });

    it('saves the template with cleaned answers', () => {
        expect(writeUpToSave('basic', { standout: ' a ', redo: '' })).toEqual({
            review_template: 'basic',
            review_answers: { standout: 'a' },
        });
    });

    it('keeps the other template\'s answers when switched', () => {
        expect(writeUpToSave('basic', { entry_reason: 'kept', standout: 'b' }).review_answers)
            .toEqual({ entry_reason: 'kept', standout: 'b' });
    });
});

describe('day keys', () => {
    it('formats and parses local YYYY-MM-DD', () => {
        expect(toDayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
        expect(parseDayKey('2026-10-05')).toBe('2026-10-05');
    });

    it('rejects garbage and impossible dates', () => {
        for (const bad of ['banana', '2026-02-30', '2026-13-01', '', null, undefined, '2026-1-5']) {
            expect(parseDayKey(bad)).toBeNull();
        }
    });

    it('shifts across month and year ends', () => {
        expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01');
        expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
    });
});

describe('localDayBounds', () => {
    it('spans local midnight to the next local midnight', () => {
        expect(localDayBounds('2026-10-05')).toEqual({
            start: '2026-10-05T04:00:00.000Z',
            end: '2026-10-06T04:00:00.000Z',
        });
    });

    it('handles a 23-hour DST day and tiles with the next day', () => {
        const day = localDayBounds('2026-03-08');
        expect(day).toEqual({ start: '2026-03-08T05:00:00.000Z', end: '2026-03-09T04:00:00.000Z' });
        expect(localDayBounds('2026-03-09').start).toBe(day.end);
    });
});

describe('defaultJournalDay', () => {
    const today = new Date(2026, 9, 5, 15, 0);

    it('is today when there are trades today', () => {
        expect(defaultJournalDay([new Date(2026, 9, 5, 9, 30).toISOString()], today)).toBe('2026-10-05');
    });

    it('is the latest earlier trading day otherwise', () => {
        const times = [new Date(2026, 9, 1, 9).toISOString(), new Date(2026, 9, 2, 9).toISOString(), null];
        expect(defaultJournalDay(times, today)).toBe('2026-10-02');
    });

    it('is today when there are no trades', () => {
        expect(defaultJournalDay([], today)).toBe('2026-10-05');
    });
});

describe('summarizeDay', () => {
    it('summarizes count, P&L, win rate, mistakes and write-ups', () => {
        const trades = [
            makeTrade({ pnl: 100, mistake_tag_ids: ['a', 'b'], review_template: 'basic', review_answers: { standout: 'x' } }),
            makeTrade({ pnl: -40.5, mistake_tag_ids: [], review_template: 'full', review_answers: {} }),
            makeTrade({ pnl: 0 }),
        ];
        expect(summarizeDay(trades)).toEqual({ count: 3, netPnl: 59.5, winRate: 33.33, mistakeCount: 2, writtenUp: 1 });
    });

    it('handles an empty day', () => {
        expect(summarizeDay([])).toEqual({ count: 0, netPnl: 0, winRate: 0, mistakeCount: 0, writtenUp: 0 });
    });
});
