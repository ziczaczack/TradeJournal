import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTrades, fetchFilterOptions, TradeFilters } from '@/lib/tradeQueries';
import { useAccount } from '@/components/providers/AccountContext';

// Query keys
export const tradeQueryKeys = {
    all: ['trades'] as const,
    list: (filters?: TradeFilters) => ['trades', 'list', filters] as const,
    detail: (id: string) => ['trades', 'detail', id] as const,
    filterOptions: (accountId?: string) => ['trades', 'filterOptions', accountId] as const,
};

/**
 * All trades, cached by TanStack Query to avoid duplicate requests
 */
export function useTrades(filters?: TradeFilters) {
    return useQuery({
        queryKey: tradeQueryKeys.list(filters),
        queryFn: () => fetchTrades(filters),
        staleTime: 5 * 60 * 1000, // fresh for 5 minutes
    });
}

/**
 * Trades for the current account from AccountContext
 */
export function useTradesForCurrentAccount(additionalFilters?: Omit<TradeFilters, 'accountId'>) {
    const { currentAccount, isLoading: accountLoading } = useAccount();

    const accountId = currentAccount?.id;

    const filters: TradeFilters = {
        ...additionalFilters,
        accountId: accountId,
    };

    // Only run query when:
    // 1. Account is not loading
    // 2. We have a valid account ID
    const isEnabled = !accountLoading && !!accountId;

    return useQuery({
        queryKey: tradeQueryKeys.list(filters),
        queryFn: () => fetchTrades(filters),
        staleTime: 5 * 60 * 1000,
        enabled: isEnabled,
    });
}

/**
 * Filter options (symbols, setup types)
 */
export function useFilterOptions() {
    const { currentAccount } = useAccount();

    return useQuery({
        queryKey: tradeQueryKeys.filterOptions(currentAccount?.id),
        queryFn: fetchFilterOptions,
        staleTime: 10 * 60 * 1000, // 10 minutes; filter options rarely change
    });
}

/**
 * Invalidate cached trades (e.g. after an import)
 */
export function useInvalidateTrades() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: tradeQueryKeys.all });
    };
}

