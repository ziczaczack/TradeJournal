'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Trade } from '@/lib/tradeQueries';
import { fetchMistakeTags, mistakeTagsQueryKey } from '@/lib/mistakeTagQueries';
import { analyzeMistakes, MistakePeriod } from '@/lib/mistakeStats';
import { formatCurrency, formatPercent } from '@/lib/analyticsStats';

const PERIOD_LABEL: Record<MistakePeriod, string> = { month: 'this month', all: 'all time' };

export function MistakeAnalysis({ trades }: { trades: Trade[] }) {
    const [period, setPeriod] = useState<MistakePeriod>('month');
    const { data: tags = [], isError } = useQuery({
        queryKey: mistakeTagsQueryKey,
        queryFn: () => fetchMistakeTags(),
    });

    const analysis = useMemo(
        () => analyzeMistakes(trades, tags, period, new Date()),
        [trades, tags, period]
    );

    const costColor = (cost: number | null) =>
        cost === null ? 'text-muted-foreground' : cost > 0 ? 'text-rose-400' : 'text-emerald-400';

    return (
        <Card className="glass-card border-zinc-800/50">
            <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-rose-500/10">
                            <AlertTriangle className="w-4 h-4 text-rose-500" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-semibold text-white">Mistakes</CardTitle>
                            <p className="text-sm text-zinc-400">
                                {analysis.reviewedCount} of {analysis.totalCount} trades reviewed
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {(['month', 'all'] as MistakePeriod[]).map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1 rounded-md text-xs ${period === p ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
                            >
                                {p === 'month' ? 'This month' : 'All time'}
                            </button>
                        ))}
                        <Link href="/settings/mistakes" className="text-xs text-blue-400 hover:underline ml-2">
                            Manage tags
                        </Link>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {isError && <p className="text-sm text-rose-400">Couldn&apos;t load mistake tags.</p>}

                {analysis.reviewedCount === 0 ? (
                    <p className="text-sm text-zinc-400">
                        No reviewed trades {PERIOD_LABEL[period]}. Open a trade in History and tag its mistakes — or
                        mark it &quot;No mistakes&quot; — to see what your habits cost.
                    </p>
                ) : (
                    <>
                        <div>
                            {analysis.totalCost === null ? (
                                <p className="text-sm text-zinc-400">
                                    Mark trades with <span className="text-zinc-200">No mistakes</span> to compare against.
                                </p>
                            ) : (
                                <p className="text-2xl font-bold text-white">
                                    Mistakes cost you{' '}
                                    <span className={costColor(analysis.totalCost)}>{formatCurrency(analysis.totalCost)}</span>{' '}
                                    <span className="text-base font-normal text-zinc-400">{PERIOD_LABEL[period]}</span>
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                                {analysis.mistakeTradeCount} mistake trade{analysis.mistakeTradeCount === 1 ? '' : 's'} vs{' '}
                                {analysis.cleanCount} clean
                                {analysis.cleanAvgPnl !== null && ` (avg ${formatCurrency(analysis.cleanAvgPnl)})`}
                                {analysis.smallSample && analysis.cleanCount > 0 && ' · small sample — treat as rough'}
                            </p>
                        </div>

                        {analysis.rows.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                                            <th className="py-2 pr-4 font-medium">Mistake</th>
                                            <th className="py-2 pr-4 font-medium text-right">Trades</th>
                                            <th className="py-2 pr-4 font-medium text-right">Win rate</th>
                                            <th className="py-2 pr-4 font-medium text-right">Avg P&amp;L</th>
                                            <th className="py-2 pr-4 font-medium text-right">Net P&amp;L</th>
                                            <th className="py-2 font-medium text-right">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analysis.rows.map(row => (
                                            <tr key={row.tagId} className="border-t border-zinc-800/60">
                                                <td className={`py-2 pr-4 ${row.isHidden ? 'text-muted-foreground' : 'text-zinc-200'}`}>
                                                    {row.name}{row.isHidden && ' (hidden)'}
                                                </td>
                                                <td className="py-2 pr-4 text-right text-zinc-300">{row.count}</td>
                                                <td className="py-2 pr-4 text-right text-zinc-300">{formatPercent(row.winRate)}</td>
                                                <td className="py-2 pr-4 text-right text-zinc-300">{formatCurrency(row.avgPnl)}</td>
                                                <td className="py-2 pr-4 text-right text-zinc-300">{formatCurrency(row.netPnl)}</td>
                                                <td className={`py-2 text-right font-medium ${costColor(row.cost)}`}>
                                                    {row.cost === null ? '—' : formatCurrency(row.cost)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="text-xs text-muted-foreground mt-2">
                                    A trade with several mistakes counts toward each one, so rows can add up to more than the total.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
