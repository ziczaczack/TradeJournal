'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { TradeStats, formatDuration } from '@/lib/tradeStats';
import { DollarSign, Target, Clock, Award } from 'lucide-react';

interface StatsCardsProps {
    stats: TradeStats;
    isLoading?: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
    const cards = [
        {
            title: 'Total PnL',
            value: stats.totalPnL,
            format: 'currency' as const,
            icon: DollarSign,
            colorClass: stats.totalPnL >= 0 ? 'text-profit' : 'text-loss',
            bgClass: stats.totalPnL >= 0 ? 'bg-profit/10' : 'bg-loss/10',
            iconColor: stats.totalPnL >= 0 ? 'text-profit' : 'text-loss',
        },
        {
            title: 'Win Rate',
            value: stats.winRate,
            format: 'percent' as const,
            icon: Target,
            colorClass: stats.winRate >= 50 ? 'text-profit' : 'text-warning',
            bgClass: stats.winRate >= 50 ? 'bg-profit/10' : 'bg-warning/10',
            iconColor: stats.winRate >= 50 ? 'text-profit' : 'text-warning',
            subtitle: `${stats.winningTrades}W / ${stats.losingTrades}L`,
        },
        {
            title: 'Avg Duration',
            value: stats.avgDurationSeconds,
            format: 'duration' as const,
            icon: Clock,
            colorClass: 'text-blue-400',
            bgClass: 'bg-blue-500/10',
            iconColor: 'text-blue-500',
        },
        {
            title: 'Discipline Rate',
            value: stats.disciplineRate,
            format: 'percent' as const,
            icon: Award,
            colorClass: stats.disciplineRate >= 80 ? 'text-profit' : 'text-warning',
            bgClass: stats.disciplineRate >= 80 ? 'bg-profit/10' : 'bg-warning/10',
            iconColor: stats.disciplineRate >= 80 ? 'text-profit' : 'text-warning',
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => {
                const Icon = card.icon;

                return (
                    <Card
                        key={card.title}
                        className="glass-card hover-lift overflow-hidden"
                    >
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium text-zinc-400">
                                {card.title}
                            </CardTitle>
                            <div className={`p-2 rounded-lg ${card.bgClass}`}>
                                <Icon className={`w-4 h-4 ${card.iconColor}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="h-8 w-24 animate-shimmer rounded" />
                            ) : card.format === 'duration' ? (
                                <div className={`text-2xl font-bold ${card.colorClass}`}>
                                    {formatDuration(card.value)}
                                </div>
                            ) : (
                                <AnimatedNumber
                                    value={card.value}
                                    format={card.format}
                                    decimals={card.format === 'percent' ? 1 : 0}
                                    className={`text-2xl font-bold ${card.colorClass} ${card.title === 'Total PnL'
                                            ? card.value >= 0 ? 'profit-glow' : 'loss-glow'
                                            : ''
                                        }`}
                                />
                            )}
                            {card.subtitle && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    {card.subtitle}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
