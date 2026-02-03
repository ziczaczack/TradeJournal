'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { uploadScreenshot } from '@/lib/screenshotStorage';
import { ImagePlus, X, ZoomIn, Upload, Clipboard } from 'lucide-react';

interface ScreenshotUploaderProps {
    userId: string;
    tradeId: string;
    currentUrl: string | null;
    onUploadComplete: (url: string) => void;
}

type UploadState = 'idle' | 'compressing' | 'uploading' | 'success' | 'error';

export function ScreenshotUploader({
    userId,
    tradeId,
    currentUrl,
    onUploadComplete,
}: ScreenshotUploaderProps) {
    const [state, setState] = useState<UploadState>('idle');
    const [progress, setProgress] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
    const [errorMessage, setErrorMessage] = useState('');
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update preview when currentUrl prop changes
    useEffect(() => {
        setPreviewUrl(currentUrl);
    }, [currentUrl]);

    // Handle file upload
    const handleFile = useCallback(
        async (file: File) => {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                setErrorMessage('Please upload an image file');
                setState('error');
                return;
            }

            // Validate file size (max 10MB before compression)
            if (file.size > 10 * 1024 * 1024) {
                setErrorMessage('File size exceeds 10MB limit');
                setState('error');
                return;
            }

            try {
                // Step 1: Compressing
                setState('compressing');
                setProgress(30);
                setErrorMessage('');

                // Create local preview immediately
                const localPreview = URL.createObjectURL(file);
                setPreviewUrl(localPreview);

                // Step 2: Uploading
                setState('uploading');
                setProgress(60);

                const publicUrl = await uploadScreenshot(file, userId, tradeId);

                // Cleanup local preview and use the actual URL
                URL.revokeObjectURL(localPreview);
                setPreviewUrl(publicUrl);
                setProgress(100);
                setState('success');

                // Notify parent
                onUploadComplete(publicUrl);

                // Reset state after short delay
                setTimeout(() => {
                    setState('idle');
                    setProgress(0);
                }, 1000);
            } catch (err) {
                console.error('Upload error:', err);
                setErrorMessage(
                    err instanceof Error ? err.message : 'Upload failed'
                );
                setState('error');
            }
        },
        [userId, tradeId, onUploadComplete]
    );

    // Handle paste event (Ctrl+V)
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            // Check if we have image data in clipboard
            const items = e.clipboardData?.items;
            if (!items) return;

            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (file) {
                        handleFile(file);
                    }
                    break;
                }
            }
        };

        // Listen to paste events on the container and document
        const container = containerRef.current;
        if (container) {
            container.addEventListener('paste', handlePaste);
        }
        document.addEventListener('paste', handlePaste);

        return () => {
            if (container) {
                container.removeEventListener('paste', handlePaste);
            }
            document.removeEventListener('paste', handlePaste);
        };
    }, [handleFile]);

    // Handle drag and drop
    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        },
        [handleFile]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    // Handle file input change
    const handleFileSelect = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // Reset input so same file can be selected again
            e.target.value = '';
        },
        [handleFile]
    );

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleRemove = () => {
        setPreviewUrl(null);
        onUploadComplete('');
    };

    const isUploading = state === 'compressing' || state === 'uploading';

    return (
        <div ref={containerRef} className="space-y-2">
            <label className="text-sm text-slate-400 flex items-center gap-2">
                <ImagePlus className="w-4 h-4" />
                Screenshot
            </label>

            {/* Upload Area or Preview */}
            {!previewUrl && !isUploading && state !== 'error' ? (
                <div
                    onClick={handleClick}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    className={`
                        border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                        transition-all duration-200
                        ${isDragOver
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
                        }
                    `}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <div className="space-y-2">
                        <div className="flex justify-center gap-2 text-slate-500">
                            <Upload className="w-5 h-5" />
                            <Clipboard className="w-5 h-5" />
                        </div>
                        <p className="text-sm text-slate-400">
                            Click to upload or <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">Ctrl+V</kbd> to paste
                        </p>
                        <p className="text-xs text-slate-500">
                            PNG, JPG up to 10MB
                        </p>
                    </div>
                </div>
            ) : null}

            {/* Upload Progress */}
            {isUploading && (
                <div className="space-y-3 py-4">
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                        <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                        {state === 'compressing'
                            ? 'Compressing image...'
                            : 'Uploading...'}
                    </div>
                    <Progress value={progress} className="h-1" />
                </div>
            )}

            {/* Error State */}
            {state === 'error' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <p className="text-sm text-red-400">{errorMessage}</p>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setState('idle')}
                        className="mt-2 text-xs"
                    >
                        Try again
                    </Button>
                </div>
            )}

            {/* Preview Thumbnail */}
            {previewUrl && !isUploading && state !== 'error' && (
                <div className="relative group">
                    <div
                        className="rounded-lg overflow-hidden border border-slate-700 cursor-pointer transition-all hover:border-blue-500"
                        onClick={() => setIsLightboxOpen(true)}
                    >
                        <img
                            src={previewUrl}
                            alt="Trade screenshot"
                            className="w-full h-auto max-h-48 object-cover"
                            onError={() => {
                                setPreviewUrl(null);
                                setErrorMessage('Failed to load image');
                                setState('error');
                            }}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRemove();
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full bg-red-600 hover:bg-red-700 text-white"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            )}

            {/* Lightbox Dialog */}
            <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-2 bg-slate-900 border-slate-700">
                    <DialogTitle className="sr-only">Screenshot Preview</DialogTitle>
                    <DialogDescription className="sr-only">
                        Full size preview of the trade screenshot
                    </DialogDescription>
                    {previewUrl && (
                        <img
                            src={previewUrl}
                            alt="Trade screenshot full size"
                            className="w-full h-auto max-h-[85vh] object-contain rounded"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default ScreenshotUploader;
