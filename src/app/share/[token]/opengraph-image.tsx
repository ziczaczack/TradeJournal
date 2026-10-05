import { getSupabase } from '@/lib/supabase';
import { fetchSharedCard } from '@/lib/shareQueries';
import { renderShareImage } from '@/components/share/renderShareImage';
import type { SharedCard } from '@/lib/sharePayload';

export const dynamic = 'force-dynamic';
export const alt = 'Shared trading card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    let card: SharedCard | null = null;
    try {
        card = await fetchSharedCard(token, getSupabase());
    } catch {
        // Unfurls must never show an error image — fall through to "unavailable".
    }
    return renderShareImage(card);
}
