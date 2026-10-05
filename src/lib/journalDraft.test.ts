import { describe, it, expect } from 'vitest';
import { draftKey, loadDraft, storeDraft, DraftStorage } from './journalDraft';

function memoryStorage(): DraftStorage & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return {
        data,
        getItem: k => data.get(k) ?? null,
        setItem: (k, v) => { data.set(k, v); },
        removeItem: k => { data.delete(k); },
    };
}

const KEY = draftKey('user-1', '2026-10-05');

describe('journal note drafts', () => {
    it('keys drafts by user and day', () => {
        expect(KEY).toBe('journal-note-draft:user-1:2026-10-05');
        expect(draftKey('user-2', '2026-10-05')).not.toBe(KEY);
    });

    it('keeps an unsaved draft so leaving the page does not lose it', () => {
        const storage = memoryStorage();
        storeDraft(storage, KEY, 'half-written thought', 'saved note');
        expect(loadDraft(storage, KEY, 'saved note')).toBe('half-written thought');
    });

    it('drops the draft once it matches the saved note', () => {
        const storage = memoryStorage();
        storeDraft(storage, KEY, 'typing', '');
        storeDraft(storage, KEY, 'final', 'final');
        expect(storage.data.size).toBe(0);
        expect(loadDraft(storage, KEY, 'final')).toBeNull();
    });

    it('ignores and clears a stale draft equal to the saved note', () => {
        const storage = memoryStorage();
        storage.setItem(KEY, 'same');
        expect(loadDraft(storage, KEY, 'same')).toBeNull();
        expect(storage.data.size).toBe(0);
    });

    it('survives storage being unavailable or throwing', () => {
        const throwing: DraftStorage = {
            getItem: () => { throw new Error('blocked'); },
            setItem: () => { throw new Error('quota'); },
            removeItem: () => { throw new Error('blocked'); },
        };
        expect(() => storeDraft(throwing, KEY, 'x', '')).not.toThrow();
        expect(loadDraft(throwing, KEY, '')).toBeNull();
        expect(loadDraft(null, KEY, '')).toBeNull();
        expect(() => storeDraft(null, KEY, 'x', '')).not.toThrow();
    });
});
