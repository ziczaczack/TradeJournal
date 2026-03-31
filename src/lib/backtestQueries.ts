import { getSupabase } from './supabase';

export interface BacktestSession {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    initial_balance: number;
    created_at: string;
    updated_at: string;
}

export interface BacktestTrade {
    id: string;
    session_id: string;
    user_id: string;
    symbol: string | null;
    entry_price: number | null;
    exit_price: number | null;
    pnl: number;
    rrr: number | null;
    result: 'win' | 'loss' | 'breakeven';
    notes: string | null;
    screenshot_url: string | null;
    playbook_setup_id: string | null;
    trade_time: string;
    created_at: string;
}

export interface CreateBacktestSession {
    name: string;
    description?: string;
    initial_balance?: number;
}

export interface CreateBacktestTrade {
    session_id: string;
    symbol?: string;
    entry_price?: number;
    exit_price?: number;
    pnl: number;
    rrr?: number;
    result?: 'win' | 'loss' | 'breakeven';
    notes?: string;
    screenshot_url?: string;
    playbook_setup_id?: string;
    trade_time?: string;
}

// ============================================
// Session Queries
// ============================================

export async function fetchBacktestSessions(): Promise<BacktestSession[]> {
    const { data, error } = await getSupabase()
        .from('backtest_sessions')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
}

export async function createBacktestSession(session: CreateBacktestSession): Promise<BacktestSession> {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
        .from('backtest_sessions')
        .insert({
            ...session,
            user_id: user.id
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteBacktestSession(id: string): Promise<void> {
    const { error } = await getSupabase()
        .from('backtest_sessions')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ============================================
// Trade Queries
// ============================================

export async function fetchBacktestTrades(sessionId: string): Promise<BacktestTrade[]> {
    const { data, error } = await getSupabase()
        .from('backtest_trades')
        .select('*')
        .eq('session_id', sessionId)
        .order('trade_time', { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function createBacktestTrade(trade: CreateBacktestTrade): Promise<BacktestTrade> {
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabase
        .from('backtest_trades')
        .insert({
            ...trade,
            user_id: user.id
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteBacktestTrade(id: string): Promise<void> {
    const { error } = await getSupabase()
        .from('backtest_trades')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
