'use client';

import { useMemo, useState } from 'react';
import { HeatmapCell, formatCurrency, formatPercent } from '@/lib/analyticsStats';
import { pnlColor } from '@/lib/chartTheme';

interface PerformanceHeatmapProps {
    data: HeatmapCell[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
    if (i === 0) return '12a';
    if (i < 12) return `${i}a`;
    if (i === 12) return '12p';
    return `${i - 12}p`;
});

function getColor(avgPnL: number, maxAbsPnL: number): string {
    if (maxAbsPnL === 0) return 'rgba(63,63,70,0.5)';
    const ratio = Math.max(-1, Math.min(1, avgPnL / maxAbsPnL));
    if (ratio !== 0) {
        // Profit/loss colour, from 30% opacity for small averages to solid for the largest
        const strength = Math.round(30 + Math.abs(ratio) * 70);
        return `color-mix(in srgb, ${pnlColor(ratio)} ${strength}%, transparent)`;
    }
    return 'rgba(63,63,70,0.5)';
}

export function PerformanceHeatmap({ data }: PerformanceHeatmapProps) {
    const [tooltip, setTooltip] = useState<{ cell: HeatmapCell; x: number; y: number } | null>(null);

    // Build lookup map and find max abs PnL for color scaling
    const { cellMap, maxAbsPnL, goldenHours, dangerZones } = useMemo(() => {
        const map = new Map<string, HeatmapCell>();
        let maxAbs = 0;

        for (const cell of data) {
            map.set(`${cell.day}-${cell.hour}`, cell);
            if (Math.abs(cell.avgPnL) > maxAbs) maxAbs = Math.abs(cell.avgPnL);
        }

        // Find golden hours: top 3 avg PnL slots with >= 3 trades
        const qualified = data.filter(c => c.tradeCount >= 3);
        const sorted = [...qualified].sort((a, b) => b.avgPnL - a.avgPnL);
        const golden = new Set(sorted.slice(0, 3).map(c => `${c.day}-${c.hour}`));
        const danger = new Set(sorted.slice(-3).map(c => `${c.day}-${c.hour}`));

        return { cellMap: map, maxAbsPnL: maxAbs, goldenHours: golden, dangerZones: danger };
    }, [data]);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                Not enough data — trade at least a few days to populate the heatmap.
            </div>
        );
    }

    const handleMouseEnter = (cell: HeatmapCell, e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setTooltip({ cell, x: rect.left + rect.width / 2, y: rect.top });
    };

    return (
        <div className="relative">
            {/* Legend */}
            <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-loss/80" />
                    Losing slot
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-zinc-700" />
                    No data
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-sm bg-profit/80" />
                    Winning slot
                </div>
                <span className="ml-auto">⭐ = Golden Hour &nbsp; ⚠️ = Danger Zone</span>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                    {/* Hour axis */}
                    <div className="flex" style={{ marginLeft: '36px' }}>
                        {HOUR_LABELS.map((label, h) => (
                            <div
                                key={h}
                                className="text-[9px] text-muted-foreground text-center flex-1"
                                style={{ minWidth: '18px' }}
                            >
                                {h % 3 === 0 ? label : ''}
                            </div>
                        ))}
                    </div>

                    {/* Day rows */}
                    {DAY_LABELS.map((dayLabel, d) => (
                        <div key={d} className="flex items-center mb-0.5">
                            <div className="text-[10px] text-muted-foreground w-9 text-right pr-2 shrink-0">
                                {dayLabel}
                            </div>
                            {Array.from({ length: 24 }, (_, h) => {
                                const key = `${d}-${h}`;
                                const cell = cellMap.get(key);
                                const isGolden = goldenHours.has(key);
                                const isDanger = dangerZones.has(key);
                                const bg = cell ? getColor(cell.avgPnL, maxAbsPnL) : 'rgba(39,39,42,0.4)';

                                return (
                                    <div
                                        key={h}
                                        className="flex-1 relative cursor-pointer transition-transform hover:scale-110 hover:z-10"
                                        style={{ minWidth: '18px', height: '22px' }}
                                        onMouseEnter={cell ? (e) => handleMouseEnter(cell, e) : undefined}
                                        onMouseLeave={() => setTooltip(null)}
                                    >
                                        <div
                                            className="w-full h-full rounded-[2px] flex items-center justify-center text-[8px]"
                                            style={{ backgroundColor: bg }}
                                        >
                                            {isGolden && '⭐'}
                                            {isDanger && '⚠'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Tooltip (fixed to viewport) */}
            {tooltip && (
                <div
                    className="fixed z-50 pointer-events-none"
                    style={{ left: tooltip.x, top: tooltip.y - 10, transform: 'translate(-50%, -100%)' }}
                >
                    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-2xl text-xs min-w-[140px]">
                        <div className="font-semibold text-white mb-1.5">
                            {DAY_LABELS[tooltip.cell.day]} {HOUR_LABELS[tooltip.cell.hour]}:00
                        </div>
                        <div className="space-y-1 text-zinc-400">
                            <div className="flex justify-between gap-4">
                                <span>Trades</span>
                                <span className="text-white">{tooltip.cell.tradeCount}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>Avg PnL</span>
                                <span className={tooltip.cell.avgPnL >= 0 ? 'text-profit' : 'text-loss'}>
                                    {formatCurrency(tooltip.cell.avgPnL)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>Win Rate</span>
                                <span className={tooltip.cell.winRate >= 50 ? 'text-profit' : 'text-warning'}>
                                    {formatPercent(tooltip.cell.winRate)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-4">
                                <span>Total PnL</span>
                                <span className={tooltip.cell.totalPnL >= 0 ? 'text-profit' : 'text-loss'}>
                                    {formatCurrency(tooltip.cell.totalPnL)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
