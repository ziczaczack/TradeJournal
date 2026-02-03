'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsStatsCards } from '@/components/analytics/AnalyticsStatsCards';
import { EquityCurveChart } from '@/components/analytics/EquityCurveChart';
import { SetupPerformanceChart } from '@/components/analytics/SetupPerformanceChart';
import { PsychologyImpactChart } from '@/components/analytics/PsychologyImpactChart';
import { AIMentorInsights } from '@/components/analytics/AIMentorInsights';
import { fetchTrades, Trade } from '@/lib/tradeQueries';
import {
    calculateAnalyticsStats,
    generateEquityCurveData,
    generateSetupPerformanceData,
    generatePsychologyData,
    AnalyticsStats,
    EquityCurvePoint,
    SetupPerformance,
    PsychologyBreakdown,
    formatCurrency,
    formatPercent,
} from '@/lib/analyticsStats';
import { TrendingDown, Scale, LineChart, BarChart3, Brain, TableProperties } from 'lucide-react';

export default function AnalyticsPage() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [stats, setStats] = useState<AnalyticsStats | null>(null);
    const [equityCurveData, setEquityCurveData] = useState<EquityCurvePoint[]>([]);
    const [setupPerformanceData, setSetupPerformanceData] = useState<SetupPerformance[]>([]);
    const [psychologyData, setPsychologyData] = useState<PsychologyBreakdown[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch and process data
    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const tradesData = await fetchTrades();
            setTrades(tradesData);

            // Calculate all statistics and chart data
            setStats(calculateAnalyticsStats(tradesData));
            setEquityCurveData(generateEquityCurveData(tradesData));
            setSetupPerformanceData(generateSetupPerformanceData(tradesData));
            setPsychologyData(generatePsychologyData(tradesData));
        } catch (err) {
            console.error('Failed to load analytics data:', err);
            setError('Failed to load analytics data. Please check your Supabase connection.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    return (
        <DashboardLayout>
            {/* Page Header */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8"
            >
                <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">
                    Trading Analytics
                </h2>
                <p className="text-zinc-400">
                    Deep dive into your trading performance with comprehensive statistics and visualizations.
                </p>
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

            {/* Content */}
            {!isLoading && !error && (
                <div className="space-y-8">
                    {/* Stats Cards */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        {stats && <AnalyticsStatsCards stats={stats} />}
                    </motion.div>

                    {/* Max Drawdown and RRR Cards */}
                    {stats && stats.maxDrawdown > 0 && (
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

                    {/* AI Mentor Insights Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <AIMentorInsights trades={trades} />
                    </motion.div>
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
