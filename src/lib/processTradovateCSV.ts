/**
 * Tradovate CSV Parser (TypeScript/Client-side version)
 * 
 * Parses Tradovate Performance Report CSV files using PapaParse
 * and prepares data for insertion into the trading_journal table.
 */

import Papa from 'papaparse';
import CryptoJS from 'crypto-js';

// Type definitions
export interface TradovateRow {
    symbol: string;
    _priceFormat: string;
    _priceFormatType: string;
    _tickSize: string;
    buyFillId: string;
    sellFillId: string;
    qty: string;
    buyPrice: string;
    sellPrice: string;
    pnl: string;
    boughtTimestamp: string;
    soldTimestamp: string;
    duration: string;
}

export interface TradingJournalRecord {
    symbol: string;
    pnl: number;
    buy_price: number;
    sell_price: number;
    quantity: number;
    entry_time: string | null;
    exit_time: string | null;
    duration: string;
    trade_id: string;
}

export interface ParseResult {
    data: TradingJournalRecord[];
    errors: Array<{ row: number; message: string }>;
    metadata: {
        totalRows: number;
        parsedRows: number;
        skippedRows: number;
    };
}

/**
 * Cleans PNL string from Tradovate format to a number.
 * Examples:
 * - "$100.00" -> 100.00
 * - "$(168.00)" -> -168.00
 * - "$1,234.56" -> 1234.56
 */
function cleanPnl(pnlString: string | null | undefined): number {
    if (pnlString === null || pnlString === undefined || pnlString === '') {
        return 0;
    }

    const str = String(pnlString).trim();
    const isNegative = str.includes('(') && str.includes(')');
    const cleanedStr = str.replace(/[$(),\s]/g, '');
    const value = parseFloat(cleanedStr);

    if (isNaN(value)) {
        throw new Error(`Invalid PNL format: "${pnlString}"`);
    }

    return isNegative ? -value : value;
}

/**
 * Parses a Tradovate timestamp to ISO string.
 * Format: "MM/DD/YYYY HH:mm:ss" -> "2026-01-30T00:25:41.000Z"
 */
function parseTimestamp(timestampStr: string | null | undefined): string | null {
    if (!timestampStr || typeof timestampStr !== 'string') {
        return null;
    }

    const str = timestampStr.trim().replace(/^"|"$/g, '');
    const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);

    if (!match) {
        console.warn(`Invalid timestamp format: "${timestampStr}"`);
        return null;
    }

    const [, month, day, year, hours, minutes, seconds] = match;

    // 使用 Date.UTC 确保时间戳以 UTC 存储，不受客户端时区影响
    const utcMillis = Date.UTC(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hours, 10),
        parseInt(minutes, 10),
        parseInt(seconds, 10)
    );
    const date = new Date(utcMillis);

    if (isNaN(date.getTime())) {
        console.warn(`Invalid date created from: "${timestampStr}"`);
        return null;
    }

    return date.toISOString();
}

/**
 * Generates a unique trade_id using MD5 hash.
 * Formula: md5(symbol + qty + entry_time + exit_time)
 */
function generateTradeId(
    symbol: string,
    qty: string | number,
    entryTime: string | null,
    exitTime: string | null
): string {
    const input = `${symbol}${qty}${entryTime || ''}${exitTime || ''}`;
    return CryptoJS.MD5(input).toString();
}

/**
 * Main parser function for Tradovate Performance Report CSV.
 * Uses PapaParse for robust CSV parsing.
 */
export function processTradovateCSV(csvString: string): ParseResult {
    const errors: Array<{ row: number; message: string }> = [];
    const data: TradingJournalRecord[] = [];
    let skippedRows = 0;

    // Parse CSV using PapaParse
    const parseResult = Papa.parse<TradovateRow>(csvString, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
    });

    // Check for parsing errors
    if (parseResult.errors.length > 0) {
        parseResult.errors.forEach((err) => {
            errors.push({
                row: err.row ?? 0,
                message: err.message,
            });
        });
    }

    // Process each row
    parseResult.data.forEach((row, index) => {
        const rowNumber = index + 2; // 1-indexed, accounting for header

        try {
            // Validate required fields
            if (!row.symbol) {
                throw new Error('Missing required field: symbol');
            }
            if (!row.buyFillId || !row.sellFillId) {
                throw new Error('Missing required field: buyFillId or sellFillId');
            }

            // Parse timestamps
            const entryTime = parseTimestamp(row.boughtTimestamp);
            const exitTime = parseTimestamp(row.soldTimestamp);

            // Build the trade record matching trading_journal schema
            const trade: TradingJournalRecord = {
                symbol: row.symbol,
                pnl: cleanPnl(row.pnl),
                buy_price: parseFloat(row.buyPrice) || 0,
                sell_price: parseFloat(row.sellPrice) || 0,
                quantity: parseInt(row.qty, 10) || 0,
                entry_time: entryTime,
                exit_time: exitTime,
                duration: row.duration || '',
                trade_id: generateTradeId(row.symbol, row.qty, entryTime, exitTime),
            };

            data.push(trade);
        } catch (error) {
            errors.push({
                row: rowNumber,
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            skippedRows++;
        }
    });

    return {
        data,
        errors,
        metadata: {
            totalRows: parseResult.data.length,
            parsedRows: data.length,
            skippedRows,
        },
    };
}
