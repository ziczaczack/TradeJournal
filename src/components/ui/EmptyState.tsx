'use client';

import { LucideIcon, Coffee, Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
}

// Encouraging messages for different contexts
export const EMPTY_STATE_MESSAGES = {
    noTradesDay: {
        title: '今日无交易',
        description: '休息也是一种策略。保持耐心，等待最佳时机。',
        icon: Coffee,
    },
    noTradesMonth: {
        title: '本月暂无交易记录',
        description: '这可能是新的开始，或是策略性休整期。',
        icon: Calendar,
    },
    noData: {
        title: '暂无数据',
        description: '开始导入交易记录，追踪你的交易表现。',
        icon: TrendingUp,
    },
    noAnalytics: {
        title: '数据不足',
        description: '需要更多交易记录才能生成分析报告。',
        icon: BarChart3,
    },
} as const;

/**
 * Empty state component with encouraging messages
 * Displays a semi-transparent icon with contextual text
 */
export function EmptyState({
    icon: Icon = Coffee,
    title,
    description,
    actionLabel,
    onAction,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center py-12 px-4 text-center',
                className
            )}
        >
            {/* Semi-transparent icon container */}
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-500/10 to-zinc-700/10 rounded-2xl blur-xl" />
                <div className="relative w-20 h-20 rounded-2xl bg-zinc-800/30 backdrop-blur-sm border border-zinc-700/30 flex items-center justify-center">
                    <Icon className="w-10 h-10 text-zinc-500/70" strokeWidth={1.5} />
                </div>
            </div>

            {/* Title */}
            <h3 className="text-lg font-medium text-zinc-300 mb-2">
                {title}
            </h3>

            {/* Description */}
            <p className="text-sm text-zinc-500 max-w-xs mb-6">
                {description}
            </p>

            {/* Optional action button */}
            {actionLabel && onAction && (
                <Button
                    variant="outline"
                    onClick={onAction}
                    className="bg-zinc-900/50 border-zinc-700 hover:bg-zinc-800 btn-hover-lift"
                >
                    {actionLabel}
                </Button>
            )}
        </div>
    );
}
