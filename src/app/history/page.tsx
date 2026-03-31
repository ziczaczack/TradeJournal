'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { TradeList } from '@/components/dashboard/TradeList';
import { TradeDetailSheet } from '@/components/dashboard/TradeDetailSheet';
import { SkeletonStatsGrid, SkeletonTradeList } from '@/components/ui/Skeleton';
import { Trade } from '@/lib/tradeQueries';
import { calculateStats, TradeStats } from '@/lib/tradeStats';
import { useTradesForCurrentAccount, useFilterOptions, useInvalidateTrades } from '@/hooks/useTrades';
import { ListFilter, RefreshCw } from 'lucide-react';

export default function HistoryPage() {
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // 使用 TanStack Query 获取数据 (自动按账户过滤)
    const { data: trades = [], isLoading: isLoadingTrades, error: tradesError, refetch } = useTradesForCurrentAccount();
    const { data: filterOptions, isLoading: isLoadingFilters } = useFilterOptions();
    const invalidateTrades = useInvalidateTrades();

    const isLoading = isLoadingTrades || isLoadingFilters;
    const error = tradesError ? 'Failed to load trades. Please check your Supabase connection.' : null;

    // 使用 useMemo 缓存统计计算
    const stats = useMemo<TradeStats | null>(() => {
        if (trades.length === 0) return null;
        return calculateStats(trades);
    }, [trades]);

    const symbols = filterOptions?.symbols ?? [];
    const setupTypes = filterOptions?.setupTypes ?? [];

    const handleSelectTrade = (trade: Trade) => {
        setSelectedTrade(trade);
        setIsSheetOpen(true);
    };

    const handleUpdateTrade = (updatedTrade: Trade) => {
        // 使缓存失效，触发重新获取
        invalidateTrades();
        setSelectedTrade(updatedTrade);
    };

    const handleRefresh = () => {
        refetch();
    };

    return (
        <DashboardLayout>
            {/* Page Header */}
            <div className="flex items-center justify-between mb-8">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">
                        Trade History
                    </h2>
                    <p className="text-zinc-400">
                        Review your trades, track your performance, and reflect on your discipline.
                    </p>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <Button
                        variant="outline"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="bg-zinc-900/50 border-zinc-700 hover:bg-zinc-800 btn-scale"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </motion.div>
            </div>

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

            {/* Loading State with Skeleton */}
            {isLoading && (
                <div className="space-y-8">
                    <SkeletonStatsGrid />
                    <div className="glass-card p-6">
                        <div className="h-6 w-24 animate-shimmer rounded mb-6" />
                        <SkeletonTradeList count={8} />
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
                        {stats && <StatsCards stats={stats} />}
                    </motion.div>

                    {/* Trade List */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <ListFilter className="w-5 h-5 text-zinc-400" />
                            <h3 className="text-lg font-semibold text-white">
                                All Trades
                            </h3>
                        </div>
                        <TradeList
                            trades={trades}
                            symbols={symbols}
                            setupTypes={setupTypes}
                            onSelectTrade={handleSelectTrade}
                            selectedTradeId={selectedTrade?.id}
                        />
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
                        <ListFilter className="w-8 h-8 text-zinc-500" />
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

            {/* Trade Detail Sheet */}
            <TradeDetailSheet
                trade={selectedTrade}
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                onUpdate={handleUpdateTrade}
            />
        </DashboardLayout>
    );
}
