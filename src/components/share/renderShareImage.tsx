import { ImageResponse } from 'next/og';
import type { SharedCard } from '@/lib/sharePayload';
import { renderableImageType } from '@/lib/shareValidation';
import { ShareCard, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from './ShareCard';

const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

// Fetch the screenshot ourselves so a slow/broken image degrades to a card
// without it instead of failing the whole render.
async function toDataUrl(url: string): Promise<string | undefined> {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return undefined;
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_SCREENSHOT_BYTES) return undefined;
        const type = renderableImageType(buffer);
        if (!type) return undefined;
        return `data:${type};base64,${buffer.toString('base64')}`;
    } catch {
        return undefined;
    }
}

/** Render a (validated) card — or the "unavailable" card for null — to PNG. */
export async function renderShareImage(card: SharedCard | null): Promise<ImageResponse> {
    let resolved = card;
    if (card?.payload.screenshotUrl) {
        const screenshotUrl = await toDataUrl(card.payload.screenshotUrl);
        resolved = card.kind === 'trade'
            ? { kind: 'trade', payload: { ...card.payload, screenshotUrl } }
            : { kind: 'playbook', payload: { ...card.payload, screenshotUrl } };
    }

    return new ImageResponse(<ShareCard card={resolved} />, {
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
    });
}
