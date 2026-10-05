import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('./supabase', () => ({ getSupabase: () => { throw new Error('use the injected client'); } }));
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');

const { createShare, fetchSharedCard } = await import('./shareQueries');

const card = {
    kind: 'playbook' as const,
    payload: {
        v: 1 as const,
        name: 'Silver Bullet',
        timeframe: null,
        description: null,
        rules: [],
        winRateTarget: 60,
        stats: { tradeCount: 0, winRate: 0, avgResult: null },
    },
};

function insertClient(errors: ({ code: string; message: string } | null)[]) {
    const inserted: Record<string, unknown>[] = [];
    const client = {
        from: () => ({
            insert: (row: Record<string, unknown>) => {
                inserted.push(row);
                const error = errors[inserted.length - 1] ?? null;
                return {
                    select: () => ({
                        single: async () => ({ data: error ? null : { id: 's1', ...row }, error }),
                    }),
                };
            },
        }),
    } as unknown as SupabaseClient;
    return { client, inserted };
}

function rpcClient(data: unknown) {
    return { rpc: async () => ({ data, error: null }) } as unknown as SupabaseClient;
}

describe('createShare', () => {
    it('stores the card under a fresh token', async () => {
        const { client, inserted } = insertClient([null]);
        const link = await createShare('user-1', 'setup-1', card, client);
        expect(inserted[0]).toMatchObject({ user_id: 'user-1', kind: 'playbook', source_id: 'setup-1', payload: card.payload });
        expect(link.token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    });

    it('retries once with a new token on a unique violation', async () => {
        const { client, inserted } = insertClient([{ code: '23505', message: 'dup' }, null]);
        await createShare('user-1', 'setup-1', card, client);
        expect(inserted).toHaveLength(2);
        expect(inserted[0].token).not.toBe(inserted[1].token);
    });

    it('throws other errors without retrying', async () => {
        const { client, inserted } = insertClient([{ code: '42501', message: 'rls' }]);
        await expect(createShare('user-1', 'setup-1', card, client)).rejects.toMatchObject({ code: '42501' });
        expect(inserted).toHaveLength(1);
    });

    it('refuses an invalid card before touching the database', async () => {
        const { client, inserted } = insertClient([null]);
        const bad = { ...card, payload: { ...card.payload, screenshotUrl: 'https://evil.example.com/x.png' } };
        await expect(createShare('user-1', 'setup-1', bad, client)).rejects.toThrow();
        expect(inserted).toHaveLength(0);
    });
});

describe('fetchSharedCard', () => {
    it('returns null for unknown or revoked tokens', async () => {
        expect(await fetchSharedCard('nope', rpcClient(null))).toBeNull();
    });

    it('returns the validated card', async () => {
        const data = { kind: 'playbook', payload: card.payload, created_at: '2026-10-05T00:00:00Z' };
        expect(await fetchSharedCard('tok', rpcClient(data))).toEqual(card);
    });

    it('treats a tampered stored payload as unavailable', async () => {
        const data = {
            kind: 'playbook',
            payload: { ...card.payload, screenshotUrl: 'http://169.254.169.254/latest' },
            created_at: '2026-10-05T00:00:00Z',
        };
        expect(await fetchSharedCard('tok', rpcClient(data))).toBeNull();
    });
});
