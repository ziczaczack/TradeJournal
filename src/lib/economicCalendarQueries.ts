'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subHours, addHours, parseISO } from 'date-fns';

// ============================================
// Types
// ============================================

export interface EconomicEvent {
    date: string;        // YYYY-MM-DD
    time: string;        // HH:mm (UTC)
    country: string;     // USD, EUR, GBP, etc.
    event: string;       // Event name
    impact: 'High' | 'Medium' | 'Low';
    actual?: string | null;
    forecast?: string | null;
    previous?: string | null;
}

export interface EconomicEventWithTimestamp extends EconomicEvent {
    timestamp: Date;     // Full UTC timestamp
}

// ============================================
// Feature Flag
// ============================================

/**
 * Economic Calendar is currently disabled.
 *
 * The previous data provider (FinancialModelingPrep) required a paid plan for
 * the economic_calendar endpoint, and the only free/keyless source available
 * (faireconomy/Forex Factory) only serves the current week — which can't satisfy
 * the monthly calendar view or the historical "events around a trade" feature.
 *
 * The integration code is intentionally left in place. To re-enable, flip this
 * flag to `true` and point fetchEconomicCalendar at a provider that supports
 * arbitrary historical date ranges.
 */
export const ECONOMIC_CALENDAR_ENABLED = false;

// ============================================
// Data Fetching
// ============================================

/**
 * Fetch economic calendar events.
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 */
export async function fetchEconomicCalendar(
    startDate: string,
    endDate: string
): Promise<EconomicEvent[]> {
    // Feature disabled — return no events without any network call.
    if (!ECONOMIC_CALENDAR_ENABLED) {
        return [];
    }

    try {
        const url = `/api/economic-calendar?from=${startDate}&to=${endDate}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error('API error:', response.status, response.statusText);
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('Unexpected FMP API response format:', data);
            return [];
        }

        // Transform FMP response to our EconomicEvent format
        return data.map((item: {
            date?: string;
            country?: string;
            event?: string;
            impact?: string;
            actual?: string;
            estimate?: string;
            previous?: string;
        }): EconomicEvent => {
            // FMP returns date as "YYYY-MM-DD HH:mm:ss"
            const [datePart, timePart] = (item.date || '').split(' ');

            return {
                date: datePart || '',
                time: timePart?.slice(0, 5) || '00:00', // Extract HH:mm
                country: item.country || 'USD',
                event: item.event || 'Unknown Event',
                impact: normalizeImpact(item.impact),
                actual: item.actual || null,
                forecast: item.estimate || null,
                previous: item.previous || null,
            };
        });
    } catch (error) {
        console.error('Error fetching economic calendar:', error);
        return [];
    }
}

/**
 * Normalize impact level from FMP to our standard format
 */
function normalizeImpact(impact?: string): 'High' | 'Medium' | 'Low' {
    if (!impact) return 'Low';
    const normalized = impact.toLowerCase();
    if (normalized === 'high' || normalized === 'red') return 'High';
    if (normalized === 'medium' || normalized === 'orange') return 'Medium';
    return 'Low';
}

// ============================================
// TanStack Query Hooks
// ============================================

/**
 * Hook to fetch economic calendar for a specific month
 * @param year - Year (e.g., 2026)
 * @param month - Month (0-indexed, 0 = January)
 */
export function useEconomicCalendar(year: number, month: number) {
    const startDate = format(new Date(year, month, 1), 'yyyy-MM-dd');
    const endDate = format(new Date(year, month + 1, 0), 'yyyy-MM-dd');

    return useQuery({
        queryKey: ['economicCalendar', startDate, endDate],
        queryFn: () => fetchEconomicCalendar(startDate, endDate),
        enabled: ECONOMIC_CALENDAR_ENABLED,
        staleTime: 30 * 60 * 1000, // 30 minutes
        gcTime: 60 * 60 * 1000,    // 1 hour garbage collection
        refetchOnWindowFocus: false,
    });
}

/**
 * Hook to fetch economic events around a specific trade entry time
 * @param entryTime - Trade entry time (ISO string)
 * @param windowHours - Hours before and after to search (default: 1)
 */
export function useEventsAroundTrade(entryTime: string | null | undefined, windowHours: number = 1) {
    // Calculate date range for the query
    const enabled = ECONOMIC_CALENDAR_ENABLED && Boolean(entryTime);
    let startDate = '';
    let endDate = '';

    if (entryTime) {
        const entryDate = parseISO(entryTime);
        const from = subHours(entryDate, windowHours);
        const to = addHours(entryDate, windowHours);
        startDate = format(from, 'yyyy-MM-dd');
        endDate = format(to, 'yyyy-MM-dd');
    }

    const query = useQuery({
        queryKey: ['economicCalendarTrade', entryTime, windowHours],
        queryFn: async () => {
            if (!entryTime) return [];

            const events = await fetchEconomicCalendar(startDate, endDate);
            return filterEventsAroundTime(events, entryTime, windowHours);
        },
        enabled,
        staleTime: 30 * 60 * 1000,
        gcTime: 60 * 60 * 1000,
    });

    return query;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Filter events that occurred within a time window around a trade
 * @param events - List of economic events
 * @param entryTime - Trade entry time (ISO string)
 * @param windowHours - Hours before and after to include
 */
export function filterEventsAroundTime(
    events: EconomicEvent[],
    entryTime: string,
    windowHours: number = 1
): EconomicEventWithTimestamp[] {
    const entryDate = parseISO(entryTime);
    const windowStart = subHours(entryDate, windowHours);
    const windowEnd = addHours(entryDate, windowHours);

    return events
        .map((event) => {
            // Construct full timestamp from date + time
            const timestamp = parseISO(`${event.date}T${event.time}:00Z`);
            return { ...event, timestamp };
        })
        .filter((event) => {
            return event.timestamp >= windowStart && event.timestamp <= windowEnd;
        })
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Get high-impact events for a specific date
 * @param events - List of economic events
 * @param date - Date to filter by (YYYY-MM-DD)
 */
export function getHighImpactEventsForDate(
    events: EconomicEvent[],
    date: string
): EconomicEvent[] {
    return events.filter(
        (event) => event.date === date && event.impact === 'High'
    );
}

/**
 * Get all events for a specific date
 * @param events - List of economic events
 * @param date - Date to filter by (YYYY-MM-DD)
 */
export function getEventsForDate(events: EconomicEvent[], date: string): EconomicEvent[] {
    return events.filter((event) => event.date === date);
}

/**
 * Check if a date has high-impact events
 * @param events - List of economic events
 * @param date - Date to check (YYYY-MM-DD)
 */
export function hasHighImpactEvent(events: EconomicEvent[], date: string): boolean {
    return events.some((event) => event.date === date && event.impact === 'High');
}

/**
 * Format event time relative to a reference time
 * @param eventTime - Event timestamp
 * @param referenceTime - Reference time (e.g., trade entry)
 * @returns Formatted string like "-15min", "+2h 30min"
 */
export function formatRelativeTime(eventTime: Date, referenceTime: Date): string {
    const diffMs = eventTime.getTime() - referenceTime.getTime();
    const diffMins = Math.round(diffMs / (1000 * 60));
    const absMins = Math.abs(diffMins);
    const sign = diffMins >= 0 ? '+' : '-';

    if (absMins < 60) {
        return `${sign}${absMins}min`;
    }

    const hours = Math.floor(absMins / 60);
    const mins = absMins % 60;

    if (mins === 0) {
        return `${sign}${hours}h`;
    }

    return `${sign}${hours}h ${mins}min`;
}
