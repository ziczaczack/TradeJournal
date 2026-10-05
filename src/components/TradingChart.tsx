'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
    createChart,
    CandlestickSeries,
    IChartApi,
    ISeriesApi,
    CandlestickData,
    Time,
    ColorType,
    CrosshairMode,
} from 'lightweight-charts';
import { Loader2, AlertCircle, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/analyticsStats';
import { CHART, PNL } from '@/lib/chartTheme';

// ============================================
// Types
// ============================================

interface CandleData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface ChartApiResponse {
    symbol: string;
    interval: string;
    candles: CandleData[];
    meta: {
        entryTimestamp: number;
        exitTimestamp: number;
    };
}

interface TradingChartProps {
    symbol: string;
    entryTime: string | null;
    exitTime?: string | null;
    entryPrice?: number | null;
    exitPrice?: number | null;
    pnl?: number | null;
}

// ============================================
// Chart theme constants (matching app dark mode)
// ============================================
const CHART_THEME = {
    background: '#0A0A0F',
    text: CHART.axisText,
    grid: '#18181B',
    border: '#27272A',
    crosshair: '#3F3F46',
    upColor: PNL.profit,
    downColor: PNL.loss,
    upWick: PNL.profit,
    downWick: PNL.loss,
    entry: '#3B82F6',   // blue
    exit: '#F59E0B',    // amber
};

export function TradingChart({
    symbol,
    entryTime,
    exitTime,
    entryPrice,
    exitPrice,
    pnl,
}: TradingChartProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [meta, setMeta] = useState<{ symbol: string; interval: string } | null>(null);

    const fetchAndRender = useCallback(async () => {
        if (!symbol || !entryTime) return;

        setStatus('loading');
        setErrorMsg('');

        try {
            const params = new URLSearchParams({
                symbol,
                entry_time: entryTime,
                ...(exitTime ? { exit_time: exitTime } : {}),
            });

            const res = await fetch(`/api/candles?${params}`);
            const json: ChartApiResponse & { error?: string } = await res.json();

            if (!res.ok || json.error) {
                throw new Error(json.error || `HTTP ${res.status}`);
            }

            if (!json.candles || json.candles.length === 0) {
                throw new Error('No candle data returned');
            }

            setMeta({ symbol: json.symbol, interval: json.interval });
            renderChart(json);
            setStatus('success');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
            setStatus('error');
        }
    }, [symbol, entryTime, exitTime]);

    const renderChart = (data: ChartApiResponse) => {
        if (!containerRef.current) return;

        // Cleanup old chart
        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
        }

        const chart = createChart(containerRef.current, {
            width: containerRef.current.clientWidth,
            height: 360,
            layout: {
                background: { type: ColorType.Solid, color: CHART_THEME.background },
                textColor: CHART_THEME.text,
                fontFamily: "'Inter', sans-serif",
            },
            grid: {
                vertLines: { color: CHART_THEME.grid },
                horzLines: { color: CHART_THEME.grid },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: { color: CHART_THEME.crosshair, labelBackgroundColor: '#27272A' },
                horzLine: { color: CHART_THEME.crosshair, labelBackgroundColor: '#27272A' },
            },
            rightPriceScale: {
                borderColor: CHART_THEME.border,
            },
            timeScale: {
                borderColor: CHART_THEME.border,
                timeVisible: true,
                secondsVisible: false,
            },
        });

        chartRef.current = chart;

        // Add candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: CHART_THEME.upColor,
            downColor: CHART_THEME.downColor,
            borderUpColor: CHART_THEME.upColor,
            borderDownColor: CHART_THEME.downColor,
            wickUpColor: CHART_THEME.upWick,
            wickDownColor: CHART_THEME.downWick,
        });

        seriesRef.current = candleSeries;

        // Set candle data
        const candleData: CandlestickData<Time>[] = data.candles.map(c => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
        }));
        candleSeries.setData(candleData);

        // Add entry price line
        if (entryPrice) {
            candleSeries.createPriceLine({
                price: entryPrice,
                color: CHART_THEME.entry,
                lineWidth: 1,
                lineStyle: 2, // dashed
                axisLabelVisible: true,
                title: `Entry  $${entryPrice.toFixed(2)}`,
            });
        }

        // Add exit price line
        if (exitPrice) {
            candleSeries.createPriceLine({
                price: exitPrice,
                color: CHART_THEME.exit,
                lineWidth: 1,
                lineStyle: 2,
                axisLabelVisible: true,
                title: `Exit  $${exitPrice.toFixed(2)}`,
            });
        }

        // Fit chart to show all data
        chart.timeScale().fitContent();

        // Responsive resize observer
        const ro = new ResizeObserver(entries => {
            if (entries[0] && chartRef.current) {
                chartRef.current.resize(entries[0].contentRect.width, 360);
            }
        });
        ro.observe(containerRef.current);
    };

    // Auto-load on mount
    useEffect(() => {
        if (symbol && entryTime) {
            fetchAndRender();
        }
        return () => {
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
            }
        };
    }, [fetchAndRender]);

    const isProfit = (pnl ?? 0) > 0;

    return (
        <div className="rounded-xl overflow-hidden border border-zinc-800/50">
            {/* Chart Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-white font-bold tracking-wide">{symbol}</span>
                            {meta && (
                                <span className="text-[9px] font-mono text-muted-foreground bg-zinc-800 px-1.5 py-0.5 rounded">
                                    {meta.interval}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                            {entryPrice && (
                                <span>
                                    <span className="text-blue-400">▲ Entry</span> ${entryPrice.toFixed(2)}
                                </span>
                            )}
                            {exitPrice && (
                                <span>
                                    <span className="text-amber-400">▼ Exit</span> ${exitPrice.toFixed(2)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {pnl != null && (
                        <span className={`text-sm font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>
                            {isProfit ? '+' : ''}{formatCurrency(pnl)}
                        </span>
                    )}
                    {status !== 'loading' && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={fetchAndRender}
                            className="w-7 h-7 text-muted-foreground hover:text-white"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Chart States */}
            {status === 'loading' && (
                <div className="flex items-center justify-center h-[360px] bg-[#0A0A0F]">
                    <div className="text-center">
                        <Loader2 className="w-7 h-7 text-blue-500 animate-spin mx-auto mb-3" />
                        <p className="text-muted-foreground text-sm">Loading chart data...</p>
                        <p className="text-zinc-700 text-xs mt-1">{symbol}</p>
                    </div>
                </div>
            )}

            {status === 'error' && (
                <div className="flex items-center justify-center h-[360px] bg-[#0A0A0F]">
                    <div className="text-center px-6">
                        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-zinc-400 text-sm font-medium mb-1">Chart unavailable</p>
                        <p className="text-muted-foreground text-xs mb-4 max-w-xs">{errorMsg}</p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchAndRender}
                            className="border-zinc-700 text-zinc-400 hover:text-white text-xs gap-1.5"
                        >
                            <RefreshCw className="w-3 h-3" /> Retry
                        </Button>
                    </div>
                </div>
            )}

            {/* Chart canvas — always rendered, hidden when not success */}
            <div
                ref={containerRef}
                style={{ display: status === 'success' ? 'block' : 'none' }}
                className="w-full"
            />
        </div>
    );
}
