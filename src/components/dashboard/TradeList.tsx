'use client';

import { useState, useMemo } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Trade } from '@/lib/tradeQueries';
import { TradeListItem } from './TradeListItem';
import { Filter } from 'lucide-react';

interface TradeListProps {
    trades: Trade[];
    symbols: string[];
    setupTypes: string[];
    onSelectTrade: (trade: Trade) => void;
    selectedTradeId?: string;
}

export function TradeList({
    trades,
    symbols,
    setupTypes,
    onSelectTrade,
    selectedTradeId,
}: TradeListProps) {
    const [symbolFilter, setSymbolFilter] = useState<string>('all');
    const [setupTypeFilter, setSetupTypeFilter] = useState<string>('all');

    // Filter trades based on selections
    const filteredTrades = useMemo(() => {
        return trades.filter((trade) => {
            const matchesSymbol = symbolFilter === 'all' || trade.symbol === symbolFilter;
            const matchesSetup =
                setupTypeFilter === 'all' ||
                (setupTypeFilter === 'none' && !trade.setup_type) ||
                trade.setup_type === setupTypeFilter;
            return matchesSymbol && matchesSetup;
        });
    }, [trades, symbolFilter, setupTypeFilter]);

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4 flex-wrap items-center">
                <div className="flex items-center gap-2 text-zinc-400">
                    <Filter className="w-4 h-4" />
                    <span className="text-sm font-medium">Filters:</span>
                </div>

                <Select value={symbolFilter} onValueChange={setSymbolFilter}>
                    <SelectTrigger className="w-[140px] bg-zinc-900/50 border-zinc-700 text-zinc-300">
                        <SelectValue placeholder="All Symbols" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="all">All Symbols</SelectItem>
                        {symbols.map((symbol) => (
                            <SelectItem key={symbol} value={symbol}>
                                {symbol}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={setupTypeFilter} onValueChange={setSetupTypeFilter}>
                    <SelectTrigger className="w-[180px] bg-zinc-900/50 border-zinc-700 text-zinc-300">
                        <SelectValue placeholder="All Setups" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="all">All Setups</SelectItem>
                        <SelectItem value="none">Not Tagged</SelectItem>
                        {setupTypes.map((setup) => (
                            <SelectItem key={setup} value={setup}>
                                {setup}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="ml-auto text-sm text-zinc-500">
                    Showing {filteredTrades.length} of {trades.length} trades
                </div>
            </div>

            {/* Trade List */}
            <div className="space-y-2">
                {filteredTrades.length === 0 ? (
                    <div className="text-center py-12 text-zinc-500">
                        <p>No trades found</p>
                    </div>
                ) : (
                    filteredTrades.map((trade, index) => (
                        <TradeListItem
                            key={trade.id}
                            trade={trade}
                            isSelected={trade.id === selectedTradeId}
                            onClick={() => onSelectTrade(trade)}
                            index={index}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
