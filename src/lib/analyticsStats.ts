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

// ============================================
// Core Statistics Calculation
// ============================================

/**
 * Calculate comprehensive analytics statistics from trades
 */
export function calculateAnalyticsStats(trades: Trade[]): AnalyticsStats {
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

    // Total Net PnL
    const totalNetPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    // Win/Loss counts
    const winningTrades = trades.filter((t) => t.pnl > 0);
    const losingTrades = trades.filter((t) => t.pnl < 0);

    // Win Rate
    const winRate = (winningTrades.length / trades.length) * 100;

    // Profit Factor: Total Profit / |Total Loss|
    const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;

    // Average RRR: Average Win / |Average Loss|
    const avgWin = winningTrades.length > 0
        ? totalProfit / winningTrades.length
        : 0;
    const avgLoss = losingTrades.length > 0
        ? Math.abs(totalLoss / losingTrades.length)
        : 0;
    const averageRRR = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;

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
 * Drawdown = Peak Equity - Current Equity
 */
function calculateMaxDrawdown(trades: Trade[]): { maxDrawdown: number; maxDrawdownPercent: number } {
    // Sort trades by exit_time for equity curve
    const sortedTrades = [...trades].sort((a, b) => {
        const dateA = a.exit_time ? new Date(a.exit_time).getTime() : 0;
        const dateB = b.exit_time ? new Date(b.exit_time).getTime() : 0;
        return dateA - dateB;
    });

    let cumulativePnL = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const trade of sortedTrades) {
        cumulativePnL += trade.pnl || 0;

        if (cumulativePnL > peak) {
            peak = cumulativePnL;
        }

        const drawdown = peak - cumulativePnL;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
            // Calculate percentage relative to peak (avoid division by zero)
            maxDrawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
        }
    }

    return { maxDrawdown, maxDrawdownPercent };
}

// ============================================
// Chart Data Generators
// ============================================

/**
 * Generate equity curve data points sorted by exit_time
 */
export function generateEquityCurveData(trades: Trade[]): EquityCurvePoint[] {
    // Sort by exit_time
    const sortedTrades = [...trades].sort((a, b) => {
        const dateA = a.exit_time ? new Date(a.exit_time).getTime() : 0;
        const dateB = b.exit_time ? new Date(b.exit_time).getTime() : 0;
        return dateA - dateB;
    });

    let cumulativePnL = 0;
    const points: EquityCurvePoint[] = [];

    for (const trade of sortedTrades) {
        cumulativePnL += trade.pnl || 0;
        const exitDate = trade.exit_time ? new Date(trade.exit_time) : new Date();

        points.push({
            date: exitDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            exitTime: trade.exit_time || '',
            cumulativePnL: Math.round(cumulativePnL * 100) / 100,
            pnl: trade.pnl || 0,
        });
    }

    return points;
}

/**
 * Generate setup performance breakdown
 */
export function generateSetupPerformanceData(trades: Trade[]): SetupPerformance[] {
    const setupMap = new Map<string, { wins: number; losses: number; totalPnL: number }>();

    for (const trade of trades) {
        const setupType = trade.setup_type || 'Unclassified';
        const current = setupMap.get(setupType) || { wins: 0, losses: 0, totalPnL: 0 };

        if (trade.pnl > 0) {
            current.wins += 1;
        } else if (trade.pnl < 0) {
            current.losses += 1;
        }
        current.totalPnL += trade.pnl || 0;

        setupMap.set(setupType, current);
    }

    const result: SetupPerformance[] = [];
    setupMap.forEach((data, setupType) => {
        const total = data.wins + data.losses;
        result.push({
            setupType,
            winRate: total > 0 ? (data.wins / total) * 100 : 0,
            netPnL: Math.round(data.totalPnL * 100) / 100,
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
    const psychMap = new Map<string, { totalPnL: number; count: number }>();

    for (const trade of trades) {
        const tag = trade.psychology_tag || 'Untagged';
        const current = psychMap.get(tag) || { totalPnL: 0, count: 0 };
        current.totalPnL += trade.pnl || 0;
        current.count += 1;
        psychMap.set(tag, current);
    }

    const result: PsychologyBreakdown[] = [];
    psychMap.forEach((data, tag) => {
        result.push({
            tag,
            totalPnL: Math.round(data.totalPnL * 100) / 100,
            tradeCount: data.count,
            isPositive: data.totalPnL >= 0,
        });
    });

    // Sort by trade count descending
    return result.sort((a, b) => b.tradeCount - a.tradeCount);
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
