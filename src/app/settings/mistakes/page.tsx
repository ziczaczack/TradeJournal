'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, EyeOff, Pencil, Plus, Check, X } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabase } from '@/lib/supabase';
import {
    createMistakeTag,
    fetchMistakeTags,
    MISTAKE_TAG_NAME_MAX,
    MistakeTag,
    mistakeTagsQueryKey,
    nextMistakeSortOrder,
    renameMistakeTag,
    setMistakeTagHidden,
    validateMistakeTagName,
} from '@/lib/mistakeTagQueries';

export default function MistakeTagsPage() {
    const queryClient = useQueryClient();
    const { data: tags = [], isLoading, isError } = useQuery({
        queryKey: mistakeTagsQueryKey,
        queryFn: () => fetchMistakeTags(),
    });

    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = () => queryClient.invalidateQueries({ queryKey: mistakeTagsQueryKey });

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setBusy(false);
        }
    };

    const handleAdd = () => {
        const problem = validateMistakeTagName(newName, tags);
        if (problem) return setError(problem);
        run(async () => {
            const { data: { user } } = await getSupabase().auth.getUser();
            if (!user) throw new Error('Not signed in');
            await createMistakeTag(user.id, newName, nextMistakeSortOrder(tags));
            setNewName('');
        });
    };

    const handleRename = (tag: MistakeTag) => {
        const problem = validateMistakeTagName(editName, tags, tag.id);
        if (problem) return setError(problem);
        run(async () => {
            await renameMistakeTag(tag.id, editName);
            setEditingId(null);
        });
    };

    const visible = tags.filter(t => !t.is_hidden);
    const hidden = tags.filter(t => t.is_hidden);

    const renderRow = (tag: MistakeTag) => (
        <div key={tag.id} className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            {editingId === tag.id ? (
                <>
                    <Input
                        value={editName}
                        maxLength={MISTAKE_TAG_NAME_MAX}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleRename(tag)}
                        className="h-8 bg-zinc-900 border-zinc-700"
                        autoFocus
                    />
                    <Button size="icon" variant="ghost" disabled={busy} onClick={() => handleRename(tag)} aria-label="Save name">
                        <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel">
                        <X className="w-4 h-4" />
                    </Button>
                </>
            ) : (
                <>
                    <span className={`flex-1 text-sm ${tag.is_hidden ? 'text-muted-foreground' : 'text-zinc-200'}`}>{tag.name}</span>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditingId(tag.id); setEditName(tag.name); setError(null); }}
                        className="text-muted-foreground hover:text-white"
                        aria-label={`Rename ${tag.name}`}
                    >
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => run(() => setMistakeTagHidden(tag.id, !tag.is_hidden))}
                        className="text-muted-foreground hover:text-white"
                        aria-label={tag.is_hidden ? `Show ${tag.name}` : `Hide ${tag.name}`}
                    >
                        {tag.is_hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </Button>
                </>
            )}
        </div>
    );

    return (
        <DashboardLayout>
            <div className="max-w-2xl mx-auto px-4 space-y-6">
                <div className="flex items-center gap-3">
                    <Link href="/history">
                        <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Mistake tags</h1>
                        <p className="text-sm text-zinc-400">The mistakes you can tag on a trade. Hidden tags stay on old trades.</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Input
                        value={newName}
                        maxLength={MISTAKE_TAG_NAME_MAX}
                        placeholder="New mistake, e.g. Traded the news"
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        className="bg-zinc-900/50 border-zinc-700"
                    />
                    <Button onClick={handleAdd} disabled={busy} className="bg-emerald-600 hover:bg-emerald-500">
                        <Plus className="w-4 h-4 mr-2" />
                        Add
                    </Button>
                </div>

                {error && <p className="text-sm text-rose-400">{error}</p>}
                {isError && <p className="text-sm text-rose-400">Couldn&apos;t load mistake tags.</p>}
                {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

                <div className="space-y-2">{visible.map(renderRow)}</div>

                {hidden.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Hidden</p>
                        {hidden.map(renderRow)}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
