import { NextResponse } from 'next/server';

/**
 * Economic Calendar endpoint — currently DISABLED.
 *
 * The previous provider (FinancialModelingPrep) gated the economic_calendar
 * endpoint behind a paid plan, and no free source covers arbitrary historical
 * date ranges (see ECONOMIC_CALENDAR_ENABLED in src/lib/economicCalendarQueries.ts).
 *
 * Returns an empty list so any caller degrades gracefully instead of erroring.
 * To re-enable, restore a provider integration here and flip the feature flag.
 */
export async function GET() {
    return NextResponse.json([], {
        headers: { 'x-feature-status': 'disabled' },
    });
}
