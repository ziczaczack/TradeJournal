'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Plus,
    BookOpen,
    Trash2,
    Calendar,
    Target,
    ListChecks,
    Image as ImageIcon,
    ChevronRight,
    X,
    MessageSquare,
    Loader2,
    Share2,
} from 'lucide-react';
import { ShareDialog } from '@/components/share/ShareDialog';
import { useTradesForCurrentAccount } from '@/hooks/useTrades';
import {
    PlaybookSetup,
    fetchPlaybookSetups,
    createPlaybookSetup,
    updatePlaybookSetup,
    deletePlaybookSetup,
} from '@/lib/playbookQueries';
import { ScreenshotUploader } from '@/components/ScreenshotUploader';
import { useAccount } from '@/components/providers/AccountContext';

export default function PlaybookPage() {
    const { currentAccount } = useAccount();
    const [setups, setSetups] = useState<PlaybookSetup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [selectedSetup, setSelectedSetup] = useState<PlaybookSetup | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [shareSetup, setShareSetup] = useState<PlaybookSetup | null>(null);
    const { data: accountTrades = [] } = useTradesForCurrentAccount();

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [timeframe, setTimeframe] = useState('');
    const [winRateTarget, setWinRateTarget] = useState('50');
    const [rules, setRules] = useState<string[]>(['']);
    const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

    useEffect(() => {
        loadSetups();
    }, []);

    const loadSetups = async () => {
        try {
            setIsLoading(true);
            const data = await fetchPlaybookSetups();
            setSetups(data);
        } catch (err) {
            console.error('Failed to load setups:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddRule = () => setRules([...rules, '']);
    const handleRemoveRule = (index: number) => setRules(rules.filter((_, i) => i !== index));
    const handleRuleChange = (index: number, value: string) => {
        const newRules = [...rules];
        newRules[index] = value;
        setRules(newRules);
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        if (!currentAccount?.user_id) {
            console.error('No active session or account available.');
            return;
        }

        const setupData = {
            name: name.trim(),
            description: description.trim() || undefined,
            timeframe: timeframe.trim() || undefined,
            win_rate_target: parseFloat(winRateTarget) || 50,
            rules: rules.filter(r => r.trim() !== ''),
            screenshot_url: screenshotUrl || undefined
        };

        try {
            setIsCreating(true);
            if (selectedSetup) {
                const updated = await updatePlaybookSetup(selectedSetup.id, setupData);
                setSetups(setups.map(s => s.id === updated.id ? updated : s));
            } else {
                const created = await createPlaybookSetup(setupData);
                setSetups([created, ...setups]);
            }
            resetForm();
        } catch (err) {
            console.error('Failed to save setup:', err);
        } finally {
            setIsCreating(false);
        }
    };

    const resetForm = () => {
        setName('');
        setDescription('');
        setTimeframe('');
        setWinRateTarget('50');
        setRules(['']);
        setScreenshotUrl(null);
        setSelectedSetup(null);
        setShowForm(false);
    };

    const handleEdit = (setup: PlaybookSetup) => {
        setSelectedSetup(setup);
        setName(setup.name);
        setDescription(setup.description || '');
        setTimeframe(setup.timeframe || '');
        setWinRateTarget(setup.win_rate_target.toString());
        setRules(setup.rules.length > 0 ? setup.rules : ['']);
        setScreenshotUrl(setup.screenshot_url);
        setShowForm(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this setup?')) return;
        try {
            await deletePlaybookSetup(id);
            setSetups(setups.filter(s => s.id !== id));
        } catch (err) {
            console.error('Failed to delete setup:', err);
        }
    };

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">The Playbook</h1>
                        </div>
                        <p className="text-zinc-400">Master your trading models and institutional edge</p>
                    </div>
                    {!showForm && (
                        <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-500 btn-scale">
                            <Plus className="w-4 h-4 mr-2" />
                            Define New Setup
                        </Button>
                    )}
                </div>

                {showForm ? (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 border-emerald-500/20 max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-8 border-b border-zinc-800 pb-4">
                            <h2 className="text-xl font-bold text-white">{selectedSetup ? 'Edit Setup Model' : 'Define New Setup Model'}</h2>
                            <Button variant="ghost" size="icon" onClick={resetForm} className="text-zinc-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Column: Basic Info */}
                            <div className="space-y-6">
                                <div>
                                    <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">Setup Name *</label>
                                    <Input
                                        placeholder="e.g. Silver Bullet / Unicorn"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="bg-zinc-900/50 border-zinc-700"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">Timeframe</label>
                                        <Input
                                            placeholder="5m / 1h / Daily"
                                            value={timeframe}
                                            onChange={(e) => setTimeframe(e.target.value)}
                                            className="bg-zinc-900/50 border-zinc-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">Target WR%</label>
                                        <Input
                                            type="number"
                                            placeholder="65"
                                            value={winRateTarget}
                                            onChange={(e) => setWinRateTarget(e.target.value)}
                                            className="bg-zinc-900/50 border-zinc-700"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">Description</label>
                                    <Textarea
                                        placeholder="General context, psychological notes, etc."
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="bg-zinc-900/50 border-zinc-700 min-h-[100px]"
                                    />
                                </div>

                                <div className="pt-4">
                                    <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2 flex items-center gap-2">
                                        <ImageIcon className="w-3 h-3" />
                                        Example Screenshot (Perfect Model)
                                    </label>
                                    <ScreenshotUploader
                                        userId={currentAccount?.user_id || 'anonymous'}
                                        tradeId={`playbook-${Date.now()}`}
                                        currentUrl={screenshotUrl}
                                        onUploadComplete={setScreenshotUrl}
                                    />
                                </div>
                            </div>

                            {/* Right Column: Rules */}
                            <div className="space-y-6 p-6 bg-zinc-900/30 rounded-2xl border border-zinc-800/50">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-zinc-500 text-xs uppercase tracking-wider flex items-center gap-2">
                                        <ListChecks className="w-4 h-4 text-emerald-400" />
                                        Confluence Rules
                                    </label>
                                    <Button variant="ghost" size="sm" onClick={handleAddRule} className="text-[10px] h-6 text-emerald-500">
                                        <Plus className="w-3 h-3 mr-1" /> Add Rule
                                    </Button>
                                </div>
                                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                    {rules.map((rule, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <Input
                                                placeholder={`Rule #${idx + 1}`}
                                                value={rule}
                                                onChange={(e) => handleRuleChange(idx, e.target.value)}
                                                className="bg-zinc-900/80 border-zinc-700 text-sm"
                                            />
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveRule(idx)} className="h-10 w-10 text-zinc-600 hover:text-rose-400">
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 mt-10 pt-6 border-t border-zinc-800">
                            <Button onClick={handleSave} disabled={isCreating || !name.trim()} className="bg-emerald-600 hover:bg-emerald-500 px-8">
                                {isCreating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ListChecks className="w-4 h-4 mr-2" />}
                                {selectedSetup ? 'Update Model' : 'Save To Playbook'}
                            </Button>
                            <Button variant="ghost" onClick={resetForm} className="text-zinc-400">Cancel</Button>
                        </div>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {isLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="glass-card h-64 animate-pulse bg-zinc-900/50" />
                            ))
                        ) : setups.length === 0 ? (
                            <div className="col-span-full py-20 text-center glass-card">
                                <BookOpen className="w-16 h-16 mx-auto text-zinc-700 mb-4 opacity-20" />
                                <h3 className="text-xl font-medium text-white mb-2">Your Playbook is empty</h3>
                                <p className="text-zinc-500 mb-6">Start building your edge by defining your first trading setup.</p>
                                <Button onClick={() => setShowForm(true)} className="bg-emerald-600 hover:bg-emerald-500">
                                    Create My First Setup
                                </Button>
                            </div>
                        ) : (
                            setups.map((setup, i) => (
                                <motion.div
                                    key={setup.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="glass-card group hover:border-emerald-500/30 transition-all flex flex-col"
                                >
                                    <div className="relative aspect-video bg-zinc-900 overflow-hidden cursor-pointer" onClick={() => handleEdit(setup)}>
                                        {setup.screenshot_url ? (
                                            <img src={setup.screenshot_url} alt={setup.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <ImageIcon className="w-10 h-10 text-zinc-700 opacity-20" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                        <div className="absolute bottom-3 left-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Calendar className="w-3 h-3 text-emerald-400" />
                                                <span className="text-[10px] text-zinc-300 font-mono">{setup.timeframe || 'Any TF'}</span>
                                            </div>
                                            <h3 className="text-white font-bold tracking-wide">{setup.name}</h3>
                                        </div>
                                    </div>

                                    <div className="p-5 flex-1 flex flex-col">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <Target className="w-4 h-4 text-emerald-500" />
                                                <span className="text-xs text-zinc-400">Target WR: <span className="text-white font-bold">{setup.win_rate_target}%</span></span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setShareSetup(setup)}
                                                    className="w-8 h-8 text-zinc-500 hover:text-white"
                                                    aria-label="Share setup"
                                                >
                                                    <Share2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(setup)}
                                                    className="w-8 h-8 text-zinc-500 hover:text-white"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(setup.id)}
                                                    className="w-8 h-8 text-zinc-500 hover:text-rose-400"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        {setup.description && (
                                            <p className="text-xs text-zinc-500 line-clamp-2 mb-4 italic">"{setup.description}"</p>
                                        )}
                                        <div className="mt-auto space-y-1.5">
                                            {setup.rules.slice(0, 3).map((rule, idx) => (
                                                <div key={idx} className="flex items-center gap-2 text-[10px] text-zinc-400">
                                                    <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                    <span className="truncate">{rule}</span>
                                                </div>
                                            ))}
                                            {setup.rules.length > 3 && (
                                                <p className="text-[9px] text-zinc-600 pl-3">+{setup.rules.length - 3} more rules</p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                )}
            </div>
            {shareSetup && (
                <ShareDialog
                    open
                    onOpenChange={(open) => !open && setShareSetup(null)}
                    source={{ kind: 'playbook', setup: shareSetup, trades: accountTrades }}
                />
            )}
        </DashboardLayout>
    );
}
