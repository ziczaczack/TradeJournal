import { useMemo, useState, useTransition, useEffect, useCallback } from 'react';

/**
 * 计算降级阈值：超过此数量的数据将使用延迟计算
 */
const DEGRADATION_THRESHOLD = 2000;

/**
 * 带降级策略的计算 Hook
 * 
 * - 小数据量 (<=2000): 使用 useMemo 同步计算
 * - 大数据量 (>2000): 使用 useTransition 延迟计算，显示加载状态
 */
export function useComputeWithDegradation<T, R>(
    data: T[],
    computeFn: (data: T[]) => R,
    defaultValue: R
): { result: R; isComputing: boolean } {
    const [isPending, startTransition] = useTransition();
    const [deferredResult, setDeferredResult] = useState<R>(defaultValue);

    // 稳定化 computeFn
    const stableComputeFn = useCallback(computeFn, []);

    // 小数据量：直接使用 useMemo 同步计算
    const immediateResult = useMemo(() => {
        if (data.length <= DEGRADATION_THRESHOLD) {
            return stableComputeFn(data);
        }
        return null;
    }, [data, stableComputeFn]);

    // 大数据量：使用 transition 延迟计算
    useEffect(() => {
        if (data.length > DEGRADATION_THRESHOLD) {
            startTransition(() => {
                const result = stableComputeFn(data);
                setDeferredResult(result);
            });
        }
    }, [data, stableComputeFn]);

    // 小数据量时重置 deferredResult
    useEffect(() => {
        if (data.length <= DEGRADATION_THRESHOLD) {
            setDeferredResult(defaultValue);
        }
    }, [data.length, defaultValue]);

    const isLargeDataset = data.length > DEGRADATION_THRESHOLD;

    return {
        result: isLargeDataset ? deferredResult : (immediateResult ?? defaultValue),
        isComputing: isLargeDataset && isPending,
    };
}

/**
 * 使用 useMemo 缓存的分析统计 Hook
 * 适用于不需要降级策略的场景
 */
export function useMemoizedCompute<T, R>(
    data: T[],
    computeFn: (data: T[]) => R,
    deps: React.DependencyList = []
): R {
    return useMemo(() => computeFn(data), [data, ...deps]);
}
