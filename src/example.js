/**
 * Example usage of the CSV Parser for Tradovate Performance Reports
 * 
 * This file demonstrates how to use the parseTradingPerformance function
 * to parse CSV data and prepare it for database insertion.
 */

const fs = require('fs');
const path = require('path');
const { parseTradingPerformance } = require('./utils/csvParser');

// Example: Parse a CSV file
async function processPerformanceReport(filePath) {
    try {
        // Read the CSV file
        const csvString = fs.readFileSync(filePath, 'utf-8');

        // Parse the CSV with options
        const result = parseTradingPerformance(csvString, {
            strictHeaders: false,     // Don't throw on missing headers
            skipEmptyRows: true,      // Skip empty lines
            skipInvalidRows: true     // Skip rows with errors, continue parsing
        });

        // Log metadata
        console.log('Parse Results:');
        console.log(`  Total rows: ${result.metadata.totalRows}`);
        console.log(`  Successfully parsed: ${result.metadata.parsedRows}`);
        console.log(`  Skipped: ${result.metadata.skippedRows}`);

        // Log any errors
        if (result.errors.length > 0) {
            console.log('\nErrors:');
            result.errors.forEach(err => {
                console.log(`  Row ${err.row}: ${err.message}`);
            });
        }

        // Return the parsed data
        return result.data;

    } catch (error) {
        console.error('Failed to parse CSV:', error.message);
        throw error;
    }
}

// Example: Insert into Supabase
async function insertToSupabase(trades, supabaseClient) {
    // Batch insert with upsert to prevent duplicates
    const { data, error } = await supabaseClient
        .from('trades')
        .upsert(trades, {
            onConflict: 'trade_key',  // Use trade_key as unique constraint
            ignoreDuplicates: true
        });

    if (error) {
        throw new Error(`Supabase insert failed: ${error.message}`);
    }

    return data;
}

// Example: Full workflow
async function importPerformanceReport(filePath, supabaseClient) {
    console.log(`\nImporting: ${filePath}`);

    // 1. Parse the CSV
    const trades = await processPerformanceReport(filePath);

    console.log(`\nSample trade record:`);
    console.log(JSON.stringify(trades[0], null, 2));

    // 2. Insert to database (uncomment when ready)
    // await insertToSupabase(trades, supabaseClient);

    console.log(`\n✓ Parsed ${trades.length} trades ready for insertion`);

    return trades;
}

// Demo with inline CSV string
function demo() {
    const sampleCSV = `symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
MNQH6,-2,0,0.25,3.55524E+11,3.55524E+11,2,25707.25,25665.25,"$(168.00)","01/30/2026 00:25:41","01/30/2026 00:28:28","2min 46sec"
ESH6,-2,0,0.25,3.55525E+11,3.55526E+11,1,5000.50,5010.75,"$51.25","01/30/2026 01:00:00","01/30/2026 01:05:30","5min 30sec"
NQM6,-2,0,0.25,3.55527E+11,3.55528E+11,3,21500.00,21525.50,"$153.00","01/30/2026 02:15:00","01/30/2026 02:45:30","30min 30sec"`;

    console.log('=== Tradovate CSV Parser Demo ===\n');

    const result = parseTradingPerformance(sampleCSV);

    console.log('Parsed Data:');
    result.data.forEach((trade, index) => {
        console.log(`\nTrade ${index + 1}:`);
        console.log(`  Symbol: ${trade.symbol}`);
        console.log(`  Trade Key: ${trade.trade_key}`);
        console.log(`  Qty: ${trade.qty}`);
        console.log(`  Buy: $${trade.buy_price} | Sell: $${trade.sell_price}`);
        console.log(`  PNL: $${trade.pnl.toFixed(2)}`);
        console.log(`  Duration: ${trade.duration_seconds}s (${trade.duration_raw})`);
        console.log(`  Bought: ${trade.bought_timestamp}`);
        console.log(`  Sold: ${trade.sold_timestamp}`);
    });

    // Summary
    const totalPnl = result.data.reduce((sum, t) => sum + t.pnl, 0);
    console.log('\n--- Summary ---');
    console.log(`Total Trades: ${result.data.length}`);
    console.log(`Total PNL: $${totalPnl.toFixed(2)}`);
    console.log(`Winners: ${result.data.filter(t => t.pnl > 0).length}`);
    console.log(`Losers: ${result.data.filter(t => t.pnl < 0).length}`);
}

// Run demo
demo();

module.exports = {
    processPerformanceReport,
    insertToSupabase,
    importPerformanceReport
};
