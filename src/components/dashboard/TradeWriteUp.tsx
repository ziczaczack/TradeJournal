'use client';

import { Textarea } from '@/components/ui/textarea';
import {
    MAX_ANSWER_LENGTH,
    REVIEW_TEMPLATES,
    ReviewAnswers,
    ReviewTemplate,
    reviewProgress,
} from '@/lib/tradeReview';

interface TradeWriteUpProps {
    /** null = not written yet; shown as Basic until the user types or picks. */
    template: ReviewTemplate | null;
    answers: ReviewAnswers;
    hasScreenshot: boolean;
    onChange: (template: ReviewTemplate, answers: ReviewAnswers) => void;
}

export function TradeWriteUp({ template, answers, hasScreenshot, onChange }: TradeWriteUpProps) {
    const shown: ReviewTemplate = template ?? 'basic';
    const def = REVIEW_TEMPLATES[shown];
    const progress = reviewProgress(shown, answers, hasScreenshot);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm text-zinc-400 font-medium">
                    Write-up{' '}
                    <span className="text-xs text-zinc-500">
                        {template ? `${progress.done}/${progress.total}` : 'not written'}
                    </span>
                </label>
                <div className="flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
                    {(['full', 'basic'] as ReviewTemplate[]).map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => onChange(t, answers)}
                            className={`px-3 py-1 ${shown === t ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            {REVIEW_TEMPLATES[t].label}
                        </button>
                    ))}
                </div>
            </div>

            {def.questions.map(q => (
                <div key={q.id} className="space-y-1">
                    <p className="text-xs text-zinc-400">{q.label}</p>
                    <Textarea
                        value={answers[q.id] ?? ''}
                        maxLength={MAX_ANSWER_LENGTH}
                        onChange={e => onChange(shown, { ...answers, [q.id]: e.target.value })}
                        className="bg-zinc-900/50 border-zinc-700/50 min-h-[64px] focus:ring-blue-500/30 focus:border-zinc-600 resize-none"
                    />
                </div>
            ))}

            {def.includesChart && (
                <p className={`text-xs ${hasScreenshot ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    Entry chart: {hasScreenshot
                        ? 'screenshot attached.'
                        : 'upload your chart above, marking entry, target and stop.'}
                </p>
            )}
        </div>
    );
}
