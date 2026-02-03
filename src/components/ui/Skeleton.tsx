'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
    className?: string;
}

/**
 * Base Skeleton component with shimmer animation
 */
export function Skeleton({ className }: SkeletonProps) {
    return (
        <div
            className={cn(
                'animate-shimmer rounded-md bg-zinc-800/50',
                className
            )}
        />
    );
}

/**
 * Skeleton for stat cards in dashboard
 */
export function SkeletonStatCard() {
    return (
        <div className="glass-card p-6 space-y-3">
            <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-16" />
        </div>
    );
}

/**
 * Grid of skeleton stat cards
 */
export function SkeletonStatsGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonStatCard key={i} />
            ))}
        </div>
    );
}

/**
 * Skeleton for a single trade list item
 */
export function SkeletonTradeItem() {
    return (
        <div className="glass-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-32" />
                </div>
            </div>
            <div className="text-right space-y-2">
                <Skeleton className="h-5 w-16 ml-auto" />
                <Skeleton className="h-3 w-12 ml-auto" />
            </div>
        </div>
    );
}

/**
 * List of skeleton trade items
 */
export function SkeletonTradeList({ count = 5 }: { count?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonTradeItem key={i} />
            ))}
        </div>
    );
}

/**
 * Skeleton for calendar grid
 */
export function SkeletonCalendar() {
    return (
        <div className="glass-card p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <Skeleton className="h-6 w-32" />
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                </div>
            </div>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {Array.from({ length: 7 }).map((_, i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                ))}
            </div>
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
            </div>
        </div>
    );
}
