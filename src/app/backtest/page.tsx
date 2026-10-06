'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Plus,
    Trash2,
    ChevronRight,
    ArrowLeft,
    Trophy,
    Target,
    TrendingUp,
    Activity,
    FlaskConical,
    AlertCircle,
    Loader2,
} from 'lucide-react';
import {
    BacktestSession,
    BacktestTrade,
    fetchBacktestSessions,
    createBacktestSession,
    deleteBacktestSession,
    fetchBacktestTrades,
    createBacktestTrade,
    deleteBacktestTrade,
} from '@/lib/backtestQueries';
import {
    PlaybookSetup,
    fetchPlaybookSetups
} from '@/lib/playbookQueries';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ScreenshotUploader } from '@/components/ScreenshotUploader';
import { useAccount } from '@/components/providers/AccountContext';
import { CHART } from '@/lib/chartTheme';
import { toast } from 'sonner';

// ============================================
// Session List View
// ============================================

function SessionList({
    sessions,
    onSelect,
    onCreate,
    onDelete,
    isCreating,
}: {
    sessions: BacktestSession[];
    onSelect: (s: BacktestSession) => void;
    onCreate: (name: string, description: string, balance: number) => void;
    onDelete: (id: string) => void;
    isCreating: boolean;
}) {
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [balance, setBalance] = useState('10000');

    const handleCreate = () => {
        if (!name.trim()) return;
        onCreate(name.trim(), description.trim(), parseFloat(balance) || 10000);
        setName('');
        setDescription('');
        setBalance('10000');
        setShowForm(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white">Backtest Sessions</h2>
                    <p className="text-muted-foreground text-sm">Create strategy-specific backtest sessions</p>
                </div>
                <Button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 hover:bg-blue-500 btn-scale"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    New Session
                </Button>
            </div>

            {/* Create Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="glass-card p-6 space-y-4 border-blue-500/30">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-2">Session Name *</label>
                                    <Input
                                        placeholder="e.g. NQ VWAP Bounce Strategy"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="bg-zinc-900/50 border-zinc-700"
                                    />
                                </div>
                                <div>
                                    <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-2">Initial Balance</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                        <Input
                                            type="number"
                                            value={balance}
                                            onChange={(e) => setBalance(e.target.value)}
                                            className="pl-7 bg-zinc-900/50 border-zinc-700"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-zinc-400 text-xs uppercase tracking-wider block mb-2">Description</label>
                                <Input
                                    placeholder="Strategy rules, time period, etc."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="bg-zinc-900/50 border-zinc-700"
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={handleCreate} disabled={isCreating || !name.trim()} className="bg-emerald-600 hover:bg-emerald-500">
                                    {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                                    Create Session
                                </Button>
                                <Button variant="ghost" onClick={() => setShowForm(false)} className="text-zinc-400">Cancel</Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Session Cards */}
            {sessions.length === 0 && !showForm ? (
                <div className="glass-card p-12 text-center">
                    <FlaskConical className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">No Backtest Sessions Yet</h3>
                    <p className="text-muted-foreground text-sm">Create your first session to start logging backtested trades.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {sessions.map((session, i) => (
                        <motion.div
                            key={session.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="glass-card p-5 group cursor-pointer hover:border-blue-500/30 transition-all"
                            onClick={() => onSelect(session)}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                                        {session.name}
                                    </h3>
                                    {session.description && (
                                        <p className="text-muted-foreground text-sm mt-1 line-clamp-2">{session.description}</p>
                                    )}
                                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                                        <span>Balance: ${session.initial_balance.toLocaleString()}</span>
                                        <span>{new Date(session.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ============================================
// Session Detail View (Trades + Stats + Chart)
// ============================================

function SessionDetail({
    session,
    onBack,
}: {
    session: BacktestSession;
    onBack: () => void;
}) {
    const [trades, setTrades] = useState<BacktestTrade[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);

    // Quick entry form state
    const [symbol, setSymbol] = useState('');
    const [pnl, setPnl] = useState('');
    const [rrr, setRrr] = useState('');
    const [result, setResult] = useState<'win' | 'loss' | 'breakeven'>('win');
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
    const [playbookSetups, setPlaybookSetups] = useState<PlaybookSetup[]>([]);
    const [selectedSetupId, setSelectedSetupId] = useState<string | null>(null);
    const { currentAccount } = useAccount();

    const loadTrades = useCallback(async () => {
        try {
            setIsLoading(true);
            const data = await fetchBacktestTrades(session.id);
            setTrades(data);
        } catch {
            toast.error("Couldn’t load backtest trades.");
        } finally {
            setIsLoading(false);
        }
    }, [session.id]);

    useEffect(() => {
        loadTrades();
        fetchPlaybookSetups().then(setPlaybookSetups).catch(() => toast.error("Couldn’t load your playbook setups."));
    }, [loadTrades]);

    // ---- Stats ----
    const stats = useMemo(() => {
        if (trades.length === 0) return null;
        const wins = trades.filter(t => t.result === 'win');
        const losses = trades.filter(t => t.result === 'loss');
        const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
        const winRate = (wins.length / trades.length) * 100;
        const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
        const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
        const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
        const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
        const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;

        return { totalPnl, winRate, profitFactor, expectancy, totalTrades: trades.length, wins: wins.length, losses: losses.length };
    }, [trades]);

    // ---- Equity Curve Data ----
    const equityData = useMemo(() => {
        let equity = session.initial_balance;
        return trades.map((t, i) => {
            equity += t.pnl;
            return { trade: i + 1, equity: parseFloat(equity.toFixed(2)), pnl: t.pnl };
        });
    }, [trades, session.initial_balance]);

    // ---- Add Trade ----
    const handleAddTrade = async () => {
        const pnlNum = parseFloat(pnl);
        if (isNaN(pnlNum)) return;

        try {
            setIsAdding(true);
            const newTrade = await createBacktestTrade({
                session_id: session.id,
                symbol: symbol || undefined,
                pnl: pnlNum,
                rrr: rrr ? parseFloat(rrr) : undefined,
                result,
                screenshot_url: screenshotUrl || undefined,
                playbook_setup_id: selectedSetupId || undefined,
            });
            setTrades(prev => [...prev, newTrade]);
            // Reset form
            setPnl('');
            setRrr('');
            setSymbol('');
            setScreenshotUrl(null);
        } catch {
            toast.error("Couldn’t add the trade. Try again.");
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteTrade = async (id: string) => {
        try {
            await deleteBacktestTrade(id);
            setTrades(prev => prev.filter(t => t.id !== id));
        } catch {
            toast.error("Couldn’t delete the trade. Try again.");
        }
    };

    const resultColors = {
        win: 'text-profit bg-profit/10 border-profit/30',
        loss: 'text-loss bg-loss/10 border-loss/30',
        breakeven: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" onClick={onBack} className="text-zinc-400 hover:text-white">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h2 className="text-2xl font-bold text-white">{session.name}</h2>
                    {session.description && <p className="text-muted-foreground text-sm">{session.description}</p>}
                </div>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass-card p-4 text-center">
                        <div className="flex items,center justify-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground uppercase">Total PnL</span>
                        </div>
                        <p className={`text-2xl font-black tabular-nums ${stats.totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                            ${stats.totalPnl.toLocaleString()}
                        </p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Target className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground uppercase">Win Rate</span>
                        </div>
                        <p className={`text-2xl font-black tabular-nums ${stats.winRate >= 50 ? 'text-profit' : 'text-loss'}`}>
                            {stats.winRate.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">{stats.wins}W / {stats.losses}L / {stats.totalTrades}T</p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground uppercase">Profit Factor</span>
                        </div>
                        <p className={`text-2xl font-black tabular-nums ${stats.profitFactor >= 1 ? 'text-profit' : 'text-loss'}`}>
                            {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                        </p>
                    </div>
                    <div className="glass-card p-4 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Trophy className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground uppercase">Expectancy</span>
                        </div>
                        <p className={`text-2xl font-black tabular-nums ${stats.expectancy >= 0 ? 'text-profit' : 'text-loss'}`}>
                            ${stats.expectancy.toFixed(2)}
                        </p>
                    </div>
                </div>
            )}

            {/* Equity Curve Chart */}
            {equityData.length > 1 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
                    <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Equity Curve</h3>
                    <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={equityData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                            <XAxis dataKey="trade" stroke={CHART.axisLine} tick={{ fill: CHART.axisText, fontSize: 11 }} />
                            <YAxis stroke={CHART.axisLine} tick={{ fill: CHART.axisText, fontSize: 11 }} tickFormatter={(v: number) => `$${v.toLocaleString()}`} />
                            <Tooltip
                                contentStyle={{ backgroundColor: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, borderRadius: '12px', fontSize: '12px' }}
                                labelStyle={{ color: CHART.axisText }}
                                formatter={(value: number | undefined) => [`$${(value ?? 0).toLocaleString()}`, 'Equity']}
                            />
                            <Line
                                type="monotone"
                                dataKey="equity"
                                stroke={CHART.accent}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, fill: CHART.accent }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </motion.div>
            )}

            {/* Quick Trade Entry Form */}
            <div className="glass-card p-6 border-blue-500/20">
                <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">⚡ Quick Trade Entry</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
                    <div>
                        <label className="text-muted-foreground text-xs block mb-1">Symbol</label>
                        <Input
                            placeholder="NQ"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            className="bg-zinc-900/50 border-zinc-700 h-10"
                        />
                    </div>
                    <div>
                        <label className="text-muted-foreground text-xs block mb-1">PnL ($) *</label>
                        <Input
                            type="number"
                            placeholder="150"
                            value={pnl}
                            onChange={(e) => setPnl(e.target.value)}
                            className="bg-zinc-900/50 border-zinc-700 h-10"
                        />
                    </div>
                    <div>
                        <label className="text-muted-foreground text-xs block mb-1">RRR</label>
                        <Input
                            type="number"
                            placeholder="2.5"
                            value={rrr}
                            onChange={(e) => setRrr(e.target.value)}
                            className="bg-zinc-900/50 border-zinc-700 h-10"
                            step="0.1"
                        />
                    </div>
                    <div>
                        <label className="text-muted-foreground text-xs block mb-1">Result</label>
                        <select
                            value={result}
                            onChange={(e) => setResult(e.target.value as 'win' | 'loss' | 'breakeven')}
                            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white h-10 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="win">✅ Win</option>
                            <option value="loss">❌ Loss</option>
                            <option value="breakeven">⚖️ Breakeven</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-muted-foreground text-xs block mb-1">Setup</label>
                        <select
                            value={selectedSetupId || ''}
                            onChange={(e) => setSelectedSetupId(e.target.value || null)}
                            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white h-10 focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">None</option>
                            {playbookSetups.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <Button onClick={handleAddTrade} disabled={isAdding || !pnl} className="bg-blue-600 hover:bg-blue-500 h-10">
                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                        Add
                    </Button>
                </div>

                {/* Screenshot Upload for Entry */}
                <div className="mt-4 pt-4 border-t border-zinc-800/50">
                    <ScreenshotUploader
                        userId={currentAccount?.user_id || 'anonymous'}
                        tradeId={`backtest-${Date.now()}`}
                        currentUrl={screenshotUrl}
                        onUploadComplete={(url) => setScreenshotUrl(url)}
                    />
                </div>
            </div>

            {/* Trade List */}
            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-zinc-800">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                        Trade Log ({trades.length})
                    </h3>
                </div>
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        Loading trades...
                    </div>
                ) : trades.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No trades yet. Use the form above to add entries.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-800/50 max-h-[400px] overflow-y-auto">
                        {trades.map((trade, i) => (
                            <motion.div
                                key={trade.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.02 }}
                                className="flex items-center gap-4 px-4 py-3 hover:bg-zinc-800/30 group"
                            >
                                <span className="text-xs text-muted-foreground w-8 text-center tabular-nums">#{i + 1}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${resultColors[trade.result]}`}>
                                    {trade.result}
                                </span>
                                <span className="text-sm text-white font-medium w-16">{trade.symbol || '—'}</span>
                                <span className={`text-sm font-bold tabular-nums flex-1 ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString()}
                                </span>
                                {trade.rrr && (
                                    <span className="text-xs text-muted-foreground">RRR: {trade.rrr}</span>
                                )}
                                {trade.screenshot_url && (
                                    <div className="w-8 h-8 rounded border border-zinc-700 overflow-hidden bg-zinc-900 flex-shrink-0 cursor-pointer hover:border-blue-500 transition-colors"
                                        onClick={() => window.open(trade.screenshot_url!, '_blank')}>
                                        <img src={trade.screenshot_url} alt="Trade Screenshot" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7 text-zinc-700 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDeleteTrade(trade.id)}
                                >
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ============================================
// Main Page
// ============================================

export default function BacktestPage() {
    const [sessions, setSessions] = useState<BacktestSession[]>([]);
    const [selectedSession, setSelectedSession] = useState<BacktestSession | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            setIsLoading(true);
            const data = await fetchBacktestSessions();
            setSessions(data);
        } catch {
            toast.error("Couldn’t load backtest sessions.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async (name: string, description: string, balance: number) => {
        try {
            setIsCreating(true);
            const session = await createBacktestSession({ name, description, initial_balance: balance });
            setSessions(prev => [session, ...prev]);
        } catch {
            toast.error("Couldn’t create the session. Try again.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteBacktestSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
        } catch {
            toast.error("Couldn’t delete the session. Try again.");
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto">
                {/* Page Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <FlaskConical className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Backtesting Lab</h1>
                            <p className="text-zinc-400 text-sm">Test strategies before committing real capital</p>
                        </div>
                    </div>
                </motion.div>

                {/* Content */}
                {isLoading ? (
                    <div className="glass-card p-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Loading sessions...</p>
                    </div>
                ) : selectedSession ? (
                    <SessionDetail session={selectedSession} onBack={() => setSelectedSession(null)} />
                ) : (
                    <SessionList
                        sessions={sessions}
                        onSelect={setSelectedSession}
                        onCreate={handleCreate}
                        onDelete={handleDelete}
                        isCreating={isCreating}
                    />
                )}
            </div>
        </DashboardLayout>
    );
}
