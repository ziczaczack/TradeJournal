'use client';

import { motion } from 'framer-motion';
import { Trade } from '@/lib/tradeQueries';
import { formatPnL } from '@/lib/tradeStats';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface TradeListItemProps {
    trade: Trade;
    isSelected?: boolean;
    onClick: () => void;
    index?: number;
}

export function TradeListItem({
    trade,
    isSelected = false,
    onClick,
    index = 0,
}: TradeListItemProps) {
    const pnl = formatPnL(trade.pnl);
    const isProfit = trade.pnl >= 0;

    // Get symbol initials for avatar
    const getInitials = (symbol: string) => {
        // Remove common prefixes/suffixes and get first 2 chars
        const cleaned = symbol.replace(/[^A-Z0-9]/gi, '');
        return cleaned.substring(0, 2).toUpperCase();
    };

    const formatTime = (timestamp: string | null | undefined): string => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03, duration: 0.2 }}
            onClick={onClick}
            className={`
                group relative flex items-center gap-4 p-4 rounded-xl cursor-pointer
                transition-all duration-200
                ${isSelected
                    ? 'bg-blue-500/10 ring-1 ring-blue-500/50 glow-ring'
                    : 'bg-zinc-900/30 hover:bg-zinc-800/50'
                }
                ${isProfit ? 'status-profit' : 'status-loss'}
            `}
        >
            {/* Symbol Avatar */}
            <div
                className={`
                    w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm
                    ${isProfit
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-rose-500/10 text-rose-400'
                    }
                `}
            >
                {getInitials(trade.symbol)}
            </div>

            {/* Trade Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-white truncate">
                        {trade.symbol}
                    </span>
                    {trade.setup_type && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-zinc-800 text-zinc-400 truncate">
                            {trade.setup_type}
                        </span>
                    )}
                    {(trade.mistake_tag_ids?.length ?? 0) > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-rose-500/10 text-rose-400 shrink-0">
                            {trade.mistake_tag_ids!.length} mistake{trade.mistake_tag_ids!.length > 1 ? 's' : ''}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(trade.entry_time)}
                    </span>
                    {trade.quantity && (
                        <span>Qty: {trade.quantity}</span>
                    )}
                </div>
            </div>

            {/* PnL Display */}
            <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                    {isProfit ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-rose-400" />
                    )}
                    <span
                        className={`
                            text-lg font-bold font-mono
                            ${isProfit ? 'text-gradient-profit' : 'text-gradient-loss'}
                        `}
                    >
                        {pnl.text}
                    </span>
                </div>
                {trade.rating && (
                    <div className="text-xs text-zinc-500 mt-0.5">
                        {'⭐'.repeat(trade.rating)}
                    </div>
                )}
            </div>

            {/* Hover Indicator */}
            <div
                className={`
                    absolute right-2 w-1 h-8 rounded-full transition-opacity
                    ${isSelected ? 'bg-blue-500 opacity-100' : 'bg-zinc-600 opacity-0 group-hover:opacity-50'}
                `}
            />
        </motion.div>
    );
}

export default TradeListItem;
