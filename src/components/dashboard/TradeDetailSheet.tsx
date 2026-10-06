'use client';

import { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trade, updateTrade, fetchTradeById } from '@/lib/tradeQueries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { tradeQueryKeys } from '@/hooks/useTrades';
import { MistakePicker } from '@/components/dashboard/MistakePicker';
import { fetchMistakeTags, mistakeTagsQueryKey } from '@/lib/mistakeTagQueries';
import type { MistakeState } from '@/lib/mistakeStats';
import { TradeWriteUp } from '@/components/dashboard/TradeWriteUp';
import { ReviewAnswers, ReviewTemplate, writeUpToSave } from '@/lib/tradeReview';
import { ScreenshotUploader } from '@/components/ScreenshotUploader';
import { formatPnL } from '@/lib/tradeStats';
import { PlaybookSetup, fetchPlaybookSetups } from '@/lib/playbookQueries';
import dynamic from 'next/dynamic';
import { Share2 } from 'lucide-react';
import { ShareDialog } from '@/components/share/ShareDialog';

// Load chart client-side only (uses browser APIs)
const TradingChart = dynamic(
    () => import('@/components/TradingChart').then(m => m.TradingChart),
    { ssr: false }
);

interface TradeDetailSheetProps {
    trade: Trade | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (updatedTrade: Trade) => void;
}

const SETUP_TYPES = [
    'Silver Bullet',
    'ICT Power of 3',
    'Turtle Soup',
    'OTE Retracement',
    'Breaker Block',
    'Order Block',
    'Fair Value Gap',
    'Other',
];

const PSYCHOLOGY_TAGS = [
    'Calm',
    'Confident',
    'FOMO',
    'Revenge',
    'Fear',
    'Impatient',
    'Greedy',
    'Disciplined',
];

export function TradeDetailSheet({
    trade,
    isOpen,
    onClose,
    onUpdate,
}: TradeDetailSheetProps) {
    const queryClient = useQueryClient();
    // List rows omit notes/screenshot_url; load the full row before the form
    // can be saved, or Save would overwrite them with blanks.
    const { data: fullTrade, isError: fullTradeError } = useQuery({
        queryKey: tradeQueryKeys.detail(trade?.id ?? ''),
        queryFn: () => fetchTradeById(trade!.id),
        enabled: isOpen && !!trade,
        staleTime: 0,
    });
    const [setupType, setSetupType] = useState<string>('__none__');
    const [isValidSetup, setIsValidSetup] = useState<string>('null');
    const [psychologyTag, setPsychologyTag] = useState<string>('__none__');
    const [rating, setRating] = useState<number>(0);
    const [notes, setNotes] = useState<string>('');
    const [screenshotUrl, setScreenshotUrl] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [playbookSetups, setPlaybookSetups] = useState<PlaybookSetup[]>([]);
    const [shareOpen, setShareOpen] = useState(false);
    const [mistakeState, setMistakeState] = useState<MistakeState>({ tagIds: [], reviewed: false });
    const [reviewTemplate, setReviewTemplate] = useState<ReviewTemplate | null>(null);
    const [reviewAnswers, setReviewAnswers] = useState<ReviewAnswers>({});
    const { data: mistakeTags = [], isError: mistakeTagsError } = useQuery({
        queryKey: mistakeTagsQueryKey,
        queryFn: () => fetchMistakeTags(),
        enabled: isOpen,
    });

    // Fetch setups from playbook
    useEffect(() => {
        const loadSetups = async () => {
            try {
                const data = await fetchPlaybookSetups();
                setPlaybookSetups(data);
            } catch (err) {
                console.error('Failed to load playbook setups:', err);
            }
        };
        loadSetups();
    }, []);

    // Reset the form from the saved row each time the sheet opens or the trade
    // changes — not only when the data changes — so edits abandoned by closing
    // without saving can't come back and be saved on the next Save.
    const loadedTrade = fullTrade && fullTrade.id === trade?.id ? fullTrade : null;
    useEffect(() => {
        if (isOpen && fullTrade && fullTrade.id === trade?.id) {
            setSetupType(fullTrade.setup_type || '__none__');
            setIsValidSetup(
                fullTrade.is_valid_setup === true
                    ? 'true'
                    : fullTrade.is_valid_setup === false
                        ? 'false'
                        : 'null'
            );
            setPsychologyTag(fullTrade.psychology_tag || '__none__');
            setRating(fullTrade.rating || 0);
            setNotes(fullTrade.notes || '');
            setScreenshotUrl(fullTrade.screenshot_url || '');
            setMistakeState({
                tagIds: fullTrade.mistake_tag_ids ?? [],
                reviewed: fullTrade.mistakes_reviewed ?? false,
            });
            setReviewTemplate(fullTrade.review_template ?? null);
            setReviewAnswers(fullTrade.review_answers ?? {});
            setSaveError(null);
        }
    }, [fullTrade, isOpen, trade?.id]);

    const handleSave = async () => {
        if (!trade) return;

        setSaveError(null);
        setIsSaving(true);
        try {
            const updated = await updateTrade(trade.id, {
                setup_type: setupType === '__none__' ? null : setupType,
                is_valid_setup:
                    isValidSetup === 'true' ? true : isValidSetup === 'false' ? false : null,
                psychology_tag: psychologyTag === '__none__' ? null : psychologyTag,
                rating: rating > 0 ? rating : null,
                notes: notes || null,
                screenshot_url: screenshotUrl || null,
                mistake_tag_ids: mistakeState.tagIds,
                mistakes_reviewed: mistakeState.reviewed,
                ...writeUpToSave(reviewTemplate, reviewAnswers),
            });

            if (updated) {
                queryClient.setQueryData(tradeQueryKeys.detail(updated.id), updated);
                queryClient.invalidateQueries({ queryKey: tradeQueryKeys.all });
                onUpdate(updated);
                onClose();
            }
        } catch (error) {
            console.error('Failed to update trade:', error);
            // Keep the sheet open with everything typed, and say so.
            setSaveError('Couldn’t save this review. Your changes are still here — try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!trade) return null;

    const pnlFormatted = formatPnL(trade.pnl);

    const formatTime = (timestamp: string | null | undefined): string => {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px] glass-card border-zinc-800/50 overflow-y-auto">
                <SheetHeader className="pb-4 border-b border-zinc-800/50">
                    <SheetTitle className="flex items-center gap-3">
                        <Badge
                            variant="outline"
                            className="text-lg px-3 py-1 bg-zinc-800/50 border-zinc-700 text-white font-mono"
                        >
                            {trade.symbol}
                        </Badge>
                        <span
                            className={`text-xl font-bold font-mono ${pnlFormatted.isPositive
                                ? 'text-profit'
                                : 'text-loss'
                                }`}
                        >
                            {pnlFormatted.text}
                        </span>
                    </SheetTitle>
                    <SheetDescription className="text-muted-foreground">
                        Review and annotate this trade
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Read-only Trade Info */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Entry</p>
                            <p className="text-sm text-zinc-200 font-medium">{formatTime(trade.entry_time)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Exit</p>
                            <p className="text-sm text-zinc-200 font-medium">{formatTime(trade.exit_time)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</p>
                            <p className="text-sm text-zinc-200 font-medium font-mono">{trade.quantity || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                            <p className="text-sm text-zinc-200 font-medium">{trade.duration || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Buy Price</p>
                            <p className="text-sm text-zinc-200 font-medium font-mono">${trade.buy_price?.toFixed(2) || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Sell Price</p>
                            <p className="text-sm text-zinc-200 font-medium font-mono">${trade.sell_price?.toFixed(2) || '-'}</p>
                        </div>
                    </div>

                    {/* K-Line Chart — temporarily disabled.
                        Yahoo Finance does not support CME continuous contracts (e.g. MNQ1!).
                        Re-enable when a compatible data source is available.
                    {trade.symbol && trade.entry_time && (
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Chart</p>
                            <TradingChart
                                symbol={trade.symbol}
                                entryTime={trade.entry_time}
                                exitTime={trade.exit_time}
                                entryPrice={trade.buy_price ?? undefined}
                                exitPrice={trade.sell_price ?? undefined}
                                pnl={trade.pnl}
                            />
                        </div>
                    )} */}

                    {/* Economic Context disabled — see ECONOMIC_CALENDAR_ENABLED in economicCalendarQueries.ts
                    <RelatedEconomicEvents entryTime={trade.entry_time} /> */}

                    {/* Editable Fields */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800/50 pb-2 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs">📝</span>
                            Trade Review
                        </h3>

                        {/* Setup Type */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400 font-medium">Setup Type</label>
                            <Select value={setupType} onValueChange={setSetupType}>
                                <SelectTrigger className="bg-zinc-900/50 border-zinc-700/50 hover:border-zinc-600 transition-colors focus:ring-blue-500/30">
                                    <SelectValue placeholder="Select setup..." />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                    <SelectItem value="__none__">None</SelectItem>
                                    {playbookSetups.map((s) => (
                                        <SelectItem key={s.id} value={s.name}>
                                            {s.name}
                                        </SelectItem>
                                    ))}
                                    {/* Fallback to static ones if playbook is empty, for better UX */}
                                    {playbookSetups.length === 0 && SETUP_TYPES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Valid Setup */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400 font-medium">Valid Setup?</label>
                            <Select value={isValidSetup} onValueChange={setIsValidSetup}>
                                <SelectTrigger className="bg-zinc-900/50 border-zinc-700/50 hover:border-zinc-600 transition-colors focus:ring-blue-500/30">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                    <SelectItem value="null">Not Reviewed</SelectItem>
                                    <SelectItem value="true">
                                        <span className="text-emerald-400">✓</span> Yes, Valid Setup
                                    </SelectItem>
                                    <SelectItem value="false">
                                        <span className="text-rose-400">✗</span> No, Invalid Setup
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Psychology Tag */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400 font-medium">Psychology Tag</label>
                            <Select value={psychologyTag} onValueChange={setPsychologyTag}>
                                <SelectTrigger className="bg-zinc-900/50 border-zinc-700/50 hover:border-zinc-600 transition-colors focus:ring-blue-500/30">
                                    <SelectValue placeholder="How were you feeling?" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-700">
                                    <SelectItem value="__none__">None</SelectItem>
                                    {PSYCHOLOGY_TAGS.map((tag) => (
                                        <SelectItem key={tag} value={tag}>
                                            {tag}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Mistakes */}
                        <MistakePicker
                            tags={mistakeTags}
                            state={mistakeState}
                            onChange={setMistakeState}
                            loadError={mistakeTagsError}
                        />

                        {/* Rating */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400 font-medium">Rating</label>
                            <div className="flex items-center gap-1 p-2 bg-zinc-900/30 rounded-lg w-fit">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`text-2xl transition-all duration-200 hover:scale-125 ${star <= rating
                                            ? 'opacity-100 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                                            : 'opacity-30 hover:opacity-50'
                                            }`}
                                    >
                                        ⭐
                                    </button>
                                ))}
                                {rating > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setRating(0)}
                                        className="text-xs text-muted-foreground hover:text-zinc-400 ml-3 transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="text-sm text-zinc-400 font-medium">Notes</label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="What did you learn from this trade?"
                                className="bg-zinc-900/50 border-zinc-700/50 min-h-[100px] focus:ring-blue-500/30 focus:border-zinc-600 placeholder:text-muted-foreground resize-none"
                            />
                        </div>

                        {/* Screenshot Upload */}
                        <ScreenshotUploader
                            userId={trade.user_id || 'anonymous'}
                            tradeId={trade.id}
                            currentUrl={screenshotUrl || null}
                            onUploadComplete={(url) => setScreenshotUrl(url)}
                        />

                        {/* Write-up */}
                        <TradeWriteUp
                            template={reviewTemplate}
                            answers={reviewAnswers}
                            hasScreenshot={!!screenshotUrl}
                            onChange={(template, answers) => {
                                setReviewTemplate(template);
                                setReviewAnswers(answers);
                            }}
                        />
                    </div>

                    {saveError && <p className="text-sm text-rose-400">{saveError}</p>}

                    {fullTradeError && (
                        <p className="text-sm text-rose-400">Couldn&apos;t load this trade&apos;s details. Close and reopen to try again.</p>
                    )}

                    {/* Save / Share */}
                    <div className="pt-4 border-t border-zinc-800/50 flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShareOpen(true)}
                            className="border-zinc-700 text-zinc-200"
                        >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={isSaving || !loadedTrade}
                            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 transition-all duration-200 btn-scale"
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </span>
                            ) : (
                                'Save Review'
                            )}
                        </Button>
                    </div>
                </div>
                <ShareDialog
                    key={trade.id}
                    open={shareOpen}
                    onOpenChange={setShareOpen}
                    source={{
                        kind: 'trade',
                        trade: {
                            ...trade,
                            notes: notes || null,
                            screenshot_url: screenshotUrl || null,
                            setup_type: setupType === '__none__' ? null : setupType,
                            rating: rating > 0 ? rating : null,
                        },
                    }}
                />
            </SheetContent>
        </Sheet>
    );
}
