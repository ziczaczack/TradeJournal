import type { CSSProperties, ReactNode } from 'react';
import {
    formatShareResult,
    PlaybookSharePayload,
    SharedCard,
    TradeSharePayload,
} from '@/lib/sharePayload';

// Rendered by next/og (Satori) and in the DOM for the dialog preview, so it
// must stick to inline styles and flexbox: every element with more than one
// child sets display: flex. Avoid emoji/★/✓ — the default OG font lacks them.

export const SHARE_CARD_WIDTH = 1200;
export const SHARE_CARD_HEIGHT = 630;

const colors = {
    bg: '#09090b',
    panel: '#18181b',
    border: '#27272a',
    text: '#fafafa',
    muted: '#a1a1aa',
    faint: '#71717a',
    win: '#34d399',
    loss: '#fb7185',
    accent: '#60a5fa',
};

// One line, cut with an ellipsis — keeps long names/rules from overflowing.
const oneLine: CSSProperties = {
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

const frame: CSSProperties = {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    background: colors.bg,
    color: colors.text,
    padding: 48,
    fontFamily: 'sans-serif',
    boxSizing: 'border-box',
};

function formatPrice(value: number | null): string {
    return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

// Futures traders read times in exchange time; show ET explicitly.
function formatEntryTime(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    return `${date.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })} ET`;
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '33%', marginBottom: 20 }}>
            <div style={{ display: 'flex', fontSize: 16, color: colors.faint, textTransform: 'uppercase', letterSpacing: 1 }}>
                {label}
            </div>
            <div style={{ ...oneLine, fontSize: 26, color: colors.text, marginTop: 4, paddingRight: 16 }}>{value}</div>
        </div>
    );
}

function Badge({ children, color }: { children: ReactNode; color: string }) {
    return (
        <div
            style={{
                display: 'flex',
                fontSize: 20,
                fontWeight: 700,
                color,
                border: `2px solid ${color}`,
                borderRadius: 8,
                padding: '4px 12px',
                marginLeft: 16,
                flexShrink: 0,
            }}
        >
            {children}
        </div>
    );
}

function Footer() {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', fontSize: 18, color: colors.faint }}>
            <div style={{ display: 'flex' }}>My Trading Journal</div>
        </div>
    );
}

function Screenshot({ url }: { url: string }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={url}
            alt=""
            width={460}
            height={330}
            style={{ objectFit: 'cover', borderRadius: 12, border: `1px solid ${colors.border}`, marginLeft: 40 }}
        />
    );
}

function TradeCard({ p }: { p: TradeSharePayload }) {
    const resultColor = p.result.value >= 0 ? colors.win : colors.loss;
    return (
        <div style={frame}>
            <div style={{ display: 'flex', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ ...oneLine, fontSize: 44, fontWeight: 700, flexShrink: 1, minWidth: 0 }}>{p.symbol}</div>
                        <Badge color={p.side === 'long' ? colors.win : colors.loss}>
                            {p.side === 'long' ? 'LONG' : 'SHORT'}
                        </Badge>
                    </div>
                    <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, color: resultColor, margin: '16px 0 28px' }}>
                        {formatShareResult(p.result)}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        <Stat label="Entry" value={formatPrice(p.entryPrice)} />
                        <Stat label="Exit" value={formatPrice(p.exitPrice)} />
                        <Stat label="Duration" value={p.duration ?? '—'} />
                        <Stat label="Opened" value={formatEntryTime(p.entryTime)} />
                        <Stat label="Setup" value={p.setupName ?? '—'} />
                        <Stat label="Rating" value={p.rating ? `${p.rating}/5` : '—'} />
                    </div>
                    {p.notes && (
                        <div style={{ display: 'flex', fontSize: 20, color: colors.muted, fontStyle: 'italic', maxHeight: 84, overflow: 'hidden' }}>
                            {`“${p.notes}”`}
                        </div>
                    )}
                </div>
                {p.screenshotUrl && <Screenshot url={p.screenshotUrl} />}
            </div>
            <Footer />
        </div>
    );
}

function PlaybookCard({ p }: { p: PlaybookSharePayload }) {
    const { stats } = p;
    return (
        <div style={frame}>
            <div style={{ display: 'flex', flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', fontSize: 18, color: colors.accent, textTransform: 'uppercase', letterSpacing: 2 }}>
                        Playbook setup
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                        <div style={{ ...oneLine, fontSize: 48, fontWeight: 700, flexShrink: 1, minWidth: 0 }}>{p.name}</div>
                        {p.timeframe && <Badge color={colors.accent}>{p.timeframe}</Badge>}
                    </div>
                    {p.description && (
                        <div style={{ display: 'flex', fontSize: 22, color: colors.muted, marginTop: 12, maxHeight: 60, overflow: 'hidden' }}>
                            {p.description}
                        </div>
                    )}
                    {/* Shrinks and clips so the stats row always stays on the card */}
                    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20, flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        {p.rules.map((rule, i) => (
                            <div key={i} style={{ ...oneLine, fontSize: 20, color: colors.text, marginBottom: 6, flexShrink: 0 }}>
                                {`${i + 1}. ${rule}`}
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', paddingTop: 16 }}>
                        <Stat label="Trades" value={String(stats.tradeCount)} />
                        <Stat label="Win rate / target" value={`${stats.winRate.toFixed(1)}% / ${p.winRateTarget}%`} />
                        <Stat label="Avg result" value={stats.avgResult ? formatShareResult(stats.avgResult) : '—'} />
                    </div>
                </div>
                {p.screenshotUrl && <Screenshot url={p.screenshotUrl} />}
            </div>
            <Footer />
        </div>
    );
}

function UnavailableCard() {
    return (
        <div style={{ ...frame, alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ display: 'flex', fontSize: 48, fontWeight: 700 }}>Link unavailable</div>
            <div style={{ display: 'flex', fontSize: 24, color: colors.muted, marginTop: 12 }}>
                This shared card was removed or never existed.
            </div>
        </div>
    );
}

export function ShareCard({ card }: { card: SharedCard | null }) {
    if (!card) return <UnavailableCard />;
    return card.kind === 'trade' ? <TradeCard p={card.payload} /> : <PlaybookCard p={card.payload} />;
}
