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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trade, updateTrade } from '@/lib/tradeQueries';
import { ScreenshotUploader } from '@/components/ScreenshotUploader';
import { formatPnL } from '@/lib/tradeStats';

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
    const [setupType, setSetupType] = useState<string>('__none__');
    const [isValidSetup, setIsValidSetup] = useState<string>('null');
    const [psychologyTag, setPsychologyTag] = useState<string>('__none__');
    const [rating, setRating] = useState<number>(0);
    const [notes, setNotes] = useState<string>('');
    const [screenshotUrl, setScreenshotUrl] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Reset form when trade changes
    useEffect(() => {
        if (trade) {
            setSetupType(trade.setup_type || '__none__');
            setIsValidSetup(
                trade.is_valid_setup === true
                    ? 'true'
                    : trade.is_valid_setup === false
                        ? 'false'
                        : 'null'
            );
            setPsychologyTag(trade.psychology_tag || '__none__');
            setRating(trade.rating || 0);
            setNotes(trade.notes || '');
            setScreenshotUrl(trade.screenshot_url || '');
        }
    }, [trade]);

    const handleSave = async () => {
        if (!trade) return;

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
            });

            if (updated) {
                onUpdate(updated);
                onClose();
            }
        } catch (error) {
            console.error('Failed to update trade:', error);
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
            <SheetContent className="w-[400px] sm:w-[540px] bg-slate-900 border-slate-700 overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-3">
                        <Badge variant="outline" className="text-lg px-3 py-1">
                            {trade.symbol}
                        </Badge>
                        <span
                            className={`text-xl font-bold ${pnlFormatted.isPositive ? 'text-green-400' : 'text-red-400'
                                }`}
                        >
                            {pnlFormatted.text}
                        </span>
                    </SheetTitle>
                    <SheetDescription className="text-slate-400">
                        Review and annotate this trade
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Read-only Trade Info */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
                        <div>
                            <p className="text-xs text-slate-500">Entry</p>
                            <p className="text-sm text-white">{formatTime(trade.entry_time)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Exit</p>
                            <p className="text-sm text-white">{formatTime(trade.exit_time)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Quantity</p>
                            <p className="text-sm text-white">{trade.quantity || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Duration</p>
                            <p className="text-sm text-white">{trade.duration || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Buy Price</p>
                            <p className="text-sm text-white">${trade.buy_price?.toFixed(2) || '-'}</p>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500">Sell Price</p>
                            <p className="text-sm text-white">${trade.sell_price?.toFixed(2) || '-'}</p>
                        </div>
                    </div>

                    {/* Editable Fields */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2">
                            📝 Trade Review
                        </h3>

                        {/* Setup Type */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Setup Type</label>
                            <Select value={setupType} onValueChange={setSetupType}>
                                <SelectTrigger className="bg-slate-800 border-slate-700">
                                    <SelectValue placeholder="Select setup..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                    <SelectItem value="__none__">None</SelectItem>
                                    {SETUP_TYPES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Valid Setup */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Valid Setup?</label>
                            <Select value={isValidSetup} onValueChange={setIsValidSetup}>
                                <SelectTrigger className="bg-slate-800 border-slate-700">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                    <SelectItem value="null">Not Reviewed</SelectItem>
                                    <SelectItem value="true">✓ Yes, Valid Setup</SelectItem>
                                    <SelectItem value="false">✗ No, Invalid Setup</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Psychology Tag */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Psychology Tag</label>
                            <Select value={psychologyTag} onValueChange={setPsychologyTag}>
                                <SelectTrigger className="bg-slate-800 border-slate-700">
                                    <SelectValue placeholder="How were you feeling?" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-800 border-slate-700">
                                    <SelectItem value="__none__">None</SelectItem>
                                    {PSYCHOLOGY_TAGS.map((tag) => (
                                        <SelectItem key={tag} value={tag}>
                                            {tag}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Rating */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Rating (1-5)</label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        type="button"
                                        onClick={() => setRating(star)}
                                        className={`text-2xl transition-transform hover:scale-110 ${star <= rating ? 'opacity-100' : 'opacity-30'
                                            }`}
                                    >
                                        ⭐
                                    </button>
                                ))}
                                {rating > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setRating(0)}
                                        className="text-xs text-slate-500 ml-2"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-2">
                            <label className="text-sm text-slate-400">Notes</label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="What did you learn from this trade?"
                                className="bg-slate-800 border-slate-700 min-h-[100px]"
                            />
                        </div>

                        {/* Screenshot Upload */}
                        <ScreenshotUploader
                            userId={trade.user_id || 'anonymous'}
                            tradeId={trade.id}
                            currentUrl={screenshotUrl || null}
                            onUploadComplete={(url) => setScreenshotUrl(url)}
                        />
                    </div>

                    {/* Save Button */}
                    <div className="pt-4 border-t border-slate-700">
                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {isSaving ? 'Saving...' : 'Save Review'}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
