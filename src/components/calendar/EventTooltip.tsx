'use client';

import { ReactNode } from 'react';
import { EconomicEvent } from '@/lib/economicCalendarQueries';
import { Zap } from 'lucide-react';

interface EventTooltipProps {
    events: EconomicEvent[];
    children: ReactNode;
}

/**
 * Tooltip component for displaying economic events on calendar dates
 * Uses CSS-only hover approach for zero dependency overhead
 */
export function EventTooltip({ events, children }: EventTooltipProps) {
    if (events.length === 0) {
        return <>{children}</>;
    }

    return (
        <div className="group relative">
            {children}

            {/* Tooltip content - appears on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="glass-card p-3 rounded-lg border border-zinc-700/50 shadow-2xl min-w-[200px] max-w-[280px]">
                    <div className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                        Economic Events
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {events.slice(0, 5).map((event, index) => (
                            <div
                                key={`${event.date}-${event.time}-${index}`}
                                className="flex items-start gap-2 text-sm"
                            >
                                {/* Impact indicator */}
                                {event.impact === 'High' ? (
                                    <Zap className="w-3 h-3 text-rose-400 flex-shrink-0 mt-0.5 fill-rose-400" />
                                ) : event.impact === 'Medium' ? (
                                    <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-zinc-500 flex-shrink-0 mt-1.5" />
                                )}

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-muted-foreground font-mono text-[10px]">
                                            {event.time}
                                        </span>
                                        <span className="font-semibold text-blue-400 text-[10px]">
                                            {event.country}
                                        </span>
                                    </div>
                                    <div className="text-zinc-200 truncate text-xs">
                                        {event.event}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {events.length > 5 && (
                            <div className="text-[10px] text-muted-foreground text-center pt-1 border-t border-zinc-800">
                                +{events.length - 5} more events
                            </div>
                        )}
                    </div>

                    {/* Tooltip arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px]">
                        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-zinc-700/50" />
                    </div>
                </div>
            </div>
        </div>
    );
}
