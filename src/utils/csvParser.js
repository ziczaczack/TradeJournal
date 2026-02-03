/**
 * Trading Performance CSV Parser
 * 
 * Parses Tradovate Performance Report CSV files and prepares data for PostgreSQL/Supabase.
 * 
 * @module csvParser
 */

/**
 * Expected CSV column headers from Tradovate Performance Report
 */
const EXPECTED_HEADERS = [
  'symbol',
  '_priceFormat',
  '_priceFormatType',
  '_tickSize',
  'buyFillId',
  'sellFillId',
  'qty',
  'buyPrice',
  'sellPrice',
  'pnl',
  'boughtTimestamp',
  'soldTimestamp',
  'duration'
];

/**
 * Converts a PNL string from Tradovate format to a standard float.
 * 
 * Handles formats like:
 * - "$100.00" -> 100.00
 * - "$(168.00)" -> -168.00
 * - "$1,234.56" -> 1234.56
 * - "$(1,234.56)" -> -1234.56
 * 
 * @param {string} pnlString - The PNL string to clean (e.g., "$(168.00)")
 * @returns {number} The cleaned PNL as a float
 * @throws {Error} If the PNL string format is invalid
 */
function cleanPnl(pnlString) {
  if (pnlString === null || pnlString === undefined || pnlString === '') {
    return 0;
  }

  const str = String(pnlString).trim();
  
  // Check for negative indicator (brackets)
  const isNegative = str.includes('(') && str.includes(')');
  
  // Remove $, (, ), commas, and whitespace
  const cleanedStr = str.replace(/[$(),\s]/g, '');
  
  // Parse to float
  const value = parseFloat(cleanedStr);
  
  if (isNaN(value)) {
    throw new Error(`Invalid PNL format: "${pnlString}"`);
  }
  
  return isNegative ? -value : value;
}

/**
 * Generates a unique trade key by combining buyFillId and sellFillId.
 * This prevents duplicate imports by providing a consistent identifier.
 * 
 * @param {string|number} buyFillId - The buy fill ID
 * @param {string|number} sellFillId - The sell fill ID
 * @returns {string} A unique trade key
 */
function generateTradeKey(buyFillId, sellFillId) {
  // Handle scientific notation (e.g., 3.55524E+11)
  const buyId = String(buyFillId).trim();
  const sellId = String(sellFillId).trim();
  
  // Convert scientific notation to full number string for consistency
  const normalizedBuyId = parseFloat(buyId).toLocaleString('fullwide', { useGrouping: false });
  const normalizedSellId = parseFloat(sellId).toLocaleString('fullwide', { useGrouping: false });
  
  return `${normalizedBuyId}_${normalizedSellId}`;
}

/**
 * Parses a Tradovate timestamp string into an ISO string.
 * 
 * Handles format: "MM/DD/YYYY HH:mm:ss"
 * Example: "01/30/2026 00:25:41" -> "2026-01-30T00:25:41.000Z"
 * 
 * @param {string} timestampStr - The timestamp string to parse
 * @returns {string|null} ISO 8601 formatted timestamp string, or null if invalid
 */
function parseTimestamp(timestampStr) {
  if (!timestampStr || typeof timestampStr !== 'string') {
    return null;
  }

  const str = timestampStr.trim().replace(/^"|"$/g, ''); // Remove surrounding quotes
  
  // Match format: MM/DD/YYYY HH:mm:ss
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  
  if (!match) {
    console.warn(`Invalid timestamp format: "${timestampStr}"`);
    return null;
  }

  const [, month, day, year, hours, minutes, seconds] = match;
  
  // Create Date object (treating as local time, adjust as needed)
  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1, // Month is 0-indexed
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(minutes, 10),
    parseInt(seconds, 10)
  );

  // Validate the date
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date created from: "${timestampStr}"`);
    return null;
  }

  return date.toISOString();
}

/**
 * Parses a duration string into total seconds.
 * 
 * Handles formats like:
 * - "2min 46sec" -> 166
 * - "1hr 30min 15sec" -> 5415
 * - "45sec" -> 45
 * 
 * @param {string} durationStr - The duration string to parse
 * @returns {number|null} Duration in seconds, or null if invalid
 */
function parseDuration(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') {
    return null;
  }

  const str = durationStr.trim().replace(/^"|"$/g, '');
  let totalSeconds = 0;

  // Extract hours
  const hoursMatch = str.match(/(\d+)\s*hr/i);
  if (hoursMatch) {
    totalSeconds += parseInt(hoursMatch[1], 10) * 3600;
  }

  // Extract minutes
  const minutesMatch = str.match(/(\d+)\s*min/i);
  if (minutesMatch) {
    totalSeconds += parseInt(minutesMatch[1], 10) * 60;
  }

  // Extract seconds
  const secondsMatch = str.match(/(\d+)\s*sec/i);
  if (secondsMatch) {
    totalSeconds += parseInt(secondsMatch[1], 10);
  }

  return totalSeconds > 0 ? totalSeconds : null;
}

/**
 * Parses a single CSV line, handling quoted fields properly.
 * 
 * @param {string} line - A single CSV line
 * @returns {string[]} Array of field values
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Push the last field
  result.push(current.trim());
  
  return result;
}

/**
 * Validates that CSV headers match expected format.
 * 
 * @param {string[]} headers - Array of header names from CSV
 * @returns {{ valid: boolean, missing: string[], extra: string[] }}
 */
function validateHeaders(headers) {
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  const expectedLower = EXPECTED_HEADERS.map(h => h.toLowerCase());
  
  const missing = expectedLower.filter(h => !normalizedHeaders.includes(h));
  const extra = normalizedHeaders.filter(h => !expectedLower.includes(h) && h !== '');
  
  return {
    valid: missing.length === 0,
    missing: missing.map(h => EXPECTED_HEADERS.find(e => e.toLowerCase() === h)),
    extra
  };
}

/**
 * Main parser function for Tradovate Performance Report CSV.
 * 
 * @param {string} csvString - The raw CSV string to parse
 * @param {Object} options - Parser options
 * @param {boolean} [options.strictHeaders=false] - Throw error if headers don't match exactly
 * @param {boolean} [options.skipEmptyRows=true] - Skip rows that are empty
 * @param {boolean} [options.skipInvalidRows=false] - Skip rows with parsing errors instead of throwing
 * @returns {{ 
 *   data: Array<Object>, 
 *   errors: Array<{ row: number, message: string }>,
 *   warnings: Array<{ row: number, message: string }>,
 *   metadata: { totalRows: number, parsedRows: number, skippedRows: number }
 * }}
 * @throws {Error} If CSV is empty, has no headers, or headers are invalid (with strictHeaders)
 */
function parseTradingPerformance(csvString, options = {}) {
  const {
    strictHeaders = false,
    skipEmptyRows = true,
    skipInvalidRows = false
  } = options;

  // Validation
  if (!csvString || typeof csvString !== 'string') {
    throw new Error('CSV input must be a non-empty string');
  }

  // Normalize line endings and split into lines
  const lines = csvString
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  // Filter out completely empty lines at the start
  const nonEmptyLines = lines.filter((line, index) => {
    if (index === 0) return true; // Keep header even if it looks empty
    return line.trim() !== '';
  });

  if (nonEmptyLines.length === 0) {
    throw new Error('CSV is empty');
  }

  // Parse headers
  const headerLine = nonEmptyLines[0];
  const headers = parseCSVLine(headerLine);

  if (headers.length === 0 || headers.every(h => h === '')) {
    throw new Error('CSV has no valid headers');
  }

  // Validate headers
  const headerValidation = validateHeaders(headers);
  
  if (!headerValidation.valid) {
    const message = `Missing required headers: ${headerValidation.missing.join(', ')}`;
    if (strictHeaders) {
      throw new Error(message);
    }
    console.warn(message);
  }

  if (headerValidation.extra.length > 0) {
    console.warn(`Extra headers found (will be ignored): ${headerValidation.extra.join(', ')}`);
  }

  // Create header index map
  const headerMap = {};
  headers.forEach((header, index) => {
    headerMap[header.trim().toLowerCase()] = index;
  });

  // Helper to get value by header name
  const getValue = (fields, headerName) => {
    const index = headerMap[headerName.toLowerCase()];
    if (index === undefined || index >= fields.length) {
      return null;
    }
    return fields[index];
  };

  // Parse data rows
  const data = [];
  const errors = [];
  const warnings = [];
  let skippedRows = 0;

  for (let i = 1; i < nonEmptyLines.length; i++) {
    const line = nonEmptyLines[i];
    const rowNumber = i + 1; // 1-indexed for user-friendly errors

    // Skip empty rows
    if (skipEmptyRows && line.trim() === '') {
      skippedRows++;
      continue;
    }

    try {
      const fields = parseCSVLine(line);

      // Skip if row has no meaningful data
      if (fields.every(f => f === '')) {
        skippedRows++;
        continue;
      }

      // Extract and transform values
      const symbol = getValue(fields, 'symbol');
      const buyFillId = getValue(fields, 'buyFillId');
      const sellFillId = getValue(fields, 'sellFillId');

      // Validate required fields
      if (!symbol) {
        throw new Error('Missing required field: symbol');
      }
      if (!buyFillId || !sellFillId) {
        throw new Error('Missing required field: buyFillId or sellFillId');
      }

      // Build the trade record
      const trade = {
        // Generate unique trade key
        trade_key: generateTradeKey(buyFillId, sellFillId),
        
        // Core trade data
        symbol: symbol,
        qty: parseInt(getValue(fields, 'qty'), 10) || 0,
        buy_price: parseFloat(getValue(fields, 'buyPrice')) || 0,
        sell_price: parseFloat(getValue(fields, 'sellPrice')) || 0,
        pnl: cleanPnl(getValue(fields, 'pnl')),
        
        // Original IDs
        buy_fill_id: buyFillId,
        sell_fill_id: sellFillId,
        
        // Timestamps
        bought_timestamp: parseTimestamp(getValue(fields, 'boughtTimestamp')),
        sold_timestamp: parseTimestamp(getValue(fields, 'soldTimestamp')),
        
        // Duration in seconds
        duration_seconds: parseDuration(getValue(fields, 'duration')),
        duration_raw: getValue(fields, 'duration'),
        
        // Price format metadata
        price_format: parseInt(getValue(fields, '_priceFormat'), 10) || 0,
        price_format_type: parseInt(getValue(fields, '_priceFormatType'), 10) || 0,
        tick_size: parseFloat(getValue(fields, '_tickSize')) || 0,
        
        // Metadata for tracking
        imported_at: new Date().toISOString(),
        source: 'tradovate_performance_report'
      };

      data.push(trade);

    } catch (error) {
      const errorInfo = { row: rowNumber, message: error.message };
      
      if (skipInvalidRows) {
        errors.push(errorInfo);
        skippedRows++;
      } else {
        throw new Error(`Row ${rowNumber}: ${error.message}`);
      }
    }
  }

  return {
    data,
    errors,
    warnings,
    metadata: {
      totalRows: nonEmptyLines.length - 1, // Exclude header
      parsedRows: data.length,
      skippedRows
    }
  };
}

// Export all functions for flexibility
module.exports = {
  parseTradingPerformance,
  cleanPnl,
  generateTradeKey,
  parseTimestamp,
  parseDuration,
  parseCSVLine,
  validateHeaders,
  EXPECTED_HEADERS
};
