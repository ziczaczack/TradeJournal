import { Trade } from './tradeQueries';

export interface TradeStats {
    totalPnL: number;
    winRate: number;
    avgDurationSeconds: number;
    disciplineRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
}

/**
 * Parse duration string to seconds
 * Examples: "2min 46sec" -> 166, "1hr 30min" -> 5400
 */
function parseDurationToSeconds(duration: string | null | undefined): number {
    if (!duration) return 0;

    let seconds = 0;
    const hoursMatch = duration.match(/(\d+)\s*hr/i);
    const minutesMatch = duration.match(/(\d+)\s*min/i);
    const secondsMatch = duration.match(/(\d+)\s*sec/i);

    if (hoursMatch) seconds += parseInt(hoursMatch[1], 10) * 3600;
    if (minutesMatch) seconds += parseInt(minutesMatch[1], 10) * 60;
    if (secondsMatch) seconds += parseInt(secondsMatch[1], 10);

    return seconds;
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
    if (seconds === 0) return '-';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 && hours === 0) parts.push(`${secs}s`);

    return parts.join(' ') || '-';
}

/**
 * Calculate all trading statistics
 */
export function calculateStats(trades: Trade[]): TradeStats {
    if (trades.length === 0) {
        return {
            totalPnL: 0,
            winRate: 0,
            avgDurationSeconds: 0,
            disciplineRate: 0,
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
        };
    }

    // Total PnL
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    // Win/Loss counts
    const winningTrades = trades.filter((t) => t.pnl > 0).length;
    const losingTrades = trades.filter((t) => t.pnl < 0).length;

    // Win Rate
    const winRate = (winningTrades / trades.length) * 100;

    // Average Duration
    const totalDurationSeconds = trades.reduce(
        (sum, t) => sum + parseDurationToSeconds(t.duration),
        0
    );
    const avgDurationSeconds = totalDurationSeconds / trades.length;

    // Discipline Rate (is_valid_setup === true)
    const validSetupTrades = trades.filter((t) => t.is_valid_setup === true).length;
    const tradesWithSetupInfo = trades.filter((t) => t.is_valid_setup !== null).length;
    const disciplineRate = tradesWithSetupInfo > 0
        ? (validSetupTrades / tradesWithSetupInfo) * 100
        : 0;

    return {
        totalPnL,
        winRate,
        avgDurationSeconds,
        disciplineRate,
        totalTrades: trades.length,
        winningTrades,
        losingTrades,
    };
}

/**
 * Format PnL with color indicator
 */
export function formatPnL(pnl: number): { text: string; isPositive: boolean } {
    const isPositive = pnl >= 0;
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        signDisplay: 'always',
    }).format(pnl);

    return { text: formatted, isPositive };
}
