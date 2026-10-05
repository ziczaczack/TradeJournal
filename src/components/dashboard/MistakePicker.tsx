'use client';

import Link from 'next/link';
import type { MistakeTag } from '@/lib/mistakeTagQueries';
import { MistakeState, toggleMistake } from '@/lib/mistakeStats';

interface MistakePickerProps {
    tags: MistakeTag[];
    state: MistakeState;
    onChange: (state: MistakeState) => void;
    loadError: boolean;
}

const chip = 'px-3 py-1 rounded-full text-xs font-medium border transition-colors';

export function MistakePicker({ tags, state, onChange, loadError }: MistakePickerProps) {
    // Visible tags, plus hidden ones already on this trade so they can be removed.
    const shown = tags.filter(t => !t.is_hidden || state.tagIds.includes(t.id));
    const isClean = state.reviewed && state.tagIds.length === 0;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400 font-medium">Mistakes</label>
                <Link href="/settings/mistakes" className="text-xs text-blue-400 hover:underline">
                    Manage tags
                </Link>
            </div>
            {loadError ? (
                <p className="text-xs text-rose-400">Couldn&apos;t load mistake tags.</p>
            ) : (
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => onChange(toggleMistake(state, 'none'))}
                        className={`${chip} ${isClean
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                    >
                        No mistakes
                    </button>
                    {shown.map(tag => {
                        const active = state.tagIds.includes(tag.id);
                        return (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => onChange(toggleMistake(state, tag.id))}
                                className={`${chip} ${active
                                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                            >
                                {tag.name}
                            </button>
                        );
                    })}
                </div>
            )}
            {!state.reviewed && !loadError && (
                <p className="text-xs text-muted-foreground">Not reviewed — pick the mistakes you made, or &quot;No mistakes&quot;.</p>
            )}
        </div>
    );
}
