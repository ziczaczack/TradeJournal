'use client';

import { parseISO } from 'date-fns';
import { Zap, Calendar, AlertCircle } from 'lucide-react';
import {
    useEventsAroundTrade,
    EconomicEventWithTimestamp,
    formatRelativeTime,
} from '@/lib/economicCalendarQueries';

interface RelatedEconomicEventsProps {
    entryTime: string | null | undefined;
    windowHours?: number;
}

/**
 * Component displaying economic events that occurred around a trade entry time
 * Used in TradeDetailSheet to provide market context for individual trades
 */
export function RelatedEconomicEvents({
    entryTime,
    windowHours = 1,
}: RelatedEconomicEventsProps) {
    const { data: events = [], isLoading, error } = useEventsAroundTrade(entryTime, windowHours);

    if (!entryTime) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800/50 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                    Economic Context
                </h3>
                <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800/50 pb-2 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5 text-amber-400" />
                    </span>
                    Economic Context
                </h3>
                <div className="flex items-center gap-2 text-zinc-500 text-sm py-3">
                    <AlertCircle className="w-4 h-4" />
                    Unable to load economic events
                </div>
            </div>
        );
    }

    const entryDate = parseISO(entryTime);

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800/50 pb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 text-amber-400" />
                </span>
                Economic Context
                {events.length > 0 && (
                    <span className="ml-auto text-xs text-zinc-500 font-normal">
                        ±{windowHours}h window
                    </span>
                )}
            </h3>

            {events.length === 0 ? (
                <div className="text-zinc-500 text-sm py-3 text-center bg-zinc-900/30 rounded-lg">
                    No major economic events around this trade
                </div>
            ) : (
                <div className="space-y-2">
                    {events.map((event: EconomicEventWithTimestamp, index: number) => (
                        <div
                            key={`${event.date}-${event.time}-${index}`}
                            className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700/50 transition-colors"
                        >
                            {/* Impact indicator */}
                            <div className="flex-shrink-0 mt-0.5">
                                {event.impact === 'High' ? (
                                    <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center">
                                        <Zap className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                                    </div>
                                ) : event.impact === 'Medium' ? (
                                    <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                    </div>
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-zinc-700/50 flex items-center justify-center">
                                        <div className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                                    </div>
                                )}
                            </div>

                            {/* Event details */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                                        {event.country}
                                    </span>
                                    <span className="text-xs text-zinc-500 font-mono">
                                        {event.time} UTC
                                    </span>
                                    <span
                                        className={`text-xs font-medium ${event.timestamp < entryDate
                                                ? 'text-zinc-400'
                                                : 'text-emerald-400'
                                            }`}
                                    >
                                        {formatRelativeTime(event.timestamp, entryDate)}
                                    </span>
                                </div>
                                <div className="text-sm text-zinc-200 truncate">
                                    {event.event}
                                </div>

                                {/* Show actual vs forecast if available */}
                                {(event.actual || event.forecast) && (
                                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                                        {event.forecast && (
                                            <span className="text-zinc-500">
                                                Forecast: <span className="text-zinc-400">{event.forecast}</span>
                                            </span>
                                        )}
                                        {event.actual && (
                                            <span className="text-zinc-500">
                                                Actual: <span className="text-emerald-400">{event.actual}</span>
                                            </span>
                                        )}
                                        {event.previous && (
                                            <span className="text-zinc-500">
                                                Previous: <span className="text-zinc-400">{event.previous}</span>
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
