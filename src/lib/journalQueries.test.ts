process.env.TZ = 'America/New_York';

import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('./supabase', () => ({ getSupabase: () => { throw new Error('use the injected client'); } }));

const { fetchDailyNote, fetchTradesForDay, journalQueryKeys, saveDailyNote } = await import('./journalQueries');

/** Records every builder call; resolves to `result` when awaited. */
function recordingClient(result: { data?: unknown; error?: unknown }) {
    const calls: [string, ...unknown[]][] = [];
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'gte', 'lt', 'eq', 'order', 'maybeSingle', 'upsert']) {
        builder[method] = (...args: unknown[]) => {
            calls.push([method, ...args]);
            return builder;
        };
    }
    builder.then = (resolve: (v: unknown) => void) => resolve({ data: null, error: null, ...result });
    const client = {
        from: (table: string) => {
            calls.push(['from', table]);
            return builder;
        },
    } as unknown as SupabaseClient;
    return { client, calls };
}

describe('journalQueryKeys', () => {
    it('keeps day trades under the trades key so trade saves refresh them', () => {
        expect(journalQueryKeys.day('2026-10-05', 'acct')[0]).toBe('trades');
    });
});

describe('fetchTradesForDay', () => {
    it('loads full rows inside the local day, oldest first, for the account', async () => {
        const rows = [{ id: 't1' }];
        const { client, calls } = recordingClient({ data: rows });
        expect(await fetchTradesForDay('2026-10-05', 'acct', client)).toEqual(rows);
        expect(calls).toEqual([
            ['from', 'trading_journal'],
            ['select', '*'],
            ['gte', 'entry_time', '2026-10-05T04:00:00.000Z'],
            ['lt', 'entry_time', '2026-10-06T04:00:00.000Z'],
            ['order', 'entry_time', { ascending: true }],
            ['eq', 'account_id', 'acct'],
        ]);
    });

    it('omits the account filter when none is given', async () => {
        const { client, calls } = recordingClient({ data: [] });
        await fetchTradesForDay('2026-10-05', undefined, client);
        expect(calls.some(c => c[0] === 'eq')).toBe(false);
    });
});

describe('daily note', () => {
    it('returns an empty note when there is none', async () => {
        const { client, calls } = recordingClient({ data: null });
        expect(await fetchDailyNote('2026-10-05', client)).toBe('');
        expect(calls).toContainEqual(['eq', 'note_date', '2026-10-05']);
    });

    it('returns the stored note', async () => {
        const { client } = recordingClient({ data: { note: 'Stayed patient.' } });
        expect(await fetchDailyNote('2026-10-05', client)).toBe('Stayed patient.');
    });

    it('upserts on (user_id, note_date)', async () => {
        const { client, calls } = recordingClient({});
        await saveDailyNote('u1', '2026-10-05', 'Good day', client);
        expect(calls).toContainEqual([
            'upsert',
            { user_id: 'u1', note_date: '2026-10-05', note: 'Good day' },
            { onConflict: 'user_id,note_date' },
        ]);
    });

    it('throws on error', async () => {
        const { client } = recordingClient({ error: { message: 'rls' } });
        await expect(saveDailyNote('u1', '2026-10-05', 'x', client)).rejects.toMatchObject({ message: 'rls' });
    });
});
