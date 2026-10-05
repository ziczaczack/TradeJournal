'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ChevronDown, NotebookPen } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TradeDetailSheet } from '@/components/dashboard/TradeDetailSheet';
import { DayNoteEditor } from '@/components/journal/DayNoteEditor';
import { useAccount } from '@/components/providers/AccountContext';
import { useTradesForCurrentAccount } from '@/hooks/useTrades';
import { fetchDailyNote, fetchTradesForDay, journalQueryKeys } from '@/lib/journalQueries';
import type { Trade } from '@/lib/tradeQueries';
import { formatPnL } from '@/lib/tradeStats';
import { formatCurrency } from '@/lib/analyticsStats';
import {
    defaultJournalDay,
    parseDayKey,
    REVIEW_TEMPLATES,
    reviewProgress,
    shiftDay,
    summarizeDay,
} from '@/lib/tradeReview';

const UNSAVED_PROMPT = 'You have an unsaved note for this day. Leave without saving?';

function formatDayTitle(day: string): string {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
}

function formatTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function JournalContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { currentAccount, isLoading: accountLoading } = useAccount();
    const accountId = currentAccount?.id;

    // Default day needs the account's trade dates (cached list query).
    const { data: allTrades, isLoading: listLoading } = useTradesForCurrentAccount();
    const requestedDay = parseDayKey(searchParams.get('date'));
    const day = requestedDay
        ?? (listLoading || accountLoading ? null : defaultJournalDay((allTrades ?? []).map(t => t.entry_time), new Date()));

    const [noteDirty, setNoteDirty] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [sheetTrade, setSheetTrade] = useState<Trade | null>(null);

    // Warn before closing the tab with an unsaved note.
    useEffect(() => {
        if (!noteDirty) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [noteDirty]);

    const tradesQuery = useQuery({
        queryKey: journalQueryKeys.day(day ?? '', accountId),
        queryFn: () => fetchTradesForDay(day!, accountId),
        enabled: !!day && !accountLoading,
    });
    const noteQuery = useQuery({
        queryKey: journalQueryKeys.note(day ?? ''),
        queryFn: () => fetchDailyNote(day!),
        enabled: !!day,
        staleTime: Infinity,
    });

    const trades = useMemo(() => tradesQuery.data ?? [], [tradesQuery.data]);
    const summary = useMemo(() => summarizeDay(trades), [trades]);

    const goTo = (next: string) => {
        if (noteDirty && !window.confirm(UNSAVED_PROMPT)) return;
        setNoteDirty(false);
        setExpanded(new Set());
        router.replace(`/journal?date=${next}`);
    };

    const toggleExpanded = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    if (!day) {
        return <p className="text-sm text-zinc-500">Loading…</p>;
    }

    return (
        <div className="space-y-6">
            {/* Day picker */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                        <NotebookPen className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Daily journal</h1>
                        <p className="text-sm text-zinc-400">{formatDayTitle(day)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => goTo(shiftDay(day, -1))} aria-label="Previous day">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <Input
                        type="date"
                        value={day}
                        onChange={e => { const next = parseDayKey(e.target.value); if (next) goTo(next); }}
                        className="w-[160px] bg-zinc-900/50 border-zinc-700"
                    />
                    <Button variant="ghost" size="icon" onClick={() => goTo(shiftDay(day, 1))} aria-label="Next day">
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            {/* Day summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    ['Trades', String(summary.count)],
                    ['Net P&L', formatCurrency(summary.netPnl)],
                    ['Win rate', `${summary.winRate.toFixed(1)}%`],
                    ['Mistakes', String(summary.mistakeCount)],
                    ['Written up', `${summary.writtenUp} of ${summary.count}`],
                ].map(([label, value]) => (
                    <div key={label} className="glass-card p-3 rounded-xl border border-zinc-800/50">
                        <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
                        <p className="text-lg font-semibold text-white">{value}</p>
                    </div>
                ))}
            </div>

            {/* Day note */}
            <div className="glass-card p-4 rounded-xl border border-zinc-800/50">
                {noteQuery.isError ? (
                    <p className="text-sm text-rose-400">Couldn&apos;t load your note for this day.</p>
                ) : noteQuery.data === undefined ? (
                    <p className="text-sm text-zinc-500">Loading note…</p>
                ) : (
                    <DayNoteEditor key={day} day={day} initialNote={noteQuery.data} onDirtyChange={setNoteDirty} />
                )}
            </div>

            {/* Trades */}
            <div className="space-y-2">
                <h2 className="text-lg font-semibold text-white">Trades</h2>
                {tradesQuery.isError && (
                    <div className="flex items-center gap-3">
                        <p className="text-sm text-rose-400">Couldn&apos;t load this day&apos;s trades.</p>
                        <Button size="sm" variant="outline" onClick={() => tradesQuery.refetch()}>Retry</Button>
                    </div>
                )}
                {tradesQuery.isLoading && <p className="text-sm text-zinc-500">Loading trades…</p>}
                {tradesQuery.isSuccess && trades.length === 0 && (
                    <p className="text-sm text-zinc-500">No trades on this day.</p>
                )}
                {trades.map(trade => {
                    const template = trade.review_template ?? null;
                    const answers = trade.review_answers ?? {};
                    const progress = reviewProgress(template, answers, !!trade.screenshot_url);
                    const pnl = formatPnL(trade.pnl);
                    const isOpen = expanded.has(trade.id);
                    return (
                        <div key={trade.id} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40">
                            <div className="flex items-center gap-3 px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() => toggleExpanded(trade.id)}
                                    className="flex flex-1 items-center gap-3 text-left"
                                    aria-expanded={isOpen}
                                >
                                    <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                    <span className="font-semibold text-white">{trade.symbol}</span>
                                    <span className="text-xs text-zinc-500">{formatTime(trade.entry_time)}</span>
                                    <span className={`font-mono text-sm ${pnl.isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>{pnl.text}</span>
                                    <span className="text-xs text-zinc-400">
                                        {template ? `${REVIEW_TEMPLATES[template].label} ${progress.done}/${progress.total}` : 'Not written'}
                                    </span>
                                </button>
                                <Button size="sm" variant="outline" onClick={() => setSheetTrade(trade)} className="border-zinc-700">
                                    {template ? 'Edit' : 'Write'}
                                </Button>
                            </div>
                            {isOpen && (
                                <div className="border-t border-zinc-800/60 px-4 py-3 space-y-3">
                                    {!template && <p className="text-sm text-zinc-500">No write-up yet.</p>}
                                    {template && REVIEW_TEMPLATES[template].questions.map(q => (
                                        <div key={q.id}>
                                            <p className="text-xs text-zinc-500">{q.label}</p>
                                            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{answers[q.id] || '—'}</p>
                                        </div>
                                    ))}
                                    {template && REVIEW_TEMPLATES[template].includesChart && trade.screenshot_url && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={trade.screenshot_url} alt="Entry chart" className="max-h-80 rounded-lg border border-zinc-800" />
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <TradeDetailSheet
                trade={sheetTrade}
                isOpen={!!sheetTrade}
                onClose={() => setSheetTrade(null)}
                onUpdate={() => { /* the day refetches via invalidateQueries(['trades']) */ }}
            />
        </div>
    );
}

export default function JournalPage() {
    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4">
                {/* useSearchParams needs a Suspense boundary in the App Router */}
                <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
                    <JournalContent />
                </Suspense>
            </div>
        </DashboardLayout>
    );
}
