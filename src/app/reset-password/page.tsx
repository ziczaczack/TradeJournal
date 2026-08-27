'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabase } from '@/lib/supabase';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import {
    validateNewPassword,
    describeAuthError,
    readAuthErrorCode,
    MIN_PASSWORD_LENGTH,
} from '@/lib/authRecovery';
import { Lock, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

type Status = 'verifying' | 'ready' | 'invalid' | 'done';

/** How long to wait for the recovery session before calling the link dead. */
const SESSION_GRACE_MS = 3000;

export default function ResetPasswordPage() {
    const router = useRouter();
    const [status, setStatus] = useState<Status>('verifying');
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const supabase = getSupabase();
        let timer: ReturnType<typeof setTimeout> | undefined;
        let cancelled = false;

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || session) {
                setStatus((current) => (current === 'verifying' ? 'ready' : current));
            }
        });

        const resolveLink = async () => {
            // The client may have consumed the URL hash before this effect ran,
            // so the event above can never fire. Read the session it produced.
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (cancelled) return;

            if (session) {
                setStatus((current) => (current === 'verifying' ? 'ready' : current));
                return;
            }

            // Supabase reports a dead link as #error=...&error_code=... rather
            // than by omitting the token.
            const urlError =
                readAuthErrorCode(window.location.hash) ?? readAuthErrorCode(window.location.search);
            if (urlError) {
                setError(describeAuthError(urlError));
                setStatus('invalid');
                return;
            }

            timer = setTimeout(() => {
                setError('This reset link is invalid or has expired. Request a new one below.');
                setStatus((current) => (current === 'verifying' ? 'invalid' : current));
            }, SESSION_GRACE_MS);
        };

        resolveLink();

        return () => {
            cancelled = true;
            subscription.unsubscribe();
            if (timer) clearTimeout(timer);
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateNewPassword(password, confirmation);
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        setError(null);

        const supabase = getSupabase();
        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) {
            setError(describeAuthError(updateError.code ?? updateError.message));
            setLoading(false);
            return;
        }

        // Sign out so the new password is proven at the next sign-in.
        await supabase.auth.signOut();
        setLoading(false);
        setStatus('done');
        setTimeout(() => router.push('/login'), 2500);
    };

    if (status === 'verifying') {
        return (
            <AuthCard title="Verifying Link" subtitle="Hold on while we check your reset link">
                <div className="flex justify-center py-4">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                </div>
            </AuthCard>
        );
    }

    if (status === 'invalid') {
        return (
            <AuthCard
                title="Link Not Valid"
                subtitle="We could not verify this password reset link"
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
                    <Link href="/forgot-password" className="block">
                        <Button className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 btn-scale transition-all">
                            Request a New Link
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </Link>
                </div>
            </AuthCard>
        );
    }

    if (status === 'done') {
        return (
            <AuthCard title="Password Updated" subtitle="Taking you back to sign in">
                <div className="flex flex-col items-center gap-4 py-2">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                    </div>
                    <p className="text-zinc-400 text-sm text-center">Sign in with your new password.</p>
                </div>
            </AuthCard>
        );
    }

    return (
        <AuthCard title="Set a New Password" subtitle={`At least ${MIN_PASSWORD_LENGTH} characters`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">
                        New Password
                    </label>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">
                        Confirm Password
                    </label>
                    <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="password"
                            required
                            value={confirmation}
                            onChange={(e) => setConfirmation(e.target.value)}
                            className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 outline-none transition-all"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs"
                        >
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 btn-scale mt-2 transition-all"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            Update Password
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>
            </form>
        </AuthCard>
    );
}
