import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTrades, fetchFilterOptions, Trade, TradeFilters } from '@/lib/tradeQueries';
import { useAccount } from '@/components/providers/AccountContext';

// Query keys 常量
export const tradeQueryKeys = {
    all: ['trades'] as const,
    list: (filters?: TradeFilters) => ['trades', 'list', filters] as const,
    filterOptions: (accountId?: string) => ['trades', 'filterOptions', accountId] as const,
};

/**
 * 获取所有交易数据的 Hook
 * 使用 TanStack Query 缓存，避免重复请求
 */
export function useTrades(filters?: TradeFilters) {
    return useQuery({
        queryKey: tradeQueryKeys.list(filters),
        queryFn: () => fetchTrades(filters),
        staleTime: 5 * 60 * 1000, // 5 分钟内视为新鲜数据
    });
}

/**
 * 获取当前账户的交易数据
 * 自动使用 AccountContext 中的当前账户进行过滤
 */
export function useTradesForCurrentAccount(additionalFilters?: Omit<TradeFilters, 'accountId'>) {
    const { currentAccount, isLoading: accountLoading } = useAccount();

    // Debug: log the state
    console.log('[useTradesForCurrentAccount] State:', {
        accountLoading,
        currentAccountId: currentAccount?.id,
        currentAccountName: currentAccount?.account_name,
    });

    const accountId = currentAccount?.id;

    const filters: TradeFilters = {
        ...additionalFilters,
        accountId: accountId,
    };

    // Only run query when:
    // 1. Account is not loading
    // 2. We have a valid account ID
    const isEnabled = !accountLoading && !!accountId;

    console.log('[useTradesForCurrentAccount] Query enabled:', isEnabled);

    return useQuery({
        queryKey: tradeQueryKeys.list(filters),
        queryFn: () => fetchTrades(filters),
        staleTime: 5 * 60 * 1000,
        enabled: isEnabled,
    });
}

/**
 * 获取过滤器选项 (symbols, setupTypes)
 */
export function useFilterOptions() {
    const { currentAccount, isLoading: accountLoading } = useAccount();

    return useQuery({
        queryKey: tradeQueryKeys.filterOptions(currentAccount?.id),
        queryFn: fetchFilterOptions,
        staleTime: 10 * 60 * 1000, // 10 分钟 - 过滤器选项变化较少
    });
}

/**
 * 使交易数据缓存失效 (用于导入新数据后)
 */
export function useInvalidateTrades() {
    const queryClient = useQueryClient();

    return () => {
        queryClient.invalidateQueries({ queryKey: tradeQueryKeys.all });
    };
}

