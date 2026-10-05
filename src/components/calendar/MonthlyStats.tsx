'use client';

import { useMemo } from 'react';
import { isSameDay } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Trade } from '@/lib/tradeQueries';
import { formatPnL } from '@/lib/tradeStats';

interface DayStats {
    totalPnL: number;
    winningDays: number;
    losingDays: number;
    tradingDays: number;
    totalTrades: number;
}

interface MonthlyStatsProps {
    trades: Trade[];
}

export function MonthlyStats({ trades }: MonthlyStatsProps) {
    const stats = useMemo((): DayStats => {
        if (trades.length === 0) {
            return {
                totalPnL: 0,
                winningDays: 0,
                losingDays: 0,
                tradingDays: 0,
                totalTrades: 0,
            };
        }

        // Group trades by day
        const dayMap = new Map<string, number>();
        trades.forEach((trade) => {
            if (!trade.exit_time) return;
            const dayKey = new Date(trade.exit_time).toDateString();
            dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + (trade.pnl || 0));
        });

        let winningDays = 0;
        let losingDays = 0;
        let totalPnL = 0;

        dayMap.forEach((pnl) => {
            totalPnL += pnl;
            if (pnl > 0) winningDays++;
            else if (pnl < 0) losingDays++;
        });

        return {
            totalPnL,
            winningDays,
            losingDays,
            tradingDays: dayMap.size,
            totalTrades: trades.length,
        };
    }, [trades]);

    const winRateByDays = stats.tradingDays > 0
        ? ((stats.winningDays / stats.tradingDays) * 100).toFixed(1)
        : '0.0';

    const pnlFormatted = formatPnL(stats.totalPnL);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-zinc-800/30 border-zinc-700/50 p-4">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Monthly PnL
                </p>
                <p className={`text-2xl font-bold mt-1 ${pnlFormatted.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {pnlFormatted.text}
                </p>
            </Card>

            <Card className="bg-zinc-800/30 border-zinc-700/50 p-4">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Win Rate (Days)
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                    {winRateByDays}%
                </p>
            </Card>

            <Card className="bg-zinc-800/30 border-zinc-700/50 p-4">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Trading Days
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                    <span className="text-green-400">{stats.winningDays}</span>
                    <span className="text-zinc-500 mx-1">/</span>
                    <span className="text-red-400">{stats.losingDays}</span>
                    <span className="text-zinc-500 mx-1">/</span>
                    <span>{stats.tradingDays}</span>
                </p>
            </Card>

            <Card className="bg-zinc-800/30 border-zinc-700/50 p-4">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                    Total Trades
                </p>
                <p className="text-2xl font-bold text-white mt-1">
                    {stats.totalTrades}
                </p>
            </Card>
        </div>
    );
}
