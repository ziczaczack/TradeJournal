'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { getSupabase } from '@/lib/supabase';
import { journalQueryKeys, saveDailyNote } from '@/lib/journalQueries';
import { MAX_DAY_NOTE_LENGTH } from '@/lib/tradeReview';
import { draftKey, DraftStorage, loadDraft, storeDraft } from '@/lib/journalDraft';

function browserStorage(): DraftStorage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
}

interface DayNoteEditorProps {
    userId: string;
    day: string;
    initialNote: string;
    onDirtyChange: (dirty: boolean) => void;
}

/** Mount with key={day} so the draft resets per day without an effect. */
export function DayNoteEditor({ userId, day, initialNote, onDirtyChange }: DayNoteEditorProps) {
    const queryClient = useQueryClient();
    const key = draftKey(userId, day);
    // Restore text typed earlier but never saved (left the page, switched account, ...).
    const [restored] = useState(() => loadDraft(browserStorage(), key, initialNote));
    const [draft, setDraft] = useState(restored ?? initialNote);
    const [saved, setSaved] = useState(initialNote);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dirty = draft !== saved;

    // Report a restored draft as unsaved, and never leave the parent thinking
    // there's an unsaved note after this editor goes away.
    useEffect(() => {
        onDirtyChange(restored !== null);
        return () => onDirtyChange(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = (value: string) => {
        setDraft(value);
        onDirtyChange(value !== saved);
        storeDraft(browserStorage(), key, value, saved);
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const { data: { user } } = await getSupabase().auth.getUser();
            if (!user) throw new Error('Not signed in');
            const note = draft.trim();
            await saveDailyNote(user.id, day, note);
            setDraft(note);
            setSaved(note);
            onDirtyChange(false);
            storeDraft(browserStorage(), key, note, note);
            queryClient.setQueryData(journalQueryKeys.note(day), note);
        } catch {
            setError('Couldn’t save your note. Your text is still here — try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-300">What did I do today?</label>
                {dirty && (
                    <span className="text-xs text-amber-400">
                        {restored !== null && draft === restored ? 'Unsaved draft restored' : 'Unsaved'}
                    </span>
                )}
            </div>
            <Textarea
                value={draft}
                maxLength={MAX_DAY_NOTE_LENGTH}
                onChange={e => handleChange(e.target.value)}
                placeholder="How did the session go? What did you notice about yourself?"
                className="bg-zinc-900/50 border-zinc-700/50 min-h-[110px] resize-none"
            />
            <div className="flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving || !dirty} className="bg-blue-600 hover:bg-blue-500">
                    {saving ? 'Saving…' : 'Save note'}
                </Button>
                {error && <p className="text-sm text-rose-400">{error}</p>}
            </div>
        </div>
    );
}
