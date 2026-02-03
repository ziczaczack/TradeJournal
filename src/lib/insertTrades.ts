import { getSupabase } from './supabase';
import { TradingJournalRecord } from './processTradovateCSV';

export interface InsertResult {
    success: boolean;
    insertedCount: number;
    skippedCount: number;
    error?: string;
}

const BATCH_SIZE = 100;

/**
 * Batch inserts trades into trading_journal table.
 * Uses upsert with onConflict to skip duplicates based on trade_id.
 */
export async function insertTrades(
    trades: TradingJournalRecord[],
    userId?: string | null // Made optional
): Promise<InsertResult> {
    if (trades.length === 0) {
        return { success: true, insertedCount: 0, skippedCount: 0 };
    }

    let insertedCount = 0;
    let skippedCount = 0;

    // Check if userId is a valid UUID (optional)
    const isValidUUID = userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

    // Prepare trades - only add user_id if valid
    const tradesForInsert = trades.map((trade) => ({
        ...trade,
        ...(isValidUUID ? { user_id: userId } : {}),
    }));

    // Process in batches
    for (let i = 0; i < tradesForInsert.length; i += BATCH_SIZE) {
        const batch = tradesForInsert.slice(i, i + BATCH_SIZE);

        const { data, error } = await getSupabase()
            .from('trading_journal')
            .upsert(batch, {
                onConflict: 'trade_id',
                ignoreDuplicates: true,
            })
            .select();

        if (error) {
            console.error('Supabase insert error:', error);
            return {
                success: false,
                insertedCount,
                skippedCount,
                error: error.message,
            };
        }

        const batchInserted = data?.length || 0;
        insertedCount += batchInserted;
        skippedCount += batch.length - batchInserted;
    }

    return {
        success: true,
        insertedCount,
        skippedCount,
    };
}
