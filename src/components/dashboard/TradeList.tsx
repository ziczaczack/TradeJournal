'use client';

import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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

// Virtualize the list above this many trades
const VIRTUALIZATION_THRESHOLD = 100;
// Estimated row height (px)
const ESTIMATED_ROW_HEIGHT = 72;
// Max list height (px)
const MAX_LIST_HEIGHT = 600;

export function TradeList({
    trades,
    symbols,
    setupTypes,
    onSelectTrade,
    selectedTradeId,
}: TradeListProps) {
    const [symbolFilter, setSymbolFilter] = useState<string>('all');
    const [setupTypeFilter, setSetupTypeFilter] = useState<string>('all');
    const parentRef = useRef<HTMLDivElement>(null);

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

    const shouldVirtualize = filteredTrades.length > VIRTUALIZATION_THRESHOLD;

    const virtualizer = useVirtualizer({
        count: filteredTrades.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ESTIMATED_ROW_HEIGHT,
        overscan: 5, // render 5 extra rows for smoother scrolling
    });

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

                <div className="ml-auto text-sm text-muted-foreground">
                    Showing {filteredTrades.length} of {trades.length} trades
                    {shouldVirtualize && (
                        <span className="ml-2 text-blue-400">(virtualized)</span>
                    )}
                </div>
            </div>

            {/* Trade List */}
            {filteredTrades.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No trades found</p>
                </div>
            ) : shouldVirtualize ? (
                /* Virtualized list for large datasets */
                <div
                    ref={parentRef}
                    className="overflow-auto"
                    style={{ maxHeight: MAX_LIST_HEIGHT }}
                >
                    <div
                        style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {virtualizer.getVirtualItems().map((virtualRow) => {
                            const trade = filteredTrades[virtualRow.index];
                            return (
                                <div
                                    key={trade.id}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <TradeListItem
                                        trade={trade}
                                        isSelected={trade.id === selectedTradeId}
                                        onClick={() => onSelectTrade(trade)}
                                        index={virtualRow.index}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* Plain list for small datasets */
                <div className="space-y-2">
                    {filteredTrades.map((trade, index) => (
                        <TradeListItem
                            key={trade.id}
                            trade={trade}
                            isSelected={trade.id === selectedTradeId}
                            onClick={() => onSelectTrade(trade)}
                            index={index}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
