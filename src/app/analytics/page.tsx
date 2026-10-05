'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsStatsCards } from '@/components/analytics/AnalyticsStatsCards';
import { EquityCurveChart } from '@/components/analytics/EquityCurveChart';
import { SetupPerformanceChart } from '@/components/analytics/SetupPerformanceChart';
import { PsychologyImpactChart } from '@/components/analytics/PsychologyImpactChart';
import { PerformanceHeatmap } from '@/components/analytics/PerformanceHeatmap';
import { PlaybookComparisonChart } from '@/components/analytics/PlaybookComparisonChart';
import { useTradesForCurrentAccount } from '@/hooks/useTrades';
import { useComputeWithDegradation } from '@/hooks/useComputeWithDegradation';
import {
    calculateAnalyticsStats,
    generateEquityCurveData,
    generateSetupPerformanceData,
    generatePsychologyData,
    generateHeatmapData,
    formatCurrency,
    formatPercent,
    PlaybookComparison,
} from '@/lib/analyticsStats';
import { fetchPlaybookSetups } from '@/lib/playbookQueries';
import { TrendingDown, Scale, LineChart, BarChart3, Brain, TableProperties, Loader2, Download, Grid3X3, BookOpen } from 'lucide-react';
import { MistakeAnalysis } from '@/components/analytics/MistakeAnalysis';

// 空状态默认值
const DEFAULT_STATS = {
    totalNetPnL: 0,
    winRate: 0,
    profitFactor: 0,
    averageRRR: 0,
    maxDrawdown: 0,
    maxDrawdownPercent: 0,
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
};

export default function AnalyticsPage() {
    // 使用 TanStack Query 获取数据 (自动按账户过滤)
    const { data: trades = [], isLoading, error: queryError } = useTradesForCurrentAccount();
    const error = queryError ? 'Failed to load analytics data. Please check your Supabase connection.' : null;

    // 使用计算降级策略 - 大数据量时延迟计算
    const { result: stats, isComputing: isComputingStats } = useComputeWithDegradation(
        trades,
        calculateAnalyticsStats,
        DEFAULT_STATS
    );

    // 图表数据使用 useMemo 缓存
    const equityCurveData = useMemo(
        () => generateEquityCurveData(trades),
        [trades]
    );

    const setupPerformanceData = useMemo(
        () => generateSetupPerformanceData(trades),
        [trades]
    );

    const psychologyData = useMemo(
        () => generatePsychologyData(trades),
        [trades]
    );

    const heatmapData = useMemo(
        () => generateHeatmapData(trades),
        [trades]
    );

    // Playbook comparison - fetches playbook setups and cross-references live trades
    const [playbookComparison, setPlaybookComparison] = useState<PlaybookComparison[]>([]);
    useEffect(() => {
        if (trades.length === 0) return;
        fetchPlaybookSetups().then(setups => {
            const liveSetupMap = new Map<string, { wins: number; total: number }>();
            for (const t of trades) {
                if (!t.setup_type) continue;
                const s = liveSetupMap.get(t.setup_type) || { wins: 0, total: 0 };
                s.total += 1;
                if ((t.pnl || 0) > 0) s.wins += 1;
                liveSetupMap.set(t.setup_type, s);
            }
            const comparison: PlaybookComparison[] = setups.map(setup => {
                const live = liveSetupMap.get(setup.name) || { wins: 0, total: 0 };
                return {
                    setupName: setup.name,
                    targetWinRate: setup.win_rate_target,
                    actualWinRate: live.total > 0 ? (live.wins / live.total) * 100 : 0,
                    tradeCount: live.total,
                };
            });
            setPlaybookComparison(comparison.filter(c => c.tradeCount > 0 || true)); // show all setups
        }).catch(console.error);
    }, [trades]);

    // CSV Export
    const handleExportCSV = useCallback(() => {
        if (trades.length === 0) return;
        const headers = ['symbol', 'entry_time', 'exit_time', 'pnl', 'setup_type', 'psychology_tag', 'rating', 'notes', 'duration'];
        const rows = trades.map(t => [
            t.symbol ?? '',
            t.entry_time ?? '',
            t.exit_time ?? '',
            t.pnl ?? 0,
            t.setup_type ?? '',
            t.psychology_tag ?? '',
            t.rating ?? '',
            (t.notes ?? '').replace(/,/g, ';').replace(/\n/g, ' '),
            t.duration ?? '',
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-journal-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [trades]);

    // 显示计算中状态
    const showComputingOverlay = isComputingStats && trades.length > 2000;

    return (
        <DashboardLayout>
            {/* Page Header */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8 flex items-center justify-between"
            >
                <div>
                    <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">
                        Trading Analytics
                    </h2>
                    <p className="text-zinc-400">
                        Deep dive into your trading performance with comprehensive statistics and visualizations.
                        {trades.length > 2000 && (
                            <span className="ml-2 text-blue-400">
                                ({trades.length.toLocaleString()} trades)
                            </span>
                        )}
                    </p>
                </div>
                {!isLoading && trades.length > 0 && (
                    <Button
                        onClick={handleExportCSV}
                        variant="outline"
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </Button>
                )}
            </motion.div>

            {/* Error State */}
            {error && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 p-4 glass-card border-rose-500/30 text-rose-400"
                >
                    {error}
                </motion.div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="flex items-center justify-center py-20">
                    <div className="text-center">
                        <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-zinc-400">Loading analytics...</p>
                    </div>
                </div>
            )}

            {/* Computing Overlay for Large Datasets */}
            {showComputingOverlay && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm z-40 flex items-center justify-center"
                >
                    <div className="glass-card p-8 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-white font-medium">Processing {trades.length.toLocaleString()} trades...</p>
                        <p className="text-zinc-400 text-sm mt-1">This may take a moment for large datasets</p>
                    </div>
                </motion.div>
            )}

            {/* Content */}
            {!isLoading && !error && (
                <div className="space-y-8">
                    {/* Stats Cards */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <AnalyticsStatsCards stats={stats} />
                    </motion.div>

                    {/* Max Drawdown and RRR Cards */}
                    {stats.maxDrawdown > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                            <Card className="glass-card hover-lift">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-zinc-400">
                                        Max Drawdown
                                    </CardTitle>
                                    <div className="p-2 rounded-lg bg-rose-500/10">
                                        <TrendingDown className="w-4 h-4 text-rose-500" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-rose-400">
                                        {formatCurrency(-stats.maxDrawdown)}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        {formatPercent(stats.maxDrawdownPercent)} from peak
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="glass-card hover-lift">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium text-zinc-400">
                                        Average RRR
                                    </CardTitle>
                                    <div className="p-2 rounded-lg bg-blue-500/10">
                                        <Scale className="w-4 h-4 text-blue-500" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className={`text-2xl font-bold ${stats.averageRRR >= 1 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                        {stats.averageRRR.toFixed(2)}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">
                                        Risk to Reward Ratio
                                    </p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* Equity Curve - Full Width */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Card className="glass-card">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-emerald-500/10">
                                        <LineChart className="w-4 h-4 text-emerald-500" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-semibold text-white">
                                            Equity Curve
                                        </CardTitle>
                                        <p className="text-sm text-zinc-400">
                                            Cumulative profit/loss over time
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <EquityCurveChart data={equityCurveData} />
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Setup Performance and Psychology Impact */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Setup Performance */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                        >
                            <Card className="glass-card h-full">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-blue-500/10">
                                            <BarChart3 className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-semibold text-white">
                                                Setup Performance
                                            </CardTitle>
                                            <p className="text-sm text-zinc-400">
                                                Win rate and PnL by trading setup
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <SetupPerformanceChart data={setupPerformanceData} />
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Psychology Impact */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <Card className="glass-card h-full">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-purple-500/10">
                                            <Brain className="w-4 h-4 text-purple-500" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-semibold text-white">
                                                Psychology Impact
                                            </CardTitle>
                                            <p className="text-sm text-zinc-400">
                                                PnL distribution by mental state
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <PsychologyImpactChart data={psychologyData} />
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>

                    {/* Mistakes */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <MistakeAnalysis trades={trades} />
                    </motion.div>

                    {/* Performance Summary Table */}
                    {setupPerformanceData.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                        >
                            <Card className="glass-card">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-amber-500/10">
                                            <TableProperties className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <CardTitle className="text-lg font-semibold text-white">
                                            Setup Summary
                                        </CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-zinc-800">
                                                    <th className="text-left py-3 px-4 text-zinc-400 font-medium">Setup Type</th>
                                                    <th className="text-right py-3 px-4 text-zinc-400 font-medium">Trades</th>
                                                    <th className="text-right py-3 px-4 text-zinc-400 font-medium">Win Rate</th>
                                                    <th className="text-right py-3 px-4 text-zinc-400 font-medium">Net PnL</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {setupPerformanceData.map((setup) => (
                                                    <tr key={setup.setupType} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                                                        <td className="py-3 px-4 text-white font-medium">{setup.setupType}</td>
                                                        <td className="py-3 px-4 text-right text-zinc-300">{setup.totalTrades}</td>
                                                        <td className={`py-3 px-4 text-right ${setup.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                                                            {formatPercent(setup.winRate)}
                                                        </td>
                                                        <td className={`py-3 px-4 text-right font-medium ${setup.netPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            {formatCurrency(setup.netPnL)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* Performance Heatmap */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 }}
                    >
                        <Card className="glass-card">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-lg bg-violet-500/10">
                                        <Grid3X3 className="w-4 h-4 text-violet-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg font-semibold text-white">
                                            Performance Heatmap
                                        </CardTitle>
                                        <p className="text-sm text-zinc-400">
                                            Avg PnL by day &amp; hour — find your Golden Hours
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <PerformanceHeatmap data={heatmapData} />
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Playbook Win Rate Comparison */}
                    {playbookComparison.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            <Card className="glass-card">
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-emerald-500/10">
                                            <BookOpen className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-semibold text-white">
                                                Playbook vs. Reality
                                            </CardTitle>
                                            <p className="text-sm text-zinc-400">
                                                Target win rate (blue) vs. actual win rate (green/red) per setup
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <PlaybookComparisonChart data={playbookComparison} />
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                </div>
            )}

            {/* Empty State */}
            {!isLoading && !error && trades.length === 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-20"
                >
                    <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="w-8 h-8 text-zinc-500" />
                    </div>
                    <h3 className="text-xl font-medium text-white mb-2">No trades yet</h3>
                    <p className="text-zinc-400 mb-6">
                        Import your first trades to start tracking your performance.
                    </p>
                    <Link href="/">
                        <Button className="bg-blue-600 hover:bg-blue-700 btn-scale">
                            Go to Import Page
                        </Button>
                    </Link>
                </motion.div>
            )}
        </DashboardLayout>
    );
}
