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
    TrendingUp,
    LogOut,
    UserCircle,
    FlaskConical,
    BookOpen,
    NotebookPen,
    Menu
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { ClipboardCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface DashboardLayoutProps {
    children: ReactNode;
}

const navItems = [
    { href: '/', label: 'Import', icon: Upload },
    { href: '/checklist', label: 'Checklist', icon: ClipboardCheck },
    { href: '/history', label: 'History', icon: History },
    { href: '/journal', label: 'Journal', icon: NotebookPen },
    { href: '/calendar', label: 'Calendar', icon: Calendar },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/backtest', label: 'Backtest', icon: FlaskConical },
    { href: '/playbook', label: 'Playbook', icon: BookOpen },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);

    const supabase = getSupabase();

    useEffect(() => {
        // Initial user check
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        // Drop every cached query (trades, mistake tags, ...) so the next user
        // signing in on this tab never sees this user's data.
        queryClient.clear();
        router.push('/login');
    };

    return (
        <div className="min-h-screen bg-zinc-950">
            {/* Fixed Glass Header */}
            <header className="glass-header fixed top-0 left-0 right-0 z-50">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            {/* Menu drawer: the full nav only fits from xl up */}
                            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                                <SheetTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="xl:hidden text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                                        aria-label="Open menu"
                                    >
                                        <Menu className="w-5 h-5" />
                                    </Button>
                                </SheetTrigger>
                                <SheetContent
                                    side="left"
                                    className="bg-zinc-950 border-zinc-800 w-72"
                                    aria-describedby={undefined}
                                >
                                    <SheetHeader className="pb-0">
                                        <SheetTitle className="text-white">Menu</SheetTitle>
                                    </SheetHeader>
                                    {user && (
                                        <div className="px-4 sm:hidden">
                                            <AccountSwitcher />
                                        </div>
                                    )}
                                    <nav className="flex flex-col gap-1 px-2">
                                        {navItems.map((item) => {
                                            const isActive = pathname === item.href;
                                            const Icon = item.icon;

                                            return (
                                                <Button
                                                    key={item.href}
                                                    asChild
                                                    variant="ghost"
                                                    className={`justify-start gap-3 h-11 px-3 ${isActive
                                                        ? 'text-white bg-zinc-800/80'
                                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                                    }`}
                                                >
                                                    <Link
                                                        href={item.href}
                                                        aria-current={isActive ? 'page' : undefined}
                                                        onClick={() => setMenuOpen(false)}
                                                    >
                                                        <Icon className="w-4 h-4" />
                                                        {item.label}
                                                    </Link>
                                                </Button>
                                            );
                                        })}
                                    </nav>
                                </SheetContent>
                            </Sheet>

                            {/* Logo */}
                            <Link href="/" className="flex items-center gap-3 group min-w-0">
                                <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                                    <TrendingUp className="w-5 h-5 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-lg font-bold text-white tracking-tight truncate">
                                        Trading Journal
                                    </h1>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                        Pro Terminal
                                    </p>
                                </div>
                            </Link>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                            {/* Inline navigation */}
                            <nav className="hidden xl:flex items-center gap-1">
                                {navItems.map((item) => {
                                    const isActive = pathname === item.href;
                                    const Icon = item.icon;

                                    return (
                                        <Button
                                            key={item.href}
                                            asChild
                                            variant="ghost"
                                            className={`
                                                relative px-3 py-2 gap-2 btn-scale
                                                ${isActive
                                                    ? 'text-white bg-zinc-800/80'
                                                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                                                }
                                            `}
                                        >
                                            <Link href={item.href} aria-current={isActive ? 'page' : undefined}>
                                                <Icon className="w-4 h-4" />
                                                <span>{item.label}</span>
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="nav-indicator"
                                                        className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-500 rounded-full"
                                                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                                    />
                                                )}
                                            </Link>
                                        </Button>
                                    );
                                })}
                            </nav>

                            <div className="h-6 w-px bg-zinc-800 hidden xl:block mx-1" />

                            {/* Account Switcher (moves into the menu drawer on phones) */}
                            {user && (
                                <>
                                    <div className="hidden sm:block">
                                        <AccountSwitcher />
                                    </div>
                                    <div className="h-6 w-px bg-zinc-800 hidden sm:block mx-1" />
                                </>
                            )}

                            {/* User Profile / Auth Toggle */}
                            <div className="flex items-center gap-2">
                                {loading ? (
                                    <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
                                ) : user ? (
                                    <div className="flex items-center gap-3">
                                        <div className="flex-col items-end hidden 2xl:flex">
                                            <span className="text-xs font-medium text-white truncate max-w-[150px]">
                                                {user.email?.split('@')[0]}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                Standard Account
                                            </span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="rounded-full bg-zinc-800/50 text-zinc-400 hover:text-white btn-scale"
                                            onClick={handleSignOut}
                                            title="Sign Out"
                                            aria-label="Sign out"
                                        >
                                            <LogOut className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        asChild
                                        variant="ghost"
                                        size="sm"
                                        className="text-zinc-400 hover:text-white gap-2 btn-scale"
                                    >
                                        <Link href="/login">
                                            <UserCircle className="w-4 h-4" />
                                            <span>Sign In</span>
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="pt-16 min-h-screen">
                <div className="max-w-[1600px] mx-auto">
                    {/* Page Content with Fade Animation */}
                    <AnimatePresence mode="wait">
                        <motion.main
                            key={pathname}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="px-4 sm:px-6 py-8"
                        >
                            {children}
                        </motion.main>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

export default DashboardLayout;
