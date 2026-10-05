'use client';

import { useEffect } from 'react';
import './globals.css';

// Last-resort boundary for crashes in the root layout or its providers.
// It replaces the root layout, so it must render its own <html> and <body>
// and cannot rely on the providers or shared UI components.
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('App crashed:', error);
    }, [error]);

    return (
        <html lang="en" className="dark">
            <body className="antialiased">
                <main className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
                    <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
                    <p className="text-zinc-400 text-sm max-w-md">
                        The app failed to load. Your saved trades and journal entries are not affected.
                    </p>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={reset}
                            className="rounded-md bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white"
                        >
                            Try again
                        </button>
                        {/* A full page load re-runs the crashed layout from scratch. */}
                        <button
                            onClick={() => window.location.assign('/')}
                            className="text-blue-400 text-sm hover:underline"
                        >
                            Reload app
                        </button>
                    </div>
                    {error.digest && (
                        <p className="text-muted-foreground text-xs">Error reference: {error.digest}</p>
                    )}
                </main>
            </body>
        </html>
    );
}
