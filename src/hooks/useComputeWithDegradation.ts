import { useMemo, useState, useTransition, useEffect } from 'react';

/**
 * Datasets larger than this are computed in a transition instead of synchronously.
 */
const DEGRADATION_THRESHOLD = 2000;

/**
 * Computes a derived value, degrading gracefully for large datasets.
 *
 * - Small data (<= 2000): synchronous useMemo
 * - Large data (> 2000): deferred via useTransition, with an isComputing flag
 *
 * computeFn should be stable (e.g. a module-level function); a new function
 * every render triggers a recompute every render.
 */
export function useComputeWithDegradation<T, R>(
    data: T[],
    computeFn: (data: T[]) => R,
    defaultValue: R
): { result: R; isComputing: boolean } {
    const [isPending, startTransition] = useTransition();
    const [deferredResult, setDeferredResult] = useState<R>(defaultValue);
    const isLargeDataset = data.length > DEGRADATION_THRESHOLD;

    const immediateResult = useMemo(
        () => (isLargeDataset ? null : computeFn(data)),
        [data, computeFn, isLargeDataset]
    );

    useEffect(() => {
        if (!isLargeDataset) return;
        startTransition(() => {
            setDeferredResult(computeFn(data));
        });
    }, [data, computeFn, isLargeDataset]);

    return {
        result: isLargeDataset ? deferredResult : (immediateResult ?? defaultValue),
        isComputing: isLargeDataset && isPending,
    };
}
