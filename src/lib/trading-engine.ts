/**
 * Trading Engine Module
 * 
 * Centralized module for all trading-related business logic.
 * This consolidates CSV parsing, statistics calculations, and chart data generation
 * for clean separation from UI components.
 */

// ===========================================
// Re-export Types from tradeQueries
// ===========================================
export type {
    Trade,
    TradeFilters,
    TradeUpdate,
} from './tradeQueries';

// ===========================================
// Re-export Statistics Types
// ===========================================
export type {
    TradeStats,
} from './tradeStats';

export type {
    AnalyticsStats,
    EquityCurvePoint,
    SetupPerformance,
    PsychologyBreakdown,
} from './analyticsStats';

// ===========================================
// Re-export CSV Parser Types
// ===========================================
export type {
    TradovateRow,
    TradingJournalRecord,
    ParseResult,
} from './processTradovateCSV';

// ===========================================
// Re-export Statistics Functions
// ===========================================
export {
    calculateStats,
    formatDuration,
    formatPnL,
} from './tradeStats';

export {
    calculateAnalyticsStats,
    generateEquityCurveData,
    generateSetupPerformanceData,
    generatePsychologyData,
    formatCurrency,
    formatPercent,
    formatRatio,
} from './analyticsStats';

// ===========================================
// Re-export CSV Parser
// ===========================================
export {
    processTradovateCSV,
} from './processTradovateCSV';
