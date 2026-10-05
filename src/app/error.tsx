'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Catches render errors in any page so one crash shows a recoverable
// screen instead of Next.js's blank "Application error".
export default function PageError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Page crashed:', error);
    }, [error]);

    return (
        <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-zinc-400 text-sm max-w-md">
                This page hit an unexpected error. Your saved trades and journal entries are not affected.
            </p>
            <div className="flex items-center gap-3">
                <Button onClick={reset} className="bg-blue-600 hover:bg-blue-700">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Try again
                </Button>
                <Link href="/" className="text-blue-400 text-sm hover:underline">
                    Go to dashboard
                </Link>
            </div>
            {error.digest && (
                <p className="text-muted-foreground text-xs">Error reference: {error.digest}</p>
            )}
        </main>
    );
}
