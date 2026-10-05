'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { isSameDay, format } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { TradingCalendar } from '@/components/calendar/TradingCalendar';
import { MonthlyStats } from '@/components/calendar/MonthlyStats';
import { TradeDetailSheet } from '@/components/dashboard/TradeDetailSheet';
import { TradeListItem } from '@/components/dashboard/TradeListItem';
import { SkeletonCalendar, SkeletonTradeList, SkeletonStatsGrid } from '@/components/ui/Skeleton';
import { EmptyState, EMPTY_STATE_MESSAGES } from '@/components/ui/EmptyState';
import { fetchTradesByMonth, Trade } from '@/lib/tradeQueries';
import { formatPnL } from '@/lib/tradeStats';
import { useAccount } from '@/components/providers/AccountContext';
import { CalendarDays, X } from 'lucide-react';
import Link from 'next/link';

export default function CalendarPage() {
    const { currentAccount, isLoading: accountLoading } = useAccount();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [trades, setTrades] = useState<Trade[]>([]);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch trades for current month (filtered by account)
    const loadMonthData = useCallback(async () => {
        if (!currentAccount?.id) {
            setTrades([]);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);
            const data = await fetchTradesByMonth(
                currentMonth.getFullYear(),
                currentMonth.getMonth(),
                currentAccount.id
            );
            setTrades(data);
        } catch (err) {
            console.error('Failed to load trades:', err);
            setError('Failed to load trades. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    }, [currentMonth, currentAccount?.id]);

    useEffect(() => {
        if (!accountLoading) {
            loadMonthData();
        }
    }, [loadMonthData, accountLoading]);

    // Filter trades by selected date (memoized for performance)
    const filteredTrades = useMemo(() => {
        if (!selectedDate) return trades;
        return trades.filter((trade) => {
            if (!trade.exit_time) return false;
            return isSameDay(new Date(trade.exit_time), selectedDate);
        });
    }, [trades, selectedDate]);

    // Calculate day summary PnL (memoized)
    const daySummary = useMemo(() => {
        if (!selectedDate || filteredTrades.length === 0) return null;
        const totalPnL = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
        return {
            count: filteredTrades.length,
            totalPnL,
            formatted: formatPnL(totalPnL),
        };
    }, [selectedDate, filteredTrades]);

    const handleMonthChange = (date: Date) => {
        setCurrentMonth(date);
        setSelectedDate(null);
    };

    const handleSelectTrade = (trade: Trade) => {
        setSelectedTrade(trade);
        setIsSheetOpen(true);
    };

    const handleUpdateTrade = (updatedTrade: Trade) => {
        setTrades((prev) =>
            prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t))
        );
    };

    return (
        <DashboardLayout>
            {/* Page wrapper with terminal gradient */}
            <div className="min-h-full bg-terminal-gradient">
                {/* Page Header */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mb-8"
                >
                    <h2 className="text-3xl font-bold text-white mb-1 tracking-tight">
                        Trading Calendar
                    </h2>
                    <p className="text-zinc-400">
                        Visualize your daily performance and review trades by date.
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

                {/* Loading State with Skeletons */}
                {isLoading && (
                    <div className="space-y-8">
                        <SkeletonStatsGrid />
                        <div className="grid lg:grid-cols-[340px_1fr] gap-6">
                            <SkeletonCalendar />
                            <div className="glass-card p-5">
                                <div className="h-6 w-32 animate-shimmer rounded mb-4" />
                                <SkeletonTradeList count={6} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Content */}
                {!isLoading && !error && (
                    <div className="space-y-8">
                        {/* Monthly Stats */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <MonthlyStats trades={trades} />
                        </motion.div>

                        {/* Calendar and Trade List Grid - Asymmetric Layout */}
                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Compact Calendar Sidebar */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="lg:sticky lg:top-24"
                            >
                                <TradingCalendar
                                    trades={trades}
                                    currentMonth={currentMonth}
                                    selectedDate={selectedDate}
                                    onMonthChange={handleMonthChange}
                                    onDateSelect={setSelectedDate}
                                />
                            </motion.div>

                            {/* Trade List - Main Content */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="glass-card p-5 backdrop-blur-xl border-white/10"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <CalendarDays className="w-5 h-5 text-zinc-400" />
                                        <h3 className="text-lg font-semibold text-white">
                                            {selectedDate
                                                ? `Trades on ${format(selectedDate, 'MMM d, yyyy')}`
                                                : `All Trades in ${format(currentMonth, 'MMMM yyyy')}`}
                                        </h3>
                                    </div>
                                    {selectedDate && (
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/journal?date=${format(selectedDate, 'yyyy-MM-dd')}`}
                                                className="text-sm text-blue-400 hover:underline"
                                            >
                                                Open daily journal →
                                            </Link>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedDate(null)}
                                                className="text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                                            >
                                                <X className="w-4 h-4 mr-1" />
                                                Clear
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Trade List or Empty State */}
                                <div className="max-h-[600px] overflow-y-auto">
                                    {filteredTrades.length === 0 ? (
                                        <EmptyState
                                            {...(selectedDate
                                                ? EMPTY_STATE_MESSAGES.noTradesDay
                                                : EMPTY_STATE_MESSAGES.noTradesMonth)}
                                        />
                                    ) : (
                                        <div className="space-y-2">
                                            {filteredTrades.map((trade, index) => (
                                                <TradeListItem
                                                    key={trade.id}
                                                    trade={trade}
                                                    isSelected={trade.id === selectedTrade?.id}
                                                    onClick={() => handleSelectTrade(trade)}
                                                    index={index}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Day Summary with Profit Glow */}
                                {daySummary && (
                                    <div className="mt-4 pt-4 border-t border-zinc-800">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-zinc-500">
                                                {daySummary.count} trade{daySummary.count !== 1 ? 's' : ''}
                                            </span>
                                            <span
                                                className={`text-lg font-bold ${daySummary.totalPnL >= 0
                                                    ? 'text-gradient-profit profit-glow'
                                                    : 'text-gradient-loss loss-glow'
                                                    }`}
                                            >
                                                {daySummary.formatted.text}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </div>
                    </div>
                )}

                {/* Trade Detail Sheet */}
                <TradeDetailSheet
                    trade={selectedTrade}
                    isOpen={isSheetOpen}
                    onClose={() => setIsSheetOpen(false)}
                    onUpdate={handleUpdateTrade}
                />
            </div>
        </DashboardLayout>
    );
}
