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
    name: string;
    description?: string;
    timeframe?: string;
    win_rate_target?: number;
    screenshot_url?: string;
    rules?: string[];
}

export interface PlaybookSetupUpdate {
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
    const { data, error } = await getSupabase()
        .from('playbook_setups')
        .insert(setup)
        .select()
        .single();

    if (error) {
        console.error('Error creating playbook setup:', error);
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
