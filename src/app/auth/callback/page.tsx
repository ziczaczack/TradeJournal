'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { describeAuthError, readAuthErrorCode } from '@/lib/authRecovery';
import { ArrowRight, Loader2, AlertTriangle } from 'lucide-react';

type Status = 'verifying' | 'invalid';

/** How long to wait for the confirmed session before calling the link dead. */
const SESSION_GRACE_MS = 3000;

/**
 * Lands the email confirmation link sent by signUp. The Supabase client parses
 * the token out of the URL on its own; this page only reports the outcome.
 */
export default function AuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState<Status>('verifying');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const supabase = getSupabase();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancelled = false;

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) router.replace('/');
        });

        const resolveLink = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (cancelled) return;

            if (session) {
                router.replace('/');
                return;
            }

            const urlError =
                readAuthErrorCode(window.location.hash) ?? readAuthErrorCode(window.location.search);
            if (urlError) {
                setError(describeAuthError(urlError));
                setStatus('invalid');
                return;
            }

            timer = setTimeout(() => {
                setError('This confirmation link is invalid or has expired.');
                setStatus('invalid');
            }, SESSION_GRACE_MS);
        };

        resolveLink();

        return () => {
            cancelled = true;
            subscription.unsubscribe();
            if (timer) clearTimeout(timer);
        };
    }, [router]);

    if (status === 'invalid') {
        return (
            <AuthCard
                title="Link Not Valid"
                subtitle="We could not confirm your email with this link"
                footer={
                    <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
                        Back to <span className="text-blue-400 font-medium">sign in</span>
                    </Link>
                }
            >
                <div className="space-y-5">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-7 h-7 text-amber-400" />
                        </div>
                        <p className="text-zinc-400 text-sm text-center leading-relaxed">{error}</p>
                    </div>
                    <Link href="/login" className="block">
                        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 btn-scale transition-all">
                            Go to Sign In
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                </div>
            </AuthCard>
        );
    }

    return (
        <AuthCard title="Confirming Email" subtitle="Hold on while we finish setting up your account">
            <div className="flex justify-center py-4">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
        </AuthCard>
    );
}
