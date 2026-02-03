'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { processTradovateCSV, ParseResult } from '@/lib/processTradovateCSV';
import { insertTrades, InsertResult } from '@/lib/insertTrades';

interface FileUploaderProps {
    userId?: string | null;  // Optional - will import without user association if not provided
    onUploadComplete?: (result: InsertResult) => void;
}

type UploadState = 'idle' | 'parsing' | 'uploading' | 'success' | 'error';

export function FileUploader({ userId, onUploadComplete }: FileUploaderProps) {
    const [state, setState] = useState<UploadState>('idle');
    const [progress, setProgress] = useState(0);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [uploadResult, setUploadResult] = useState<InsertResult | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setState('idle');
        setProgress(0);
        setParseResult(null);
        setUploadResult(null);
        setErrorMessage('');
    };

    const handleFile = useCallback(async (file: File) => {
        // Validate file type
        if (!file.name.endsWith('.csv')) {
            setErrorMessage('Please upload a CSV file');
            setState('error');
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setErrorMessage('File size exceeds 10MB limit');
            setState('error');
            return;
        }

        try {
            // Step 1: Parse CSV
            setState('parsing');
            setProgress(20);

            const text = await file.text();
            const result = processTradovateCSV(text);
            setParseResult(result);
            setProgress(50);

            if (result.data.length === 0) {
                setErrorMessage('No valid trades found in the CSV file');
                setState('error');
                return;
            }

            // Step 2: Upload to Supabase
            setState('uploading');
            setProgress(70);

            const insertResult = await insertTrades(result.data, userId);
            setUploadResult(insertResult);
            setProgress(100);

            if (insertResult.success) {
                setState('success');
                onUploadComplete?.(insertResult);
            } else {
                setErrorMessage(insertResult.error || 'Failed to insert trades');
                setState('error');
            }
        } catch (err) {
            console.error('Upload error:', err);
            setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred');
            setState('error');
        }
    }, [userId, onUploadComplete]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl font-bold">📁 Import Trades</CardTitle>
                <CardDescription>
                    Upload your Tradovate Performance Report CSV to import trades
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Upload Area */}
                {state === 'idle' && (
                    <div
                        onClick={handleClick}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-all duration-200 ease-in-out
              ${isDragOver
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                                : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                            }
            `}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <div className="space-y-4">
                            <div className="text-5xl">📤</div>
                            <div>
                                <p className="text-lg font-medium text-gray-700 dark:text-gray-200">
                                    Drag & drop your CSV file here
                                </p>
                                <p className="text-sm text-gray-500">
                                    or click to browse
                                </p>
                            </div>
                            <p className="text-xs text-gray-400">
                                Supports Tradovate Performance Report format (max 10MB)
                            </p>
                        </div>
                    </div>
                )}

                {/* Progress State */}
                {(state === 'parsing' || state === 'uploading') && (
                    <div className="space-y-4 py-8">
                        <div className="text-center">
                            <div className="text-4xl mb-4 animate-pulse">
                                {state === 'parsing' ? '📊' : '☁️'}
                            </div>
                            <p className="text-lg font-medium">
                                {state === 'parsing' ? 'Parsing CSV...' : 'Uploading to database...'}
                            </p>
                        </div>
                        <Progress value={progress} className="w-full h-2" />
                    </div>
                )}

                {/* Success State */}
                {state === 'success' && parseResult && uploadResult && (
                    <div className="space-y-6 py-4">
                        <div className="text-center">
                            <div className="text-5xl mb-4">✅</div>
                            <p className="text-xl font-bold text-green-600">Import Complete!</p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                <p className="text-2xl font-bold">{parseResult.metadata.totalRows}</p>
                                <p className="text-sm text-gray-500">Total Rows</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                <p className="text-2xl font-bold text-green-600">{uploadResult.insertedCount}</p>
                                <p className="text-sm text-gray-500">Inserted</p>
                            </div>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                                <p className="text-2xl font-bold text-yellow-600">{uploadResult.skippedCount}</p>
                                <p className="text-sm text-gray-500">Skipped (duplicates)</p>
                            </div>
                        </div>

                        {parseResult.errors.length > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                <p className="font-medium text-yellow-700 dark:text-yellow-400 mb-2">
                                    ⚠️ {parseResult.errors.length} row(s) had parsing errors:
                                </p>
                                <ul className="text-sm text-yellow-600 dark:text-yellow-500 space-y-1 max-h-32 overflow-y-auto">
                                    {parseResult.errors.slice(0, 5).map((err, i) => (
                                        <li key={i}>Row {err.row}: {err.message}</li>
                                    ))}
                                    {parseResult.errors.length > 5 && (
                                        <li>...and {parseResult.errors.length - 5} more</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        <Button onClick={resetState} className="w-full" variant="outline">
                            Upload Another File
                        </Button>
                    </div>
                )}

                {/* Error State */}
                {state === 'error' && (
                    <div className="space-y-4 py-4">
                        <div className="text-center">
                            <div className="text-5xl mb-4">❌</div>
                            <p className="text-xl font-bold text-red-600">Import Failed</p>
                            <p className="text-gray-600 dark:text-gray-400 mt-2">{errorMessage}</p>
                        </div>
                        <Button onClick={resetState} className="w-full" variant="outline">
                            Try Again
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default FileUploader;
