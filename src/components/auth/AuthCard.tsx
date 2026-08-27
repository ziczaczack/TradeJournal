'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

interface AuthCardProps {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

/**
 * Shared chrome for the standalone auth screens (forgot password, reset
 * password, email callback). Mirrors the login page's look.
 */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
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
                        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
                        <p className="text-zinc-400 text-sm">{subtitle}</p>
                    </div>

                    {children}

                    {footer && (
                        <div className="mt-8 text-center border-t border-zinc-800/50 pt-6">{footer}</div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
