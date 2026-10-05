import {
    MAX_NOTES_LENGTH,
    MAX_RULES,
    MAX_DESCRIPTION_LENGTH,
    MAX_NAME_LENGTH,
    MAX_RULE_LENGTH,
    MAX_SETUP_NAME_LENGTH,
    PlaybookSharePayload,
    ResultMode,
    ShareResult,
    SharedCard,
    TradeSharePayload,
} from './sharePayload';

export const MAX_PAYLOAD_BYTES = 16 * 1024;

export type ValidationResult = { ok: true; card: SharedCard } | { ok: false; error: string };

type Obj = Record<string, unknown>;

class InvalidPayload extends Error {}

const RESULT_MODES: ResultMode[] = ['points', 'usd', 'percent'];

function fail(message: string): never {
    throw new InvalidPayload(message);
}

function obj(value: unknown, field: string): Obj {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${field} must be an object`);
    return value as Obj;
}

function str(value: unknown, field: string, max: number): string {
    if (typeof value !== 'string' || value.length === 0 || value.length > max) fail(`${field} is invalid`);
    return value;
}

function strOrNull(value: unknown, field: string, max: number): string | null {
    return value === null ? null : str(value, field, max);
}

function num(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${field} must be a finite number`);
    return value;
}

function numOrNull(value: unknown, field: string): number | null {
    return value === null ? null : num(value, field);
}

function result(value: unknown, field: string): ShareResult {
    const o = obj(value, field);
    if (!RESULT_MODES.includes(o.mode as ResultMode)) fail(`${field}.mode is invalid`);
    return { mode: o.mode as ResultMode, value: num(o.value, `${field}.value`) };
}

function screenshot(value: unknown, allowedImageHost: string): string | undefined {
    if (value === undefined) return undefined;
    const url = str(value, 'screenshotUrl', 2048);
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        fail('screenshotUrl is not a URL');
    }
    if (!allowedImageHost || parsed.protocol !== 'https:' || parsed.host !== allowedImageHost) {
        fail('screenshotUrl must be hosted on this app\'s storage');
    }
    return url;
}

function tradePayload(p: Obj, host: string): TradeSharePayload {
    if (p.side !== 'long' && p.side !== 'short') fail('side is invalid');
    const payload: TradeSharePayload = {
        v: 1,
        symbol: str(p.symbol, 'symbol', 40),
        side: p.side,
        entryPrice: numOrNull(p.entryPrice, 'entryPrice'),
        exitPrice: numOrNull(p.exitPrice, 'exitPrice'),
        entryTime: strOrNull(p.entryTime, 'entryTime', 64),
        duration: strOrNull(p.duration, 'duration', 64),
        setupName: strOrNull(p.setupName, 'setupName', MAX_SETUP_NAME_LENGTH),
        rating: numOrNull(p.rating, 'rating'),
        result: result(p.result, 'result'),
    };
    const shot = screenshot(p.screenshotUrl, host);
    if (shot) payload.screenshotUrl = shot;
    if (p.notes !== undefined) payload.notes = str(p.notes, 'notes', MAX_NOTES_LENGTH);
    return payload;
}

function playbookPayload(p: Obj, host: string): PlaybookSharePayload {
    if (!Array.isArray(p.rules) || p.rules.length > MAX_RULES) fail('rules is invalid');
    const stats = obj(p.stats, 'stats');
    const payload: PlaybookSharePayload = {
        v: 1,
        name: str(p.name, 'name', MAX_NAME_LENGTH),
        timeframe: strOrNull(p.timeframe, 'timeframe', 64),
        description: strOrNull(p.description, 'description', MAX_DESCRIPTION_LENGTH),
        rules: p.rules.map((rule, i) => str(rule, `rules[${i}]`, MAX_RULE_LENGTH)),
        winRateTarget: num(p.winRateTarget, 'winRateTarget'),
        stats: {
            tradeCount: num(stats.tradeCount, 'stats.tradeCount'),
            winRate: num(stats.winRate, 'stats.winRate'),
            avgResult: stats.avgResult === null ? null : result(stats.avgResult, 'stats.avgResult'),
        },
    };
    const shot = screenshot(p.screenshotUrl, host);
    if (shot) payload.screenshotUrl = shot;
    return payload;
}

/**
 * Validate an untrusted share card and rebuild it with only known keys.
 * Used before storing a share, by the image API, and on every public read.
 */
export function validateSharedCard(input: unknown, allowedImageHost: string): ValidationResult {
    try {
        const card = obj(input, 'card');
        const payload = obj(card.payload, 'payload');

        if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_PAYLOAD_BYTES) {
            fail('payload is too large');
        }
        if (payload.v !== 1) fail('unsupported payload version');

        if (card.kind === 'trade') {
            return { ok: true, card: { kind: 'trade', payload: tradePayload(payload, allowedImageHost) } };
        }
        if (card.kind === 'playbook') {
            return { ok: true, card: { kind: 'playbook', payload: playbookPayload(payload, allowedImageHost) } };
        }
        fail('kind is invalid');
    } catch (error) {
        if (error instanceof InvalidPayload) return { ok: false, error: error.message };
        throw error;
    }
}

/** Host of the project's Supabase URL — the only host screenshots may come from. */
export function supabaseImageHost(): string {
    try {
        return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').host;
    } catch {
        return '';
    }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

const startsWith = (bytes: Uint8Array, signature: number[]) =>
    bytes.length >= signature.length && signature.every((b, i) => bytes[i] === b);

/**
 * The card renderer (Satori) can only draw PNG and JPEG. Check the file's
 * signature rather than its declared content type, since a failed client-side
 * compression can upload WebP/HEIC labelled as image/png.
 */
export function renderableImageType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
    if (startsWith(bytes, PNG_SIGNATURE)) return 'image/png';
    if (startsWith(bytes, JPEG_SIGNATURE)) return 'image/jpeg';
    return null;
}
