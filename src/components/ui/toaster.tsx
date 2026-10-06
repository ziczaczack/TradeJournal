'use client';

import { Toaster as Sonner } from 'sonner';

/** App-wide toast outlet, styled with the theme tokens. Trigger with `toast` from 'sonner'. */
export function Toaster() {
    return (
        <Sonner
            theme="dark"
            position="bottom-right"
            richColors
            closeButton
            toastOptions={{
                classNames: {
                    toast: 'bg-zinc-900 border border-border text-foreground',
                },
            }}
        />
    );
}
