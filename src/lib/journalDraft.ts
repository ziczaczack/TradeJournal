// Unsaved day-note drafts kept in the browser, so leaving the journal page by
// any route (nav link, Back, account switch, sign-out) never loses typed text.
// The draft is restored next time that user opens that day.

export interface DraftStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export function draftKey(userId: string, day: string): string {
    return `journal-note-draft:${userId}:${day}`;
}

/** The unsaved draft for this key, or null if there is none (or it matches the saved note). */
export function loadDraft(storage: DraftStorage | null, key: string, savedNote: string): string | null {
    if (!storage) return null;
    try {
        const draft = storage.getItem(key);
        if (draft === null) return null;
        if (draft === savedNote) {
            storage.removeItem(key);
            return null;
        }
        return draft;
    } catch {
        return null;
    }
}

/** Keep the draft while it differs from the saved note; drop it once they match. */
export function storeDraft(storage: DraftStorage | null, key: string, draft: string, savedNote: string): void {
    if (!storage) return;
    try {
        if (draft === savedNote) storage.removeItem(key);
        else storage.setItem(key, draft);
    } catch {
        // Storage blocked or full: the in-page draft still works, it just won't survive navigation.
    }
}
