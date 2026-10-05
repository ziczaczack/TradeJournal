import { NextRequest, NextResponse } from 'next/server';
import { renderShareImage } from '@/components/share/renderShareImage';
import { MAX_PAYLOAD_BYTES, supabaseImageHost, validateSharedCard } from '@/lib/shareValidation';

export const dynamic = 'force-dynamic';

/**
 * POST a share card ({ kind, payload }) and get the PNG back.
 * Stateless: no database access, so it powers Download / Copy image
 * without creating a public link.
 */
export async function POST(request: NextRequest) {
    const text = await request.text();
    if (text.length > MAX_PAYLOAD_BYTES * 2) {
        return NextResponse.json({ error: 'Payload is too large' }, { status: 400 });
    }

    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const result = validateSharedCard(body, supabaseImageHost());
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return renderShareImage(result.card);
}
