import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import { fetchSharedCard } from '@/lib/shareQueries';
import { formatShareResult, SharedCard } from '@/lib/sharePayload';

// Public page: deliberately outside DashboardLayout (which gates on login).
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ token: string }> };

async function loadCard(token: string): Promise<SharedCard | null> {
    try {
        return await fetchSharedCard(token, getSupabase());
    } catch {
        return null;
    }
}

function cardTitle(card: SharedCard): string {
    if (card.kind === 'trade') {
        const p = card.payload;
        return `${p.symbol} ${p.side} · ${formatShareResult(p.result)}`;
    }
    return `${card.payload.name} · Playbook setup`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { token } = await params;
    const card = await loadCard(token);
    if (!card) return { title: 'Link unavailable' };

    // Absolute OG image URLs need a base; derive it from the request.
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    const proto = h.get('x-forwarded-proto') ?? 'https';
    const title = cardTitle(card);
    const description = 'Shared from My Trading Journal';

    return {
        metadataBase: host ? new URL(`${proto}://${host}`) : undefined,
        title,
        description,
        openGraph: { title, description },
        twitter: { card: 'summary_large_image', title, description },
    };
}

export default async function SharePage({ params }: Props) {
    const { token } = await params;
    const card = await loadCard(token);
    if (!card) notFound();

    return (
        <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-6 px-4 py-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`/share/${encodeURIComponent(token)}/opengraph-image`}
                alt={cardTitle(card)}
                width={1200}
                height={630}
                className="w-full max-w-3xl h-auto rounded-xl border border-zinc-800"
            />
            <p className="text-xs text-muted-foreground">
                Shared from{' '}
                <Link href="/" className="text-zinc-300 hover:underline">My Trading Journal</Link>
            </p>
        </main>
    );
}
