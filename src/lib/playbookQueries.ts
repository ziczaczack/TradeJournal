import { getSupabase } from './supabase';

export interface PlaybookSetup {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    timeframe: string | null;
    win_rate_target: number;
    screenshot_url: string | null;
    rules: string[]; // Stored as JSONB array of strings
    created_at: string;
    updated_at: string;
}

export interface PlaybookSetupCreate {
    user_id?: string;
    name: string;
    description?: string;
    timeframe?: string;
    win_rate_target?: number;
    screenshot_url?: string;
    rules?: string[];
}

export interface PlaybookSetupUpdate {
    user_id?: string;
    name?: string;
    description?: string;
    timeframe?: string;
    win_rate_target?: number;
    screenshot_url?: string;
    rules?: string[];
}

/**
 * Fetch all playbook setups for the current user
 */
export async function fetchPlaybookSetups(): Promise<PlaybookSetup[]> {
    const { data, error } = await getSupabase()
        .from('playbook_setups')
        .select('*')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching playbook setups:', error);
        throw error;
    }

    return data || [];
}

/**
 * Create a new playbook setup
 */
export async function createPlaybookSetup(setup: PlaybookSetupCreate): Promise<PlaybookSetup> {
    const supabase = getSupabase();
    
    // Resolve user_id directly from session as a foolproof fallback
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
        console.error('Session error:', sessionError);
        throw new Error('You must be logged in to create a setup.');
    }

    const setupPayload = {
        ...setup,
        user_id: setup.user_id || session.user.id
    };

    const { data, error } = await supabase
        .from('playbook_setups')
        .insert(setupPayload)
        .select()
        .single();

    if (error) {
        console.error('Error creating playbook setup. DB Error:', error);
        throw error;
    }

    return data;
}

/**
 * Update an existing playbook setup
 */
export async function updatePlaybookSetup(id: string, updates: PlaybookSetupUpdate): Promise<PlaybookSetup> {
    const { data, error } = await getSupabase()
        .from('playbook_setups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating playbook setup:', error);
        throw error;
    }

    return data;
}

/**
 * Delete a playbook setup
 */
export async function deletePlaybookSetup(id: string): Promise<void> {
    const { error } = await getSupabase()
        .from('playbook_setups')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting playbook setup:', error);
        throw error;
    }
}
