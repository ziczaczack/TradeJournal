'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
} from 'date-fns';
import { Trade } from '@/lib/tradeQueries';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEconomicCalendar, getEventsForDate, hasHighImpactEvent } from '@/lib/economicCalendarQueries';
import { EventTooltip } from './EventTooltip';

interface DayData {
    date: Date;
    dateString: string;  // YYYY-MM-DD for event lookup
    trades: Trade[];
    totalPnL: number;
    isCurrentMonth: boolean;
}

interface TradingCalendarProps {
    trades: Trade[];
    currentMonth: Date;
    selectedDate: Date | null;
    onMonthChange: (date: Date) => void;
    onDateSelect: (date: Date | null) => void;
}

export function TradingCalendar({
    trades,
    currentMonth,
    selectedDate,
    onMonthChange,
    onDateSelect,
}: TradingCalendarProps) {
    // Fetch economic calendar events for this month
    const { data: economicEvents = [] } = useEconomicCalendar(
        currentMonth.getFullYear(),
        currentMonth.getMonth()
    );

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const calendarStart = startOfWeek(monthStart);
        const calendarEnd = endOfWeek(monthEnd);

        const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

        return days.map((date): DayData => {
            const dayTrades = trades.filter((trade) => {
                if (!trade.exit_time) return false;
                return isSameDay(new Date(trade.exit_time), date);
            });

            const totalPnL = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

            return {
                date,
                dateString: format(date, 'yyyy-MM-dd'),
                trades: dayTrades,
                totalPnL,
                isCurrentMonth: isSameMonth(date, currentMonth),
            };
        });
    }, [trades, currentMonth]);

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const handlePrevMonth = () => {
        onMonthChange(subMonths(currentMonth, 1));
    };

    const handleNextMonth = () => {
        onMonthChange(addMonths(currentMonth, 1));
    };

    const handleDateClick = (day: DayData) => {
        if (!day.isCurrentMonth) return;

        if (selectedDate && isSameDay(selectedDate, day.date)) {
            onDateSelect(null);
        } else {
            onDateSelect(day.date);
        }
    };

    const formatPnL = (pnl: number): string => {
        if (pnl === 0) return '';
        const prefix = pnl > 0 ? '+' : '';
        return `${prefix}$${Math.abs(pnl).toFixed(0)}`;
    };

    return (
        <div className="glass-card p-5 backdrop-blur-xl border-white/10">
            {/* Header with navigation */}
            <div className="flex items-center justify-between mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevMonth}
                    className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 btn-scale"
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h3 className="text-xl font-bold text-white tracking-tight">
                    {format(currentMonth, 'MMMM yyyy')}
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleNextMonth}
                    className="text-zinc-400 hover:text-white hover:bg-zinc-800/50 btn-scale"
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-2 mb-3">
                {weekDays.map((day) => (
                    <div
                        key={day}
                        className="text-center text-xs font-medium text-muted-foreground py-2 uppercase tracking-wider"
                    >
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, index) => {
                    const isSelected = selectedDate && isSameDay(selectedDate, day.date);
                    const hasTrades = day.trades.length > 0;
                    const isProfit = day.totalPnL > 0;
                    const isLoss = day.totalPnL < 0;
                    const dayEvents = getEventsForDate(economicEvents, day.dateString);
                    const hasHighImpact = hasHighImpactEvent(economicEvents, day.dateString);

                    return (
                        <EventTooltip key={day.date.toISOString()} events={dayEvents}>
                            <motion.button
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.01, duration: 0.15 }}
                                onClick={() => handleDateClick(day)}
                                disabled={!day.isCurrentMonth}
                                className={`
                                    relative h-[72px] p-2 rounded-xl transition-all duration-200 text-left w-full
                                    ${!day.isCurrentMonth
                                        ? 'opacity-25 cursor-not-allowed'
                                        : 'cursor-pointer hover:-translate-y-0.5'
                                    }
                                    ${isSelected
                                        ? 'ring-2 ring-blue-500 bg-blue-500/10 glow-ring'
                                        : 'hover:bg-zinc-800/50'
                                    }
                                    ${hasTrades && !isSelected
                                        ? isProfit
                                            ? 'bg-profit/5 border-l-2 border-l-profit'
                                            : isLoss
                                                ? 'bg-loss/5 border-l-2 border-l-loss'
                                                : 'bg-zinc-800/30'
                                        : 'bg-zinc-900/30'
                                    }
                                `}
                                style={{
                                    boxShadow: isSelected
                                        ? '0 0 20px rgba(59, 130, 246, 0.3)'
                                        : hasTrades
                                            ? '0 2px 8px rgba(0, 0, 0, 0.2)'
                                            : 'none'
                                }}
                            >
                                {/* Date number */}
                                <span
                                    className={`
                                        text-sm font-semibold
                                        ${!day.isCurrentMonth
                                            ? 'text-zinc-700'
                                            : isSelected
                                                ? 'text-blue-400'
                                                : hasTrades
                                                    ? isProfit
                                                        ? 'text-profit'
                                                        : isLoss
                                                            ? 'text-loss'
                                                            : 'text-white'
                                                    : 'text-zinc-400'
                                        }
                                    `}
                                >
                                    {format(day.date, 'd')}
                                </span>

                                {/* High-impact economic event indicator */}
                                {hasHighImpact && day.isCurrentMonth && (
                                    <div className="absolute top-2 right-2 flex items-center gap-0.5">
                                        <Zap className="w-3 h-3 text-rose-400 fill-rose-400" />
                                    </div>
                                )}

                                {/* Trade count indicator - shifted left when there's high impact event */}
                                {day.trades.length > 1 && day.isCurrentMonth && (
                                    <span className={`absolute top-2 ${hasHighImpact ? 'right-7' : 'right-2'} w-5 h-5 flex items-center justify-center text-[10px] font-medium bg-zinc-800 text-zinc-400 rounded-full`}>
                                        {day.trades.length}
                                    </span>
                                )}

                                {/* PnL amount */}
                                {hasTrades && day.isCurrentMonth && (
                                    <div
                                        className={`
                                            absolute bottom-2 left-2 right-2
                                            text-xs font-bold font-mono truncate
                                            ${isProfit ? 'text-gradient-profit profit-glow' : 'text-gradient-loss loss-glow'}
                                        `}
                                    >
                                        {formatPnL(day.totalPnL)}
                                    </div>
                                )}
                            </motion.button>
                        </EventTooltip>
                    );
                })}
            </div>
        </div>
    );
}
