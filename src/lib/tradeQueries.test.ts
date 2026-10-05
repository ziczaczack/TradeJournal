import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('./supabase', () => ({ getSupabase: () => { throw new Error('use the injected client'); } }));

const { fetchTradeById } = await import('./tradeQueries');

function fakeClient(row: unknown, error: unknown = null) {
    const calls: { select?: string; eq?: [string, unknown] } = {};
    const client = {
        from: () => ({
            select: (cols: string) => {
                calls.select = cols;
                return {
                    eq: (col: string, val: unknown) => {
                        calls.eq = [col, val];
                        return { single: async () => ({ data: row, error }) };
                    },
                };
            },
        }),
    } as unknown as SupabaseClient;
    return { client, calls };
}

describe('fetchTradeById', () => {
    it('loads every column for one trade, so the review form never saves blanks over stored notes', async () => {
        const row = { id: 't1', symbol: 'NQ', pnl: 10, trade_id: 'k', notes: 'kept', screenshot_url: 'https://x/y.png' };
        const { client, calls } = fakeClient(row);
        expect(await fetchTradeById('t1', client)).toEqual(row);
        expect(calls.select).toBe('*');
        expect(calls.eq).toEqual(['id', 't1']);
    });

    it('throws on error', async () => {
        const { client } = fakeClient(null, { message: 'nope' });
        await expect(fetchTradeById('t1', client)).rejects.toMatchObject({ message: 'nope' });
    });
});
