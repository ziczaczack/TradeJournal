import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('./supabase', () => ({ getSupabase: () => { throw new Error('use the injected client'); } }));

const {
    createMistakeTag,
    DUPLICATE_TAG_MESSAGE,
    fetchMistakeTags,
    nextMistakeSortOrder,
    renameMistakeTag,
    validateMistakeTagName,
} = await import('./mistakeTagQueries');

const tag = (id: string, name: string, sort_order = 0) => ({
    id, user_id: 'u1', name, sort_order, is_hidden: false, created_at: '',
});

describe('validateMistakeTagName', () => {
    const existing = [tag('a', 'Oversized'), tag('b', 'Moved stop')];

    it('accepts a new trimmed name', () => {
        expect(validateMistakeTagName('  Late entry  ', existing)).toBeNull();
    });

    it('rejects empty and over-long names', () => {
        expect(validateMistakeTagName('   ', existing)).toBe('Name is required');
        expect(validateMistakeTagName('x'.repeat(41), existing)).toBe('Name must be 40 characters or fewer');
    });

    it('rejects duplicates case-insensitively', () => {
        expect(validateMistakeTagName('oversized', existing)).toBe(DUPLICATE_TAG_MESSAGE);
    });

    it('allows renaming a tag to its own name in a different case', () => {
        expect(validateMistakeTagName('OVERSIZED', existing, 'a')).toBeNull();
    });
});

describe('nextMistakeSortOrder', () => {
    it('appends after the highest sort order', () => {
        expect(nextMistakeSortOrder([tag('a', 'A', 3), tag('b', 'B', 7)])).toBe(8);
        expect(nextMistakeSortOrder([])).toBe(0);
    });
});

describe('fetchMistakeTags', () => {
    it('seeds defaults via the RPC before selecting', async () => {
        const order: string[] = [];
        const rows = [tag('a', 'Moved stop')];
        const chain = {
            order: () => chain,
            then: (resolve: (v: unknown) => void) => { order.push('select'); resolve({ data: rows, error: null }); },
        };
        const client = {
            rpc: async (fn: string) => { order.push(`rpc:${fn}`); return { error: null }; },
            from: () => ({ select: () => chain }),
        } as unknown as SupabaseClient;

        expect(await fetchMistakeTags(client)).toEqual(rows);
        expect(order).toEqual(['rpc:ensure_default_mistake_tags', 'select']);
    });
});

function writeClient(error: { code: string; message: string } | null) {
    const writes: Record<string, unknown>[] = [];
    const result = { data: error ? null : { id: 'new', name: 'X' }, error };
    const client = {
        from: () => ({
            insert: (row: Record<string, unknown>) => {
                writes.push(row);
                return { select: () => ({ single: async () => result }) };
            },
            update: (row: Record<string, unknown>) => {
                writes.push(row);
                return { eq: async () => ({ error }) };
            },
        }),
    } as unknown as SupabaseClient;
    return { client, writes };
}

describe('createMistakeTag / renameMistakeTag', () => {
    it('inserts a trimmed name at the given sort order', async () => {
        const { client, writes } = writeClient(null);
        await createMistakeTag('u1', '  Late entry ', 8, client);
        expect(writes[0]).toEqual({ user_id: 'u1', name: 'Late entry', sort_order: 8 });
    });

    it('maps a unique violation to the friendly duplicate message', async () => {
        const dup = { code: '23505', message: 'duplicate key' };
        await expect(createMistakeTag('u1', 'Oversized', 1, writeClient(dup).client))
            .rejects.toThrow(DUPLICATE_TAG_MESSAGE);
        await expect(renameMistakeTag('a', 'Oversized', writeClient(dup).client))
            .rejects.toThrow(DUPLICATE_TAG_MESSAGE);
    });
});
