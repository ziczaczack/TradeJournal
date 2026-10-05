'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { processTradovateCSV, ParseResult } from '@/lib/processTradovateCSV';
import { insertTrades, InsertResult } from '@/lib/insertTrades';
import { useAccount } from '@/components/providers/AccountContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Building2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface FileUploaderProps {
    userId: string;  // Required - must be authenticated to upload
    onUploadComplete?: (result: InsertResult) => void;
}

type UploadState = 'idle' | 'selecting-account' | 'parsing' | 'uploading' | 'success' | 'error';

export function FileUploader({ userId, onUploadComplete }: FileUploaderProps) {
    const { accounts, currentAccount, isLoading: accountsLoading } = useAccount();
    const [state, setState] = useState<UploadState>('idle');
    const [progress, setProgress] = useState(0);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [uploadResult, setUploadResult] = useState<InsertResult | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize selected account from current account
    useEffect(() => {
        if (currentAccount && !selectedAccountId) {
            setSelectedAccountId(currentAccount.id);
        }
    }, [currentAccount, selectedAccountId]);

    const resetState = () => {
        setState('idle');
        setProgress(0);
        setParseResult(null);
        setUploadResult(null);
        setErrorMessage('');
        setPendingFile(null);
    };

    const handleFileSelected = useCallback((file: File) => {
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

        // Store file and show account selection
        setPendingFile(file);
        setState('selecting-account');
    }, []);

    const processFile = useCallback(async () => {
        // Validate userId is present (security check)
        if (!userId) {
            setErrorMessage('Authentication required. Please sign in to upload trades.');
            setState('error');
            return;
        }

        if (!selectedAccountId) {
            setErrorMessage('Please select an account to import trades into.');
            setState('error');
            return;
        }

        if (!pendingFile) {
            setErrorMessage('No file selected.');
            setState('error');
            return;
        }

        try {
            // Step 1: Parse CSV
            setState('parsing');
            setProgress(20);

            const text = await pendingFile.text();
            const result = processTradovateCSV(text);
            setParseResult(result);
            setProgress(50);

            if (result.data.length === 0) {
                setErrorMessage('No valid trades found in the CSV file');
                setState('error');
                return;
            }

            // Step 2: Upload to Supabase with selected account
            setState('uploading');
            setProgress(70);

            const insertResult = await insertTrades(result.data, userId, selectedAccountId);
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
    }, [userId, selectedAccountId, pendingFile, onUploadComplete]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelected(file);
    }, [handleFileSelected]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelected(file);
    }, [handleFileSelected]);

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
                                : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500'
                            }
            `}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileInputChange}
                            className="hidden"
                        />
                        <div className="space-y-4">
                            <div className="text-5xl">📤</div>
                            <div>
                                <p className="text-lg font-medium text-zinc-700 dark:text-zinc-200">
                                    Drag & drop your CSV file here
                                </p>
                                <p className="text-sm text-zinc-500">
                                    or click to browse
                                </p>
                            </div>
                            <p className="text-xs text-zinc-400">
                                Supports Tradovate Performance Report format (max 10MB)
                            </p>
                        </div>
                    </div>
                )}

                {/* Account Selection Step */}
                {state === 'selecting-account' && (
                    <div className="space-y-6 py-4">
                        <div className="text-center mb-6">
                            <div className="text-4xl mb-4">📋</div>
                            <p className="text-lg font-medium text-white">
                                Select Target Account
                            </p>
                            <p className="text-sm text-zinc-400 mt-1">
                                Choose which account to import {pendingFile?.name} into
                            </p>
                        </div>

                        {accounts.length === 0 ? (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-500" />
                                    <div>
                                        <p className="text-sm font-medium text-yellow-400">
                                            No accounts found
                                        </p>
                                        <p className="text-xs text-zinc-400 mt-1">
                                            Please create an account first to import trades.
                                        </p>
                                    </div>
                                </div>
                                <Link href="/settings/accounts">
                                    <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-500">
                                        <Building2 className="w-4 h-4 mr-2" />
                                        Create Account
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-sm text-zinc-400 mb-2 block">
                                        Import to Account
                                    </label>
                                    <Select
                                        value={selectedAccountId}
                                        onValueChange={setSelectedAccountId}
                                    >
                                        <SelectTrigger className="w-full bg-zinc-800 border-zinc-700 text-white">
                                            <SelectValue placeholder="Select an account" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-700">
                                            {accounts.map((account) => (
                                                <SelectItem
                                                    key={account.id}
                                                    value={account.id}
                                                    className="text-zinc-200 focus:bg-zinc-800 focus:text-white"
                                                >
                                                    <div className="flex flex-col items-start">
                                                        <span>{account.account_name}</span>
                                                        {account.broker_name && (
                                                            <span className="text-xs text-zinc-500">
                                                                {account.broker_name}
                                                            </span>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        className="flex-1 border-zinc-700"
                                        onClick={resetState}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        className="flex-1 bg-blue-600 hover:bg-blue-500"
                                        onClick={processFile}
                                        disabled={!selectedAccountId}
                                    >
                                        Import Trades
                                    </Button>
                                </div>
                            </>
                        )}
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
                            <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                                <p className="text-2xl font-bold">{parseResult.metadata.totalRows}</p>
                                <p className="text-sm text-zinc-500">Total Rows</p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                                <p className="text-2xl font-bold text-green-600">{uploadResult.insertedCount}</p>
                                <p className="text-sm text-zinc-500">Inserted</p>
                            </div>
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                                <p className="text-2xl font-bold text-yellow-600">{uploadResult.skippedCount}</p>
                                <p className="text-sm text-zinc-500">Skipped (duplicates)</p>
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
                            <p className="text-zinc-600 dark:text-zinc-400 mt-2">{errorMessage}</p>
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
