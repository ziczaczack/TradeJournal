import { getSupabase } from './supabase';

// ============================================
// Account Types
// ============================================

export interface Account {
    id: string;
    user_id: string;
    account_name: string;
    broker_name: string | null;
    initial_balance: number;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface AccountCreate {
    account_name: string;
    broker_name?: string;
    initial_balance?: number;
    is_default?: boolean;
}

export interface AccountUpdate {
    account_name?: string;
    broker_name?: string;
    initial_balance?: number;
    is_default?: boolean;
}

// ============================================
// Account Queries
// ============================================

/**
 * Fetch all accounts for the current user
 */
export async function fetchAccounts(): Promise<Account[]> {
    const { data, error } = await getSupabase()
        .from('accounts')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching accounts:', error);
        throw error;
    }

    return (data as Account[]) || [];
}

/**
 * Fetch a single account by ID
 */
export async function fetchAccountById(accountId: string): Promise<Account | null> {
    const { data, error } = await getSupabase()
        .from('accounts')
        .select('*')
        .eq('id', accountId)
        .single();

    if (error) {
        console.error('Error fetching account:', error);
        return null;
    }

    return data as Account;
}

/**
 * Fetch the user's default account
 */
export async function fetchDefaultAccount(): Promise<Account | null> {
    const { data, error } = await getSupabase()
        .from('accounts')
        .select('*')
        .eq('is_default', true)
        .single();

    if (error) {
        // No default account found is not an error
        if (error.code === 'PGRST116') {
            return null;
        }
        console.error('Error fetching default account:', error);
        return null;
    }

    return data as Account;
}

/**
 * Create a new account
 */
export async function createAccount(
    userId: string,
    account: AccountCreate
): Promise<Account> {
    // If this is the first account or marked as default, handle is_default logic
    const { data, error } = await getSupabase()
        .from('accounts')
        .insert({
            user_id: userId,
            account_name: account.account_name,
            broker_name: account.broker_name || null,
            initial_balance: account.initial_balance || 0,
            is_default: account.is_default || false,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating account:', error);
        throw error;
    }

    return data as Account;
}

/**
 * Update an existing account
 */
export async function updateAccount(
    accountId: string,
    updates: AccountUpdate
): Promise<Account> {
    const { data, error } = await getSupabase()
        .from('accounts')
        .update(updates)
        .eq('id', accountId)
        .select()
        .single();

    if (error) {
        console.error('Error updating account:', error);
        throw error;
    }

    return data as Account;
}

/**
 * Delete an account
 * Note: This will cascade delete all trades in the account
 */
export async function deleteAccount(accountId: string): Promise<void> {
    const { error } = await getSupabase()
        .from('accounts')
        .delete()
        .eq('id', accountId);

    if (error) {
        console.error('Error deleting account:', error);
        throw error;
    }
}

/**
 * Set an account as the default
 * First removes default from other accounts, then sets the new default
 */
export async function setDefaultAccount(
    userId: string,
    accountId: string
): Promise<void> {
    const supabase = getSupabase();

    // Remove default from all user accounts first
    const { error: clearError } = await supabase
        .from('accounts')
        .update({ is_default: false })
        .eq('user_id', userId);

    if (clearError) {
        console.error('Error clearing default accounts:', clearError);
        throw clearError;
    }

    // Set the new default
    const { error: setError } = await supabase
        .from('accounts')
        .update({ is_default: true })
        .eq('id', accountId);

    if (setError) {
        console.error('Error setting default account:', setError);
        throw setError;
    }
}

/**
 * Create a default account for a new user
 */
export async function ensureDefaultAccount(userId: string): Promise<Account> {
    // Check if user already has any accounts
    const existing = await fetchAccounts();

    if (existing.length > 0) {
        // Return the default account or the first one
        return existing.find(a => a.is_default) || existing[0];
    }

    // Create a default account for new users
    return createAccount(userId, {
        account_name: 'Default Account',
        broker_name: 'Unknown',
        is_default: true,
    });
}
