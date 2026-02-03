import { getSupabase } from './supabase';
import { startOfMonth, endOfMonth, format } from 'date-fns';

// Type definition for a trade from the database
export interface Trade {
    id: string;
    user_id?: string | null;
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
}


export interface TradeFilters {
    symbol?: string;
    setupType?: string;
}

export interface TradeUpdate {
    setup_type?: string | null;
    is_valid_setup?: boolean | null;
    psychology_tag?: string | null;
    notes?: string | null;
    screenshot_url?: string | null;
    rating?: number | null;
}

/**
 * Fetch all trades with optional filters
 */
export async function fetchTrades(filters?: TradeFilters): Promise<Trade[]> {
    // Optimized query: only fetch fields needed for list views
    // notes and screenshot_url are excluded to reduce payload
    let query = getSupabase()
        .from('trading_journal')
        .select('id, symbol, pnl, buy_price, sell_price, quantity, entry_time, exit_time, duration, trade_id, setup_type, is_valid_setup, psychology_tag, rating')
        .order('entry_time', { ascending: false });

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
 * Fetch trades for a specific month (by exit_time)
 * Used by the calendar component for efficient data loading
 */
export async function fetchTradesByMonth(year: number, month: number): Promise<Trade[]> {
    const monthDate = new Date(year, month, 1);
    const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

    // Optimized query: only fetch fields needed for calendar display
    const { data, error } = await getSupabase()
        .from('trading_journal')
        .select('id, symbol, pnl, entry_time, exit_time, duration, trade_id, setup_type, is_valid_setup, psychology_tag, rating')
        .gte('exit_time', `${monthStart}T00:00:00`)
        .lte('exit_time', `${monthEnd}T23:59:59`)
        .order('exit_time', { ascending: false });

    if (error) {
        console.error('Error fetching trades by month:', error);
        throw error;
    }

    return (data as Trade[]) || [];
}
