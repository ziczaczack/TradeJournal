'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnalyticsStats, formatCurrency, formatPercent, formatRatio } from '@/lib/analyticsStats';

interface AnalyticsStatsCardsProps {
    stats: AnalyticsStats;
    isLoading?: boolean;
}

export function AnalyticsStatsCards({ stats, isLoading }: AnalyticsStatsCardsProps) {
    const cards = [
        {
            title: 'Total Net PnL',
            value: stats.totalNetPnL,
            format: 'currency' as const,
            icon: '💰',
            colorClass: stats.totalNetPnL >= 0 ? 'text-green-500' : 'text-red-500',
            subtitle: `${stats.winningTrades}W / ${stats.losingTrades}L`,
        },
        {
            title: 'Win Rate',
            value: stats.winRate,
            format: 'percent' as const,
            icon: '🎯',
            colorClass: stats.winRate >= 50 ? 'text-green-500' : 'text-yellow-500',
            subtitle: `${stats.totalTrades} total trades`,
        },
        {
            title: 'Profit Factor',
            value: stats.profitFactor,
            format: 'ratio' as const,
            icon: '📈',
            colorClass: stats.profitFactor >= 1.5 ? 'text-green-500' : stats.profitFactor >= 1 ? 'text-yellow-500' : 'text-red-500',
            subtitle: stats.profitFactor >= 1.5 ? 'Excellent' : stats.profitFactor >= 1 ? 'Profitable' : 'Needs improvement',
        },
        {
            title: 'Total Trades',
            value: stats.totalTrades,
            format: 'number' as const,
            icon: '📋',
            colorClass: 'text-blue-500',
            subtitle: `Avg RRR: ${formatRatio(stats.averageRRR)}`,
        },
    ];

    const formatValue = (value: number, format: string): string => {
        if (isLoading) return '-';

        switch (format) {
            case 'currency':
                return formatCurrency(value);
            case 'percent':
                return formatPercent(value);
            case 'ratio':
                return formatRatio(value);
            case 'number':
                return value.toString();
            default:
                return String(value);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
                <Card key={card.title} className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/70 transition-colors">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400">
                            {card.title}
                        </CardTitle>
                        <span className="text-2xl">{card.icon}</span>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${card.colorClass}`}>
                            {formatValue(card.value, card.format)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            {card.subtitle}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
