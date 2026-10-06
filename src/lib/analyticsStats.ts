import { Trade } from './tradeQueries';

// ============================================
// Analytics Statistics Types
// ============================================

export interface AnalyticsStats {
    totalNetPnL: number;
    winRate: number;
    profitFactor: number;
    averageRRR: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
}

export interface EquityCurvePoint {
    date: string;
    exitTime: string;
    cumulativePnL: number;
    pnl: number;
}

export interface SetupPerformance {
    setupType: string;
    winRate: number;
    netPnL: number;
    totalTrades: number;
    winningTrades: number;
}

export interface PsychologyBreakdown {
    tag: string;
    totalPnL: number;
    tradeCount: number;
    isPositive: boolean;
}

export interface HeatmapCell {
    day: number;       // 0=Sun, 1=Mon, ..., 6=Sat
    hour: number;      // 0-23
    avgPnL: number;
    totalPnL: number;
    tradeCount: number;
    winRate: number;
}

export interface PlaybookComparison {
    setupName: string;
    targetWinRate: number;
    actualWinRate: number;
    tradeCount: number;
}

// ============================================
// Core Statistics Calculation
// ============================================

/**
 * Convert dollars to integer cents to avoid floating-point error
 */
function toCents(dollars: number): number {
    return Math.round(dollars * 100);
}

/**
 * Convert cents back to dollars
 */
function toDollars(cents: number): number {
    return cents / 100;
}

/**
 * Calculate comprehensive analytics statistics from trades
 */
export function calculateAnalyticsStats(trades: Trade[]): AnalyticsStats {
    // Edge case: no trades
    if (trades.length === 0) {
        return {
            totalNetPnL: 0,
            winRate: 0,
            profitFactor: 0,
            averageRRR: 0,
            maxDrawdown: 0,
            maxDrawdownPercent: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
        };
    }

    // Sum in integer cents to avoid floating-point error
    const totalNetPnLCents = trades.reduce((sum, t) => sum + toCents(t.pnl || 0), 0);
    const totalNetPnL = toDollars(totalNetPnLCents);

    // Win/Loss counts
    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl < 0);

    // Win Rate (also correct for a single trade)
    const winRate = (winningTrades.length / trades.length) * 100;

    // Profit Factor: Total Profit / |Total Loss| (summed in cents)
    const totalProfitCents = winningTrades.reduce((sum, t) => sum + toCents(t.pnl), 0);
    const totalLossCents = Math.abs(losingTrades.reduce((sum, t) => sum + toCents(t.pnl), 0));
    const profitFactor = totalLossCents > 0
        ? totalProfitCents / totalLossCents
        : totalProfitCents > 0 ? Infinity : 0;

    // Average RRR: Average Win / |Average Loss|
    const avgWinCents = winningTrades.length > 0
        ? totalProfitCents / winningTrades.length
        : 0;
    const avgLossCents = losingTrades.length > 0
        ? totalLossCents / losingTrades.length
        : 0;
    const averageRRR = avgLossCents > 0 ? avgWinCents / avgLossCents : avgWinCents > 0 ? Infinity : 0;

    // Max Drawdown
    const { maxDrawdown, maxDrawdownPercent } = calculateMaxDrawdown(trades);

    return {
        totalNetPnL,
        winRate,
        profitFactor: isFinite(profitFactor) ? profitFactor : 0,
        averageRRR: isFinite(averageRRR) ? averageRRR : 0,
        maxDrawdown,
        maxDrawdownPercent,
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
    };
}

/**
 * Calculate maximum drawdown from trades
 * Handles accounts that start with a loss
 * 
 * Drawdown = High Water Mark - Current Equity
 * The high-water mark moves up at each new equity high
 */
function calculateMaxDrawdown(
    trades: Trade[],
    startingBalance: number = 0  // starting balance, defaults to 0
): { maxDrawdown: number; maxDrawdownPercent: number } {
    // Edge case: no trades
    if (trades.length === 0) {
        return { maxDrawdown: 0, maxDrawdownPercent: 0 };
    }

    // Sort trades by exit_time for equity curve
    const sortedTrades = [...trades].sort((a, b) => {
        const dateA = a.exit_time ? new Date(a.exit_time).getTime() : 0;
        const dateB = b.exit_time ? new Date(b.exit_time).getTime() : 0;
        return dateA - dateB;
    });

    let equityCents = toCents(startingBalance);  // current equity (cents)
    let highWaterMarkCents = equityCents;        // peak equity (cents)
    let maxDrawdownCents = 0;
    let maxDrawdownPercent = 0;

    for (const trade of sortedTrades) {
        equityCents += toCents(trade.pnl || 0);

        // Raise the high-water mark only on a new high
        if (equityCents > highWaterMarkCents) {
            highWaterMarkCents = equityCents;
        }

        // Current drawdown = HWM - equity
        const drawdownCents = highWaterMarkCents - equityCents;

        if (drawdownCents > maxDrawdownCents) {
            maxDrawdownCents = drawdownCents;

            // Percent of |HWM|, which still works when HWM is negative (initial losses)
            if (highWaterMarkCents !== 0) {
                maxDrawdownPercent = (drawdownCents / Math.abs(highWaterMarkCents)) * 100;
            } else {
                // HWM of 0 with a drawdown means losing from zero: report 100%
                maxDrawdownPercent = 100;
            }
        }
    }

    return {
        maxDrawdown: toDollars(maxDrawdownCents),
        maxDrawdownPercent: Math.min(maxDrawdownPercent, 100),  // cap at 100%
    };
}

// ============================================
// Chart Data Generators
// ============================================

/**
 * Generate equity curve data points sorted by exit_time
 */
export function generateEquityCurveData(trades: Trade[]): EquityCurvePoint[] {
    // Edge case: no trades
    if (trades.length === 0) {
        return [];
    }

    // Sort by exit_time
    const sortedTrades = [...trades].sort((a, b) => {
        const dateA = a.exit_time ? new Date(a.exit_time).getTime() : 0;
        const dateB = b.exit_time ? new Date(b.exit_time).getTime() : 0;
        return dateA - dateB;
    });

    let cumulativePnLCents = 0;  // summed in cents
    const points: EquityCurvePoint[] = [];

    for (const trade of sortedTrades) {
        cumulativePnLCents += toCents(trade.pnl || 0);
        const exitDate = trade.exit_time ? new Date(trade.exit_time) : new Date();

        points.push({
            date: exitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            exitTime: trade.exit_time || '',
            cumulativePnL: toDollars(cumulativePnLCents),
            pnl: trade.pnl || 0,
        });
    }

    return points;
}

/**
 * Generate setup performance breakdown
 */
export function generateSetupPerformanceData(trades: Trade[]): SetupPerformance[] {
    // Edge case: no trades
    if (trades.length === 0) {
        return [];
    }

    // PnL kept in integer cents
    const setupMap = new Map<string, { wins: number; losses: number; totalPnLCents: number }>();

    for (const trade of trades) {
        const setupType = trade.setup_type || 'Unclassified';
        const current = setupMap.get(setupType) || { wins: 0, losses: 0, totalPnLCents: 0 };

        if (trade.pnl > 0) {
            current.wins += 1;
        } else if (trade.pnl < 0) {
            current.losses += 1;
        }
        current.totalPnLCents += toCents(trade.pnl || 0);

        setupMap.set(setupType, current);
    }

    const result: SetupPerformance[] = [];
    setupMap.forEach((data, setupType) => {
        const total = data.wins + data.losses;
        result.push({
            setupType,
            winRate: total > 0 ? (data.wins / total) * 100 : 0,
            netPnL: toDollars(data.totalPnLCents),
            totalTrades: total,
            winningTrades: data.wins,
        });
    });

    // Sort by totalTrades descending
    return result.sort((a, b) => b.totalTrades - a.totalTrades);
}

/**
 * Generate psychology tag breakdown
 */
export function generatePsychologyData(trades: Trade[]): PsychologyBreakdown[] {
    // Edge case: no trades
    if (trades.length === 0) {
        return [];
    }

    // PnL kept in integer cents
    const psychMap = new Map<string, { totalPnLCents: number; count: number }>();

    for (const trade of trades) {
        const tag = trade.psychology_tag || 'Untagged';
        const current = psychMap.get(tag) || { totalPnLCents: 0, count: 0 };
        current.totalPnLCents += toCents(trade.pnl || 0);
        current.count += 1;
        psychMap.set(tag, current);
    }

    const result: PsychologyBreakdown[] = [];
    psychMap.forEach((data, tag) => {
        const totalPnL = toDollars(data.totalPnLCents);
        result.push({
            tag,
            totalPnL,
            tradeCount: data.count,
            isPositive: totalPnL >= 0,
        });
    });

    // Sort by trade count descending
    return result.sort((a, b) => b.tradeCount - a.tradeCount);
}

/**
 * Generate Day/Hour heatmap data from trades
 * Returns a flat array of cells, one per (day, hour) combination that has data
 */
export function generateHeatmapData(trades: Trade[]): HeatmapCell[] {
    if (trades.length === 0) return [];

    // Map keyed by "day-hour"
    const cellMap = new Map<string, { wins: number; total: number; totalPnLCents: number }>();

    for (const trade of trades) {
        if (!trade.exit_time) continue;
        const date = new Date(trade.exit_time);
        const day = date.getDay();   // 0=Sun…6=Sat
        const hour = date.getHours(); // 0-23
        const key = `${day}-${hour}`;
        const current = cellMap.get(key) || { wins: 0, total: 0, totalPnLCents: 0 };
        current.total += 1;
        if ((trade.pnl || 0) > 0) current.wins += 1;
        current.totalPnLCents += toCents(trade.pnl || 0);
        cellMap.set(key, current);
    }

    const cells: HeatmapCell[] = [];
    cellMap.forEach((data, key) => {
        const [day, hour] = key.split('-').map(Number);
        cells.push({
            day,
            hour,
            tradeCount: data.total,
            totalPnL: toDollars(data.totalPnLCents),
            avgPnL: data.total > 0 ? toDollars(data.totalPnLCents) / data.total : 0,
            winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
        });
    });

    return cells;
}

// ============================================
// Formatting Utilities
// ============================================

/**
 * Format number as currency
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        signDisplay: 'always',
    }).format(value);
}

/**
 * Format number as percentage
 */
export function formatPercent(value: number, decimals: number = 1): string {
    return `${value.toFixed(decimals)}%`;
}

/**
 * Format ratio (like Profit Factor or RRR)
 */
export function formatRatio(value: number): string {
    if (value === 0) return '0.00';
    if (!isFinite(value)) return '∞';
    return value.toFixed(2);
}
