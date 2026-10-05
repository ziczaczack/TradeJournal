import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// Type definition for a trade from the database
export interface Trade {
    id: string;
    user_id?: string | null;
    account_id?: string | null;
    symbol: string;
    pnl: number;
    buy_price?: number | null;
    sell_price?: number | null;
    quantity?: number | null;
    entry_time?: string | null;
    exit_time?: string | null;
    duration?: string | null;
    trade_id: string;
    setup_type?: string | null;
    is_valid_setup?: boolean | null;
    psychology_tag?: string | null;
    notes?: string | null;
    screenshot_url?: string | null;
    rating?: number | null;
    ai_feedback?: Record<string, unknown> | null;
    mistake_tag_ids?: string[];
    mistakes_reviewed?: boolean;
    review_template?: 'full' | 'basic' | null;
    review_answers?: Record<string, string>;
}


export interface TradeFilters {
    symbol?: string;
    setupType?: string;
    accountId?: string;
}

export interface TradeUpdate {
    setup_type?: string | null;
    is_valid_setup?: boolean | null;
    psychology_tag?: string | null;
    notes?: string | null;
    screenshot_url?: string | null;
    rating?: number | null;
    mistake_tag_ids?: string[];
    mistakes_reviewed?: boolean;
    review_template?: 'full' | 'basic' | null;
    review_answers?: Record<string, string>;
}

/**
 * Fetch all trades with optional filters.
 *
 * Pass an explicit `client` (e.g. a token-bound client from getSupabaseForToken)
 * when calling from a server route handler, so RLS scopes the query to the
 * authenticated user. Defaults to the browser anon client for client-side calls.
 */
export async function fetchTrades(
    filters?: TradeFilters,
    client: SupabaseClient = getSupabase()
): Promise<Trade[]> {
    // Optimized query: only fetch fields needed for list views
    // notes and screenshot_url are excluded to reduce payload
    let query = client
        .from('trading_journal')
        .select('id, account_id, symbol, pnl, buy_price, sell_price, quantity, entry_time, exit_time, duration, trade_id, setup_type, is_valid_setup, psychology_tag, rating, mistake_tag_ids, mistakes_reviewed')
        .order('entry_time', { ascending: false });

    // Filter by account if provided
    if (filters?.accountId) {
        query = query.eq('account_id', filters.accountId);
    }

    if (filters?.symbol) {
        query = query.eq('symbol', filters.symbol);
    }

    if (filters?.setupType) {
        query = query.eq('setup_type', filters.setupType);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching trades:', error);
        throw error;
    }

    return (data as Trade[]) || [];
}

/**
 * Fetch unique values for filters
 */
export async function fetchFilterOptions(): Promise<{
    symbols: string[];
    setupTypes: string[];
}> {
    const { data, error } = await getSupabase()
        .from('trading_journal')
        .select('symbol, setup_type');

    if (error) {
        console.error('Error fetching filter options:', error);
        return { symbols: [], setupTypes: [] };
    }

    const symbols = [...new Set(data?.map((d) => d.symbol).filter(Boolean))] as string[];
    const setupTypes = [...new Set(data?.map((d) => d.setup_type).filter(Boolean))] as string[];

    return { symbols, setupTypes };
}

/**
 * Update a trade's review fields
 */
export async function updateTrade(
    tradeId: string,
    updates: TradeUpdate
): Promise<Trade | null> {
    const { data, error } = await getSupabase()
        .from('trading_journal')
        .update(updates)
        .eq('id', tradeId)
        .select()
        .single();

    if (error) {
        console.error('Error updating trade:', error);
        throw error;
    }

    return data as Trade;
}

/**
 * Fetch one trade with every column. The list queries omit heavy fields
 * (notes, screenshot_url), so the review sheet must load the full row before
 * its form can be saved — otherwise saving would overwrite them with blanks.
 */
export async function fetchTradeById(
    tradeId: string,
    client: SupabaseClient = getSupabase()
): Promise<Trade> {
    const { data, error } = await client
        .from('trading_journal')
        .select('*')
        .eq('id', tradeId)
        .single();

    if (error) {
        console.error('Error fetching trade:', error);
        throw error;
    }

    return data as Trade;
}

/**
 * Fetch trades for a specific month (by exit_time)
 * Used by the calendar component for efficient data loading
 * @param accountId - Optional account ID to filter by
 */
export async function fetchTradesByMonth(
    year: number,
    month: number,
    accountId?: string
): Promise<Trade[]> {
    const monthDate = new Date(year, month, 1);
    const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    // Optimized query: only fetch fields needed for calendar display
    let query = getSupabase()
        .from('trading_journal')
        .select('id, account_id, symbol, pnl, entry_time, exit_time, duration, trade_id, setup_type, is_valid_setup, psychology_tag, rating, mistake_tag_ids, mistakes_reviewed')
        .gte('exit_time', `${monthStart}T00:00:00`)
        .lte('exit_time', `${monthEnd}T23:59:59`)
        .order('exit_time', { ascending: false });

    // Filter by account if provided
    if (accountId) {
        query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error fetching trades by month:', error);
        throw error;
    }

    return (data as Trade[]) || [];
}
