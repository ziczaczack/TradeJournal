'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, Link2, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAccount } from '@/components/providers/AccountContext';
import { getSupabase } from '@/lib/supabase';
import type { Trade } from '@/lib/tradeQueries';
import type { PlaybookSetup } from '@/lib/playbookQueries';
import {
    availablePlaybookResultModes,
    availableTradeResultModes,
    buildPlaybookSharePayload,
    buildTradeSharePayload,
    defaultResultMode,
    ResultMode,
    SharedCard,
} from '@/lib/sharePayload';
import { createShare, listSharesForSource, revokeShare, ShareLink } from '@/lib/shareQueries';
import { ShareCard, SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from './ShareCard';

export type ShareSource =
    | { kind: 'trade'; trade: Trade }
    | { kind: 'playbook'; setup: PlaybookSetup; trades: Trade[] };

interface ShareDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    source: ShareSource;
}

const MODE_LABELS: Record<ResultMode, string> = {
    points: 'Points',
    usd: '$ P&L',
    percent: '% of account',
};

const PREVIEW_SCALE = 0.5;

function shareUrl(token: string): string {
    return `${window.location.origin}/share/${token}`;
}

export function ShareDialog({ open, onOpenChange, source }: ShareDialogProps) {
    const { currentAccount } = useAccount();
    const initialBalance = currentAccount?.initial_balance ?? null;

    const [requestedMode, setRequestedMode] = useState<ResultMode | null>(null);
    const [includeScreenshot, setIncludeScreenshot] = useState(false);
    const [includeNotes, setIncludeNotes] = useState(false);
    const [links, setLinks] = useState<ShareLink[]>([]);
    const [busy, setBusy] = useState<'download' | 'copy' | 'link' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const sourceId = source.kind === 'trade' ? source.trade.id : source.setup.id;
    const hasScreenshot = source.kind === 'trade' ? !!source.trade.screenshot_url : !!source.setup.screenshot_url;
    const hasNotes = source.kind === 'trade' && !!source.trade.notes?.trim();

    const modes = source.kind === 'trade'
        ? availableTradeResultModes(source.trade, initialBalance)
        : availablePlaybookResultModes(initialBalance);
    const mode = requestedMode && modes.includes(requestedMode) ? requestedMode : defaultResultMode(modes);

    const card: SharedCard = useMemo(() => {
        if (source.kind === 'trade') {
            return {
                kind: 'trade',
                payload: buildTradeSharePayload(source.trade, { resultMode: mode, includeScreenshot, includeNotes }, initialBalance),
            };
        }
        return {
            kind: 'playbook',
            payload: buildPlaybookSharePayload(source.setup, source.trades, { resultMode: mode, includeScreenshot }, initialBalance),
        };
    }, [source, mode, includeScreenshot, includeNotes, initialBalance]);

    useEffect(() => {
        if (!open) return;
        listSharesForSource(source.kind, sourceId)
            .then(setLinks)
            .catch(() => setError('Could not load existing links.'));
    }, [open, source.kind, sourceId]);

    const fetchImage = async (): Promise<Blob> => {
        const res = await fetch('/api/share/image', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(card),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error ?? 'Could not render the image.');
        }
        return res.blob();
    };

    const run = async (action: 'download' | 'copy' | 'link', fn: () => Promise<void>, failure: string) => {
        setBusy(action);
        setError(null);
        try {
            await fn();
        } catch (err) {
            console.error(err);
            setError(failure);
        } finally {
            setBusy(null);
        }
    };

    const handleDownload = () => run('download', async () => {
        const url = URL.createObjectURL(await fetchImage());
        const a = document.createElement('a');
        a.href = url;
        a.download = `${source.kind === 'trade' ? source.trade.symbol : source.setup.name}-share.png`
            .replace(/[^\w.-]+/g, '-');
        a.click();
        URL.revokeObjectURL(url);
    }, 'Could not create the image.');

    const canCopyImage = typeof window !== 'undefined' && 'ClipboardItem' in window;

    // Pass the blob promise straight to ClipboardItem so Safari keeps the user gesture.
    const handleCopyImage = () => run('copy', async () => {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': fetchImage() })]);
    }, 'Copying failed — use Download instead.');

    const handleCreateLink = () => run('link', async () => {
        const { data: { user } } = await getSupabase().auth.getUser();
        if (!user) throw new Error('Not signed in');
        const link = await createShare(user.id, sourceId, card);
        setLinks(prev => [link, ...prev]);
        await navigator.clipboard.writeText(shareUrl(link.token)).catch(() => undefined);
        setCopiedId(link.id);
    }, 'Could not create the link.');

    const handleCopyLink = async (link: ShareLink) => {
        await navigator.clipboard.writeText(shareUrl(link.token));
        setCopiedId(link.id);
    };

    const handleRevoke = async (link: ShareLink) => {
        setError(null);
        try {
            await revokeShare(link.id);
            setLinks(prev => prev.filter(l => l.id !== link.id));
        } catch {
            setError('Could not revoke the link.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-zinc-950 border-zinc-800">
                <DialogHeader>
                    <DialogTitle className="text-white">
                        Share {source.kind === 'trade' ? 'trade' : 'setup'}
                    </DialogTitle>
                    <DialogDescription className="text-zinc-500">
                        Only what you see on the card is shared. Account name and size are never included.
                    </DialogDescription>
                </DialogHeader>

                {/* Options */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-zinc-500 mr-1">Show result as</span>
                    {modes.map(m => (
                        <Button
                            key={m}
                            size="sm"
                            variant={m === mode ? 'default' : 'outline'}
                            onClick={() => setRequestedMode(m)}
                            className={m === mode ? 'bg-blue-600 hover:bg-blue-500' : 'border-zinc-700 text-zinc-300'}
                        >
                            {MODE_LABELS[m]}
                        </Button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
                    {hasScreenshot && (
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={includeScreenshot} onChange={e => setIncludeScreenshot(e.target.checked)} />
                            Include screenshot
                        </label>
                    )}
                    {hasNotes && (
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={includeNotes} onChange={e => setIncludeNotes(e.target.checked)} />
                            Include notes
                        </label>
                    )}
                </div>

                {/* Preview: the exact card that gets rendered */}
                <div
                    className="overflow-hidden rounded-lg border border-zinc-800 max-w-full"
                    style={{ width: SHARE_CARD_WIDTH * PREVIEW_SCALE, height: SHARE_CARD_HEIGHT * PREVIEW_SCALE }}
                >
                    <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
                        <ShareCard card={card} />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                    <Button onClick={handleDownload} disabled={busy !== null} variant="outline" className="border-zinc-700 text-zinc-200">
                        {busy === 'download' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                        Download PNG
                    </Button>
                    {canCopyImage && (
                        <Button onClick={handleCopyImage} disabled={busy !== null} variant="outline" className="border-zinc-700 text-zinc-200">
                            {busy === 'copy' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Copy className="w-4 h-4 mr-2" />}
                            Copy image
                        </Button>
                    )}
                    <Button onClick={handleCreateLink} disabled={busy !== null} className="bg-emerald-600 hover:bg-emerald-500">
                        {busy === 'link' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
                        Create link
                    </Button>
                </div>

                {error && <p className="text-sm text-rose-400">{error}</p>}

                {/* Existing links */}
                {links.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-xs text-zinc-500 uppercase tracking-wider">Active links</p>
                        {links.map(link => (
                            <div key={link.id} className="flex items-center gap-2 rounded-md border border-zinc-800 px-3 py-2">
                                <span className="flex-1 truncate font-mono text-xs text-zinc-300">{shareUrl(link.token)}</span>
                                <Button size="sm" variant="ghost" onClick={() => handleCopyLink(link)} className="text-zinc-400 hover:text-white">
                                    {copiedId === link.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleRevoke(link)} className="text-zinc-400 hover:text-rose-400">
                                    Revoke
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
