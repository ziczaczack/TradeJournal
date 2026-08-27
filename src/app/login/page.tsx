'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getSupabase } from '@/lib/supabase';
import { validatePassword, MIN_PASSWORD_LENGTH } from '@/lib/authRecovery';
import { Button } from '@/components/ui/button';
import { Mail, Lock, ArrowRight, Loader2, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const supabase = getSupabase();

    useEffect(() => {
        // Redirect if already logged in
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) router.push('/');
        });
    }, [router, supabase]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                router.push('/');
            } else {
                const validationError = validatePassword(password);
                if (validationError) {
                    setError(validationError);
                    return;
                }
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth/callback`,
                    },
                });
                if (error) throw error;
                setMessage('Check your email for the confirmation link!');
            }
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'An error occurred during authentication'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute top-0 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-0 -right-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="glass-card p-8 md:p-10">
                    {/* Logo & Header */}
                    <div className="text-center mb-10">
                        <Link href="/" className="inline-flex items-center gap-3 mb-6 group">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-300 transform group-hover:scale-110">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <div className="text-left">
                                <h1 className="text-xl font-bold text-white tracking-tight">Trading Journal</h1>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Pro Terminal</p>
                            </div>
                        </Link>
                        <h2 className="text-2xl font-bold text-white mb-2">
                            {isLogin ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-zinc-400 text-sm">
                            {isLogin
                                ? 'Sign in to access your trading insights'
                                : 'Join elite traders and master your patterns'}
                        </p>
                    </div>

                    <form onSubmit={handleAuth} className="space-y-4">
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

                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                    Password
                                </label>
                                {isLogin && (
                                    <Link
                                        href="/forgot-password"
                                        className="text-xs text-zinc-500 hover:text-blue-400 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                )}
                            </div>
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
                            {!isLogin && (
                                <p className="text-[11px] text-zinc-500 ml-1">
                                    At least {MIN_PASSWORD_LENGTH} characters.
                                </p>
                            )}
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
                            {message && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-emerald-400 text-xs"
                                >
                                    {message}
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
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 text-center border-t border-zinc-800/50 pt-6">
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError(null);
                                setMessage(null);
                            }}
                            className="text-sm text-zinc-400 hover:text-white transition-colors"
                        >
                            {isLogin ? (
                                <>
                                    Don&apos;t have an account? <span className="text-blue-400 font-medium">Sign up</span>
                                </>
                            ) : (
                                <>
                                    Already have an account? <span className="text-blue-400 font-medium">Log in</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <p className="text-center mt-8 text-zinc-500 text-xs">
                    By continuing, you agree to our Terms of Service and Privacy Policy.
                </p>
            </motion.div>
        </div>
    );
}
