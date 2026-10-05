import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown>;

// Minimal in-memory stand-in for the checklist_templates table. Each awaited
// query yields to the event loop first, like a real network round trip.
const table: Row[] = [];
let nextId = 1;

function query() {
    const filters: ((row: Row) => boolean)[] = [];
    let pendingInsert: Row | null = null;
    let pendingUpdate: Row | null = null;

    const run = async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
        if (pendingInsert) {
            const row = { id: `t${nextId++}`, is_active: true, ...pendingInsert };
            table.push(row);
            return { data: row, error: null };
        }
        const matches = table.filter(row => filters.every(f => f(row)));
        if (pendingUpdate) {
            matches.forEach(row => Object.assign(row, pendingUpdate));
        }
        return { data: matches, error: null };
    };

    const builder = {
        select: () => builder,
        order: () => builder,
        single: () => builder,
        eq: (column: string, value: unknown) => {
            filters.push(row => row[column] === value);
            return builder;
        },
        or: (expr: string) => {
            const accountId = /account_id\.eq\.([^,]+)/.exec(expr)?.[1];
            filters.push(row => row.account_id === accountId || row.account_id == null);
            return builder;
        },
        insert: (row: Row) => {
            pendingInsert = row;
            return builder;
        },
        update: (patch: Row) => {
            pendingUpdate = patch;
            return builder;
        },
        then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
            run().then(resolve, reject),
    };
    return builder;
}

vi.mock('./supabase', () => ({
    getSupabase: () => ({ from: () => query() }),
}));

const { ensureTemplatesExist, fetchChecklistTemplates, deleteChecklistTemplate } = await import(
    './checklistQueries'
);

describe('deleteChecklistTemplate', () => {
    beforeEach(() => {
        table.length = 0;
        nextId = 1;
    });

    it('removes the template from the fetched list (checklist page and editor)', async () => {
        await ensureTemplatesExist('user-1');
        const [first] = await fetchChecklistTemplates();
        await deleteChecklistTemplate(first.id);

        const remaining = await fetchChecklistTemplates();
        expect(remaining).toHaveLength(12);
        expect(remaining.map(t => t.id)).not.toContain(first.id);
    });
});

describe('ensureTemplatesExist', () => {
    beforeEach(() => {
        table.length = 0;
        nextId = 1;
    });

    it('seeds the defaults once', async () => {
        await ensureTemplatesExist('user-1');
        expect(await fetchChecklistTemplates()).toHaveLength(13);
    });

    it('does not seed twice when called concurrently (e.g. StrictMode double effect)', async () => {
        await Promise.all([
            ensureTemplatesExist('user-1', 'acct-1'),
            ensureTemplatesExist('user-1', 'acct-1'),
        ]);
        expect(await fetchChecklistTemplates('acct-1')).toHaveLength(13);
    });

    it('does not reseed when templates already exist', async () => {
        await ensureTemplatesExist('user-1');
        await ensureTemplatesExist('user-1');
        expect(await fetchChecklistTemplates()).toHaveLength(13);
    });
});
