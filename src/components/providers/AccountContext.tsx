'use client';

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    ReactNode,
} from 'react';
import { getSupabase } from '@/lib/supabase';
import {
    Account,
    fetchAccounts,
    fetchDefaultAccount,
    ensureDefaultAccount,
} from '@/lib/accountQueries';
import type { User } from '@supabase/supabase-js';

// ============================================
// Context Types
// ============================================

interface AccountContextType {
    /** Currently selected account */
    currentAccount: Account | null;
    /** All accounts for the current user */
    accounts: Account[];
    /** Loading state */
    isLoading: boolean;
    /** Error message if any */
    error: string | null;
    /** Switch to a different account */
    setCurrentAccount: (account: Account) => void;
    /** Refresh accounts from database */
    refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

// Local storage key for persisting selected account
const STORAGE_KEY = 'trading_journal_current_account_id';

// ============================================
// Provider Component
// ============================================

interface AccountProviderProps {
    children: ReactNode;
}

export function AccountProvider({ children }: AccountProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [currentAccount, setCurrentAccountState] = useState<Account | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const supabase = getSupabase();

    // Load accounts and set current account
    const loadAccounts = useCallback(async (userId: string) => {
        console.log('[AccountContext] loadAccounts called for user:', userId);
        try {
            setIsLoading(true);
            setError(null);

            // Ensure user has at least one account
            console.log('[AccountContext] Calling ensureDefaultAccount...');
            await ensureDefaultAccount(userId);

            // Fetch all accounts
            console.log('[AccountContext] Fetching accounts...');
            const userAccounts = await fetchAccounts();
            console.log('[AccountContext] Fetched accounts:', userAccounts.length);
            setAccounts(userAccounts);

            if (userAccounts.length === 0) {
                console.log('[AccountContext] No accounts found, setting currentAccount to null');
                setCurrentAccountState(null);
                return;
            }

            // Try to restore previously selected account from localStorage
            const savedAccountId = localStorage.getItem(STORAGE_KEY);
            let selectedAccount: Account | null = null;

            if (savedAccountId) {
                selectedAccount = userAccounts.find(a => a.id === savedAccountId) || null;
            }

            // If no saved account or saved account not found, use default account
            if (!selectedAccount) {
                selectedAccount = userAccounts.find(a => a.is_default) || userAccounts[0];
            }

            console.log('[AccountContext] Setting currentAccount:', selectedAccount?.account_name);
            setCurrentAccountState(selectedAccount);
        } catch (err) {
            console.error('[AccountContext] Error loading accounts:', err);
            setError(err instanceof Error ? err.message : 'Failed to load accounts');
        } finally {
            console.log('[AccountContext] Setting isLoading to false');
            setIsLoading(false);
        }
    }, []);

    // Listen for auth state changes
    useEffect(() => {
        console.log('[AccountContext] useEffect running - checking auth');
        supabase.auth.getUser().then(({ data: { user } }) => {
            console.log('[AccountContext] getUser result:', user?.id || 'no user');
            setUser(user);
            if (user) {
                loadAccounts(user.id);
            } else {
                console.log('[AccountContext] No user, setting isLoading to false');
                setAccounts([]);
                setCurrentAccountState(null);
                setIsLoading(false);
            }
        }).catch(err => {
            console.error('[AccountContext] getUser error:', err);
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log('[AccountContext] Auth state change:', _event);
            const newUser = session?.user ?? null;
            setUser(newUser);
            if (newUser) {
                loadAccounts(newUser.id);
            } else {
                setAccounts([]);
                setCurrentAccountState(null);
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase, loadAccounts]);

    // Set current account and persist to localStorage
    const setCurrentAccount = useCallback((account: Account) => {
        setCurrentAccountState(account);
        localStorage.setItem(STORAGE_KEY, account.id);
    }, []);

    // Refresh accounts from database
    const refreshAccounts = useCallback(async () => {
        if (user) {
            await loadAccounts(user.id);
        }
    }, [user, loadAccounts]);

    const value: AccountContextType = {
        currentAccount,
        accounts,
        isLoading,
        error,
        setCurrentAccount,
        refreshAccounts,
    };

    return (
        <AccountContext.Provider value={value}>
            {children}
        </AccountContext.Provider>
    );
}

// ============================================
// Hook
// ============================================

/**
 * Safe default for SSR when AccountProvider is not available
 */
const SSR_DEFAULT: AccountContextType = {
    currentAccount: null,
    accounts: [],
    isLoading: true,
    error: null,
    setCurrentAccount: () => { },
    refreshAccounts: async () => { },
};

/**
 * Use account context - returns safe defaults during SSR
 * This hook is SSR-safe and will not throw during prerendering
 */
export function useAccount(): AccountContextType {
    const context = useContext(AccountContext);
    // Return safe defaults during SSR when provider isn't mounted
    if (context === undefined) {
        return SSR_DEFAULT;
    }
    return context;
}

/**
 * Strict version that throws if used outside provider
 * Use this only in components that must have account context
 */
export function useAccountStrict(): AccountContextType {
    const context = useContext(AccountContext);
    if (context === undefined) {
        throw new Error('useAccountStrict must be used within an AccountProvider');
    }
    return context;
}

// Export for external usage
export { AccountContext };
