'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';

interface QueryProviderProps {
    children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000,  // 5 分钟内数据视为新鲜，不重新获取
                        gcTime: 10 * 60 * 1000,    // 10 分钟后垃圾回收未使用的 queries
                        refetchOnWindowFocus: false, // 禁止窗口聚焦时自动刷新
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
