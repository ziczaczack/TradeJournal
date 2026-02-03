'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
    Upload,
    History,
    Calendar,
    BarChart3,
    Bot,
    TrendingUp
} from 'lucide-react';

interface DashboardLayoutProps {
    children: ReactNode;
    showAIPanel?: boolean;
}

const navItems = [
    { href: '/', label: 'Import', icon: Upload },
    { href: '/history', label: 'History', icon: History },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function DashboardLayout({ children, showAIPanel = true }: DashboardLayoutProps) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-zinc-950">
            {/* Fixed Glass Header */}
            <header className="glass-header fixed top-0 left-0 right-0 z-50">
                <div className="max-w-[1600px] mx-auto px-6 py-3">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-3 group">
                            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                                <TrendingUp className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-white tracking-tight">
                                    Trading Journal
                                </h1>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                    Pro Terminal
                                </p>
                            </div>
                        </Link>

                        {/* Navigation */}
                        <nav className="flex items-center gap-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href;
                                const Icon = item.icon;

                                return (
                                    <Link key={item.href} href={item.href}>
                                        <Button
                                            variant="ghost"
                                            className={`
                                                relative px-4 py-2 gap-2 btn-scale
                                                ${isActive
                                                    ? 'text-white bg-zinc-800/80'
                                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                                }
                                            `}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="hidden sm:inline">{item.label}</span>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="nav-indicator"
                                                    className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full"
                                                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                                />
                                            )}
                                        </Button>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="pt-16 min-h-screen">
                <div className={`max-w-[1600px] mx-auto ${showAIPanel ? 'lg:pr-80' : ''}`}>
                    {/* Page Content with Fade Animation */}
                    <AnimatePresence mode="wait">
                        <motion.main
                            key={pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="px-6 py-8"
                        >
                            {children}
                        </motion.main>
                    </AnimatePresence>
                </div>

                {/* AI Mentor Floating Panel */}
                {showAIPanel && (
                    <aside className="hidden lg:block fixed top-20 right-4 bottom-4 w-72">
                        <div className="glass-card h-full p-4 flex flex-col">
                            {/* Panel Header */}
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-zinc-800">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center animate-pulse-glow">
                                    <Bot className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-white">AI Mentor</h3>
                                    <p className="text-[10px] text-zinc-500">Always analyzing</p>
                                </div>
                            </div>

                            {/* Panel Content Placeholder */}
                            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                                <div className="w-12 h-12 rounded-full bg-zinc-800/50 flex items-center justify-center mb-4">
                                    <Bot className="w-6 h-6 text-zinc-500" />
                                </div>
                                <p className="text-sm text-zinc-400 mb-2">
                                    Your AI Trading Coach
                                </p>
                                <p className="text-xs text-zinc-500">
                                    Import trades to get personalized insights and improvement tips.
                                </p>
                            </div>

                            {/* Panel Footer */}
                            <div className="pt-4 border-t border-zinc-800">
                                <Button
                                    variant="outline"
                                    className="w-full btn-scale bg-zinc-800/50 border-zinc-700 hover:bg-zinc-700/50 text-zinc-300"
                                >
                                    <Bot className="w-4 h-4 mr-2" />
                                    Ask AI Mentor
                                </Button>
                            </div>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}

export default DashboardLayout;
