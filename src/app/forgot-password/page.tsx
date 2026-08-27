'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabase } from '@/lib/supabase';
import { AuthCard } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            // Rate limiting is worth surfacing; anything else would leak whether
            // the address is registered, so it stays behind the generic success.
            if (error && error.status === 429) throw error;
            setSent(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not send the reset email.');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <AuthCard
                title="Check Your Email"
                subtitle="If an account exists for that address, a reset link is on its way."
                footer={
                    <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
                        Back to <span className="text-blue-400 font-medium">sign in</span>
                    </Link>
                }
            >
                <div className="flex flex-col items-center gap-4 py-2">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                    </div>
                    <p className="text-zinc-400 text-sm text-center leading-relaxed">
                        The link expires in one hour and can only be used once. If it does not arrive,
                        check your spam folder and try again.
                    </p>
                </div>
            </AuthCard>
        );
    }

    return (
        <AuthCard
            title="Forgot Password"
            subtitle="Enter your email and we'll send you a link to set a new one"
            footer={
                <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">
                    Remembered it? <span className="text-blue-400 font-medium">Sign in</span>
                </Link>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider ml-1">
                        Email Address
                    </label>
                    <div className="relative group">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors" />
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-zinc-600 outline-none transition-all"
                            placeholder="name@example.com"
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
                            Send Reset Link
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                    )}
                </Button>
            </form>
        </AuthCard>
    );
}
