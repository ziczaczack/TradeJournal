import { describe, it, expect } from 'vitest';
import { renderableImageType, validateSharedCard } from './shareValidation';

const HOST = 'abc.supabase.co';

const tradeCard = {
    kind: 'trade',
    payload: {
        v: 1,
        symbol: 'MNQZ6',
        side: 'long',
        entryPrice: 20000,
        exitPrice: 20012.5,
        entryTime: '2026-10-01T13:30:00Z',
        duration: '15m',
        setupName: null,
        rating: null,
        result: { mode: 'points', value: 12.5 },
    },
};

const playbookCard = {
    kind: 'playbook',
    payload: {
        v: 1,
        name: 'Silver Bullet',
        timeframe: null,
        description: null,
        rules: ['Sweep liquidity'],
        winRateTarget: 60,
        stats: { tradeCount: 0, winRate: 0, avgResult: null },
    },
};

describe('validateSharedCard', () => {
    it('accepts valid trade and playbook cards', () => {
        expect(validateSharedCard(tradeCard, HOST)).toEqual({ ok: true, card: tradeCard });
        expect(validateSharedCard(playbookCard, HOST)).toEqual({ ok: true, card: playbookCard });
    });

    it('strips unknown keys', () => {
        const result = validateSharedCard(
            { ...tradeCard, extra: 1, payload: { ...tradeCard.payload, pnl: 999, userId: 'x' } },
            HOST
        );
        expect(result).toEqual({ ok: true, card: tradeCard });
    });

    it('rejects non-objects, unknown kinds and wrong versions', () => {
        expect(validateSharedCard(null, HOST).ok).toBe(false);
        expect(validateSharedCard({ kind: 'recap', payload: {} }, HOST).ok).toBe(false);
        expect(validateSharedCard({ ...tradeCard, payload: { ...tradeCard.payload, v: 2 } }, HOST).ok).toBe(false);
    });

    it('rejects wrong field types', () => {
        const bad = [
            { ...tradeCard.payload, symbol: '' },
            { ...tradeCard.payload, side: 'up' },
            { ...tradeCard.payload, entryPrice: '20000' },
            { ...tradeCard.payload, result: { mode: 'btc', value: 1 } },
            { ...tradeCard.payload, result: { mode: 'usd', value: Infinity } },
        ];
        for (const payload of bad) {
            expect(validateSharedCard({ kind: 'trade', payload }, HOST).ok).toBe(false);
        }
        expect(validateSharedCard(
            { kind: 'playbook', payload: { ...playbookCard.payload, rules: Array(7).fill('r') } },
            HOST
        ).ok).toBe(false);
    });

    it('rejects oversized payloads', () => {
        const payload = { ...tradeCard.payload, notes: 'x'.repeat(17 * 1024) };
        const result = validateSharedCard({ kind: 'trade', payload }, HOST);
        expect(result.ok).toBe(false);
    });

    it('only accepts screenshots hosted on the Supabase host', () => {
        const withShot = (url: string) => ({ kind: 'trade', payload: { ...tradeCard.payload, screenshotUrl: url } });
        expect(validateSharedCard(withShot(`https://${HOST}/storage/v1/object/public/a.png`), HOST).ok).toBe(true);
        expect(validateSharedCard(withShot('https://evil.example.com/a.png'), HOST).ok).toBe(false);
        expect(validateSharedCard(withShot('http://169.254.169.254/latest'), HOST).ok).toBe(false);
        expect(validateSharedCard(withShot('not a url'), HOST).ok).toBe(false);
        expect(validateSharedCard(withShot(`https://${HOST}/a.png`), '').ok).toBe(false);
    });
});

describe('renderableImageType', () => {
    const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);

    it('recognizes PNG and JPEG by their signatures', () => {
        expect(renderableImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
        expect(renderableImageType(bytes(0xff, 0xd8, 0xff))).toBe('image/jpeg');
    });

    it('rejects formats the card renderer cannot draw, whatever the declared content type', () => {
        expect(renderableImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBeNull();
        expect(renderableImageType(new TextEncoder().encode('\0\0\0\x18ftypheic'))).toBeNull();
        expect(renderableImageType(new TextEncoder().encode('<svg xmlns='))).toBeNull();
        expect(renderableImageType(new Uint8Array())).toBeNull();
    });
});
