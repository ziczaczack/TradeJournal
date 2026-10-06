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
 * Check that userId is a valid UUID
 * @throws Error if userId is empty or malformed
 */
function validateUserId(userId: unknown): string {
    if (!userId || typeof userId !== 'string') {
        throw new Error('SECURITY_ERROR: user_id is required for multi-tenant isolation');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
        throw new Error('SECURITY_ERROR: user_id must be a valid UUID format');
    }

    return userId;
}

/**
 * Batch inserts trades into trading_journal table.
 * Uses upsert with onConflict to skip duplicates based on trade_id.
 * 
 * @param trades - Array of trade records to insert
 * @param userId - Required user ID (must be valid UUID)
 * @param accountId - Required account ID to associate trades with
 * @throws Error if userId is missing or invalid
 */
export async function insertTrades(
    trades: TradingJournalRecord[],
    userId: string, // required
    accountId: string
): Promise<InsertResult> {
    // Validate userId first; throws if invalid
    const validatedUserId = validateUserId(userId);

    if (!accountId) {
        return {
            success: false,
            insertedCount: 0,
            skippedCount: 0,
            error: 'account_id is required for multi-account management',
        };
    }

    if (trades.length === 0) {
        return { success: true, insertedCount: 0, skippedCount: 0 };
    }

    let insertedCount = 0;
    let skippedCount = 0;

    // Every row must carry a valid user_id and account_id
    const tradesForInsert = trades.map((trade) => ({
        ...trade,
        user_id: validatedUserId,
        account_id: accountId,
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
