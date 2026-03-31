import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

// ============================================
// Symbol mapping: trading journal → Yahoo Finance
// ============================================
const SYMBOL_MAP: Record<string, string> = {
    // Micro E-mini futures
    MNQ: 'MNQ=F',
    MES: 'MES=F',
    M2K: 'M2K=F',
    MYM: 'MYM=F',
    MGC: 'MGC=F',
    // E-mini futures
    NQ: 'NQ=F',
    ES: 'ES=F',
    RTY: 'RTY=F',
    YM: 'YM=F',
    // Commodity futures
    GC: 'GC=F',
    CL: 'CL=F',
    SI: 'SI=F',
    NG: 'NG=F',
    // Crypto
    BTC: 'BTC-USD',
    ETH: 'ETH-USD',
};

function resolveYahooSymbol(raw: string): string {
    const upper = raw.toUpperCase().trim();
    if (upper.includes('=') || upper.includes('-')) return upper;
    if (SYMBOL_MAP[upper]) return SYMBOL_MAP[upper];
    return upper;
}

function getChartParams(entryTime: Date, exitTime: Date): { interval: string; windowHours: number } {
    const durationHours = (exitTime.getTime() - entryTime.getTime()) / 3_600_000;
    if (durationHours <= 1) return { interval: '1m', windowHours: 2 };
    if (durationHours <= 4) return { interval: '5m', windowHours: 8 };
    if (durationHours <= 24) return { interval: '15m', windowHours: 48 };
    return { interval: '1h', windowHours: durationHours * 3 };
}

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const rawSymbol = searchParams.get('symbol');
    const entryTimeStr = searchParams.get('entry_time');
    const exitTimeStr = searchParams.get('exit_time');

    if (!rawSymbol || !entryTimeStr) {
        return NextResponse.json({ error: 'symbol and entry_time are required' }, { status: 400 });
    }

    const symbol = resolveYahooSymbol(rawSymbol);
    const entryTime = new Date(entryTimeStr);
    const exitTime = exitTimeStr ? new Date(exitTimeStr) : new Date(entryTime.getTime() + 3_600_000);

    if (isNaN(entryTime.getTime())) {
        return NextResponse.json({ error: 'Invalid entry_time' }, { status: 400 });
    }

    const { interval, windowHours } = getChartParams(entryTime, exitTime);
    const windowMs = windowHours * 3_600_000;
    const startDate = new Date(entryTime.getTime() - windowMs * 0.4);
    const endDate = new Date(exitTime.getTime() + windowMs * 0.4);

    try {
        // yahoo-finance2 v5 uses class-based API
        const yf = new YahooFinance();

        const chart = await yf.chart(symbol, {
            period1: startDate,
            period2: endDate,
            interval: interval as '1m' | '5m' | '15m' | '1h',
            return: 'array',
        });

        if (!chart.quotes || chart.quotes.length === 0) {
            return NextResponse.json({ error: `No data found for symbol: ${symbol}` }, { status: 404 });
        }

        const candles = chart.quotes
            .filter(q => q.open != null && q.high != null && q.low != null && q.close != null)
            .map(q => ({
                time: Math.floor(new Date(q.date).getTime() / 1000),
                open: q.open!,
                high: q.high!,
                low: q.low!,
                close: q.close!,
                volume: q.volume ?? 0,
            }))
            .sort((a, b) => a.time - b.time);

        return NextResponse.json({
            symbol,
            interval,
            candles,
            meta: {
                entryTimestamp: Math.floor(entryTime.getTime() / 1000),
                exitTimestamp: Math.floor(exitTime.getTime() / 1000),
            },
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[Candles API] Error:', msg);
        return NextResponse.json({ error: `Failed to fetch chart data: ${msg}` }, { status: 502 });
    }
}
