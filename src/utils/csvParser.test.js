/**
 * Test suite for csvParser.js
 * Run with: node csvParser.test.js
 */

const {
    parseTradingPerformance,
    cleanPnl,
    generateTradeKey,
    parseTimestamp,
    parseDuration
} = require('./csvParser');

// Test utilities
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  Error: ${error.message}`);
        failed++;
    }
}

function assertEqual(actual, expected, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`);
    }
}

// ============================================
// Unit Tests: cleanPnl
// ============================================
console.log('\n--- cleanPnl Tests ---');

test('cleanPnl: positive value', () => {
    assertEqual(cleanPnl('$100.00'), 100);
});

test('cleanPnl: negative value with brackets', () => {
    assertEqual(cleanPnl('$(168.00)'), -168);
});

test('cleanPnl: value with commas', () => {
    assertEqual(cleanPnl('$1,234.56'), 1234.56);
});

test('cleanPnl: negative value with commas', () => {
    assertEqual(cleanPnl('$(1,234.56)'), -1234.56);
});

test('cleanPnl: empty string returns 0', () => {
    assertEqual(cleanPnl(''), 0);
});

test('cleanPnl: null returns 0', () => {
    assertEqual(cleanPnl(null), 0);
});

test('cleanPnl: undefined returns 0', () => {
    assertEqual(cleanPnl(undefined), 0);
});

// ============================================
// Unit Tests: generateTradeKey
// ============================================
console.log('\n--- generateTradeKey Tests ---');

test('generateTradeKey: simple IDs', () => {
    const key = generateTradeKey('123', '456');
    assertEqual(key, '123_456');
});

test('generateTradeKey: scientific notation', () => {
    const key = generateTradeKey('3.55524E+11', '3.55525E+11');
    // Should normalize scientific notation
    assertEqual(key.includes('_'), true);
    assertEqual(key.includes('E'), false);
});

// ============================================
// Unit Tests: parseTimestamp
// ============================================
console.log('\n--- parseTimestamp Tests ---');

test('parseTimestamp: valid format', () => {
    const result = parseTimestamp('01/30/2026 00:25:41');
    const date = new Date(result);
    assertEqual(date.getFullYear(), 2026);
    assertEqual(date.getMonth(), 0); // January
    assertEqual(date.getDate(), 30);
});

test('parseTimestamp: with quotes', () => {
    const result = parseTimestamp('"01/30/2026 00:25:41"');
    const date = new Date(result);
    assertEqual(date.getFullYear(), 2026);
});

test('parseTimestamp: empty returns null', () => {
    assertEqual(parseTimestamp(''), null);
});

test('parseTimestamp: invalid format returns null', () => {
    assertEqual(parseTimestamp('2026-01-30'), null);
});

// ============================================
// Unit Tests: parseDuration
// ============================================
console.log('\n--- parseDuration Tests ---');

test('parseDuration: minutes and seconds', () => {
    assertEqual(parseDuration('2min 46sec'), 166); // 2*60 + 46
});

test('parseDuration: hours, minutes, seconds', () => {
    assertEqual(parseDuration('1hr 30min 15sec'), 5415); // 3600 + 1800 + 15
});

test('parseDuration: only seconds', () => {
    assertEqual(parseDuration('45sec'), 45);
});

test('parseDuration: only minutes', () => {
    assertEqual(parseDuration('5min'), 300);
});

// ============================================
// Integration Tests: parseTradingPerformance
// ============================================
console.log('\n--- parseTradingPerformance Tests ---');

const sampleCSV = `symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
MNQH6,-2,0,0.25,3.55524E+11,3.55524E+11,2,25707.25,25665.25,"$(168.00)","01/30/2026 00:25:41","01/30/2026 00:28:28","2min 46sec"
ESH6,-2,0,0.25,3.55525E+11,3.55526E+11,1,5000.50,5010.75,"$51.25","01/30/2026 01:00:00","01/30/2026 01:05:30","5min 30sec"`;

test('parseTradingPerformance: parses sample CSV correctly', () => {
    const result = parseTradingPerformance(sampleCSV);

    assertEqual(result.data.length, 2);
    assertEqual(result.metadata.parsedRows, 2);
    assertEqual(result.errors.length, 0);
});

test('parseTradingPerformance: first trade has correct values', () => {
    const result = parseTradingPerformance(sampleCSV);
    const trade = result.data[0];

    assertEqual(trade.symbol, 'MNQH6');
    assertEqual(trade.qty, 2);
    assertEqual(trade.buy_price, 25707.25);
    assertEqual(trade.sell_price, 25665.25);
    assertEqual(trade.pnl, -168);
    assertEqual(trade.duration_seconds, 166);
    assertEqual(trade.trade_key.includes('_'), true);
});

test('parseTradingPerformance: second trade has positive PNL', () => {
    const result = parseTradingPerformance(sampleCSV);
    const trade = result.data[1];

    assertEqual(trade.pnl, 51.25);
});

test('parseTradingPerformance: throws on empty input', () => {
    let threw = false;
    try {
        parseTradingPerformance('');
    } catch (e) {
        threw = true;
    }
    assertEqual(threw, true);
});

test('parseTradingPerformance: handles rows with empty lines', () => {
    const csvWithEmptyLines = `symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration

MNQH6,-2,0,0.25,3.55524E+11,3.55524E+11,2,25707.25,25665.25,"$(168.00)","01/30/2026 00:25:41","01/30/2026 00:28:28","2min 46sec"

`;
    const result = parseTradingPerformance(csvWithEmptyLines);
    assertEqual(result.data.length, 1);
});

test('parseTradingPerformance: skipInvalidRows option works', () => {
    const csvWithBadRow = `symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
,-2,0,0.25,111,222,2,100,100,"$0","01/01/2026 00:00:00","01/01/2026 00:00:00","1sec"
MNQH6,-2,0,0.25,333,444,1,100,110,"$10","01/01/2026 00:00:00","01/01/2026 00:00:00","1sec"`;

    const result = parseTradingPerformance(csvWithBadRow, { skipInvalidRows: true });
    assertEqual(result.data.length, 1);
    assertEqual(result.errors.length, 1);
});

// ============================================
// Summary
// ============================================
console.log('\n=====================================');
console.log(`Tests completed: ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log('=====================================');

if (failed > 0) {
    process.exit(1);
}
