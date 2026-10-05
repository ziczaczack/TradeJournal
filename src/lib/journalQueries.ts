import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import type { Trade } from './tradeQueries';
import { localDayBounds } from './tradeReview';

export const journalQueryKeys = {
    // Under 'trades' so the trade sheet's invalidateQueries(['trades']) refreshes the day.
    day: (day: string, accountId?: string) => ['trades', 'day', day, accountId ?? null] as const,
    note: (day: string) => ['dailyNote', day] as const,
};

/** Full rows (write-ups included) for trades entered on a local day. */
export async function fetchTradesForDay(
    day: string,
    accountId?: string,
    client: SupabaseClient = getSupabase()
): Promise<Trade[]> {
    const { start, end } = localDayBounds(day);
    let query = client
        .from('trading_journal')
        .select('*')
        .gte('entry_time', start)
        .lt('entry_time', end)
        .order('entry_time', { ascending: true });

    if (accountId) {
        query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Error fetching trades for day:', error);
        throw error;
    }
    return data as Trade[];
}

export async function fetchDailyNote(day: string, client: SupabaseClient = getSupabase()): Promise<string> {
    const { data, error } = await client
        .from('daily_notes')
        .select('note')
        .eq('note_date', day)
        .maybeSingle();

    if (error) {
        console.error('Error fetching daily note:', error);
        throw error;
    }
    return (data as { note: string } | null)?.note ?? '';
}

export async function saveDailyNote(
    userId: string,
    day: string,
    note: string,
    client: SupabaseClient = getSupabase()
): Promise<void> {
    const { error } = await client
        .from('daily_notes')
        .upsert({ user_id: userId, note_date: day, note }, { onConflict: 'user_id,note_date' });

    if (error) {
        console.error('Error saving daily note:', error);
        throw error;
    }
}
