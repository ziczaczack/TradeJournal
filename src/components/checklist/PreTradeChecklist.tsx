'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChecklistTemplate,
    ChecklistCategory,
    CheckedItem,
    CATEGORY_INFO,
    CATEGORY_ORDER,
    fetchChecklistTemplates,
    ensureTemplatesExist,
    createChecklistLog,
    formatChecklistForExport,
} from '@/lib/checklistQueries';
import { useAccount } from '@/components/providers/AccountContext';
import { getSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
    ChevronDown,
    ChevronRight,
    Check,
    X,
    Copy,
    CheckCircle2,
    AlertTriangle,
    Settings2,
    RefreshCw,
} from 'lucide-react';
import Link from 'next/link';

// ============================================
// Checklist Item Component
// ============================================

interface ChecklistItemProps {
    template: ChecklistTemplate;
    checked: boolean;
    onToggle: (templateId: string) => void;
}

function ChecklistItem({ template, checked, onToggle }: ChecklistItemProps) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`
                flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200
                ${checked
                    ? 'bg-emerald-500/10 border border-emerald-500/30'
                    : 'bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600'
                }
            `}
            onClick={() => onToggle(template.id)}
        >
            <div className={`
                w-5 h-5 rounded-md flex items-center justify-center transition-all
                ${checked
                    ? 'bg-emerald-500 text-white'
                    : 'bg-zinc-700 border border-zinc-600'
                }
            `}>
                {checked && <Check className="w-3 h-3" />}
            </div>
            <span className={`flex-1 text-sm ${checked ? 'text-emerald-300' : 'text-zinc-300'}`}>
                {template.item_text}
            </span>
        </motion.div>
    );
}

// ============================================
// Category Accordion Component
// ============================================

interface CategoryAccordionProps {
    category: ChecklistCategory;
    templates: ChecklistTemplate[];
    checkedStates: Record<string, boolean>;
    onToggle: (templateId: string) => void;
    isExpanded: boolean;
    onExpandToggle: () => void;
}

function CategoryAccordion({
    category,
    templates,
    checkedStates,
    onToggle,
    isExpanded,
    onExpandToggle,
}: CategoryAccordionProps) {
    const info = CATEGORY_INFO[category];
    const checkedCount = templates.filter(t => checkedStates[t.id]).length;
    const allChecked = checkedCount === templates.length && templates.length > 0;

    const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
        blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
        purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
        amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
        emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    };

    const colors = colorClasses[info.color] || colorClasses.blue;

    return (
        <div className="glass-card overflow-hidden">
            {/* Header */}
            <button
                onClick={onExpandToggle}
                className={`
                    w-full flex items-center justify-between p-4 
                    transition-colors hover:bg-zinc-800/50
                    ${isExpanded ? 'border-b border-zinc-800' : ''}
                `}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
                        <span className="text-xl">{info.icon}</span>
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-white">{info.label}</h3>
                        <p className="text-xs text-zinc-500">
                            {checkedCount} / {templates.length} completed
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {allChecked && (
                        <div className={`px-2 py-1 rounded-full ${colors.bg} ${colors.border} border`}>
                            <span className={`text-xs font-medium ${colors.text}`}>Complete</span>
                        </div>
                    )}
                    {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-zinc-400" />
                    ) : (
                        <ChevronRight className="w-5 h-5 text-zinc-400" />
                    )}
                </div>
            </button>

            {/* Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 space-y-2">
                            {templates.length === 0 ? (
                                <p className="text-sm text-zinc-500 text-center py-4">
                                    No items in this category
                                </p>
                            ) : (
                                templates.map(template => (
                                    <ChecklistItem
                                        key={template.id}
                                        template={template}
                                        checked={checkedStates[template.id] || false}
                                        onToggle={onToggle}
                                    />
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================
// Result Indicator Component
// ============================================

interface ResultIndicatorProps {
    allPassed: boolean;
    totalItems: number;
    checkedCount: number;
}

function ResultIndicator({ allPassed, totalItems, checkedCount }: ResultIndicatorProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`
                p-6 rounded-2xl text-center transition-all duration-500
                ${allPassed
                    ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border-2 border-emerald-500/50'
                    : 'bg-gradient-to-br from-rose-500/20 to-rose-600/10 border-2 border-rose-500/50'
                }
            `}
        >
            <div className="flex items-center justify-center gap-3 mb-2">
                {allPassed ? (
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                ) : (
                    <AlertTriangle className="w-10 h-10 text-rose-400" />
                )}
            </div>
            <h2 className={`text-2xl font-bold mb-1 ${allPassed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {allPassed ? 'READY TO TRADE' : 'NO TRADE'}
            </h2>
            <p className="text-sm text-zinc-400">
                {allPassed
                    ? 'All checklist items completed. You may proceed with your trade.'
                    : `${totalItems - checkedCount} item(s) remaining. Complete all items before trading.`
                }
            </p>
        </motion.div>
    );
}

// ============================================
// Main PreTradeChecklist Component
// ============================================

interface PreTradeChecklistProps {
    onComplete?: (log: { checkedItems: CheckedItem[]; allPassed: boolean }) => void;
    showEditor?: boolean;
}

export function PreTradeChecklist({ onComplete, showEditor = true }: PreTradeChecklistProps) {
    const { currentAccount, isLoading: accountLoading } = useAccount();
    const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
    const [checkedStates, setCheckedStates] = useState<Record<string, boolean>>({});
    const [expandedCategories, setExpandedCategories] = useState<Record<ChecklistCategory, boolean>>({
        session: true,
        setup: true,
        execution: true,
        emotional: true,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    // Load templates
    const loadTemplates = useCallback(async () => {
        try {
            setIsLoading(true);
            const supabase = getSupabase();
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                await ensureTemplatesExist(user.id, currentAccount?.id);
                const data = await fetchChecklistTemplates(currentAccount?.id);
                setTemplates(data);

                // Initialize all as unchecked
                const initialStates: Record<string, boolean> = {};
                data.forEach(t => { initialStates[t.id] = false; });
                setCheckedStates(initialStates);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        } finally {
            setIsLoading(false);
        }
    }, [currentAccount?.id]);

    useEffect(() => {
        if (!accountLoading) {
            loadTemplates();
        }
    }, [loadTemplates, accountLoading]);

    // Group templates by category
    const templatesByCategory = useMemo(() => {
        const grouped: Record<ChecklistCategory, ChecklistTemplate[]> = {
            session: [],
            setup: [],
            execution: [],
            emotional: [],
        };
        templates.forEach(t => {
            if (grouped[t.category]) {
                grouped[t.category].push(t);
            }
        });
        return grouped;
    }, [templates]);

    // Calculate stats
    const totalItems = templates.length;
    const checkedCount = Object.values(checkedStates).filter(Boolean).length;
    const allPassed = totalItems > 0 && checkedCount === totalItems;

    // Toggle item
    const handleToggle = (templateId: string) => {
        setCheckedStates(prev => ({
            ...prev,
            [templateId]: !prev[templateId],
        }));
    };

    // Toggle category expansion
    const toggleCategory = (category: ChecklistCategory) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category],
        }));
    };

    // Reset all
    const handleReset = () => {
        const resetStates: Record<string, boolean> = {};
        templates.forEach(t => { resetStates[t.id] = false; });
        setCheckedStates(resetStates);
    };

    // Build checked items for export/save
    const buildCheckedItems = (): CheckedItem[] => {
        return templates.map(t => ({
            template_id: t.id,
            item_text: t.item_text,
            checked: checkedStates[t.id] || false,
            category: t.category,
        }));
    };

    // Copy to clipboard
    const handleCopyToClipboard = async () => {
        const checkedItems = buildCheckedItems();
        const text = formatChecklistForExport(checkedItems);

        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    // Save log
    const handleSaveLog = async () => {
        try {
            setIsSaving(true);
            const supabase = getSupabase();
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) return;

            const checkedItems = buildCheckedItems();
            await createChecklistLog(user.id, {
                account_id: currentAccount?.id,
                checked_items: checkedItems,
                all_passed: allPassed,
            });

            onComplete?.({ checkedItems, allPassed });
        } catch (error) {
            console.error('Error saving checklist log:', error);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="glass-card p-4 animate-pulse">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800" />
                            <div className="flex-1">
                                <div className="h-4 w-24 bg-zinc-800 rounded mb-2" />
                                <div className="h-3 w-16 bg-zinc-800 rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Pre-Trade Checklist</h2>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleReset}
                        className="text-zinc-400 hover:text-white"
                    >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Reset
                    </Button>
                    {showEditor && (
                        <Link href="/checklist/editor">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-zinc-400 hover:text-white"
                            >
                                <Settings2 className="w-4 h-4 mr-1" />
                                Edit
                            </Button>
                        </Link>
                    )}
                </div>
            </div>

            {/* Category Accordions */}
            <div className="space-y-3">
                {CATEGORY_ORDER.map(category => (
                    <CategoryAccordion
                        key={category}
                        category={category}
                        templates={templatesByCategory[category]}
                        checkedStates={checkedStates}
                        onToggle={handleToggle}
                        isExpanded={expandedCategories[category]}
                        onExpandToggle={() => toggleCategory(category)}
                    />
                ))}
            </div>

            {/* Result Indicator */}
            <ResultIndicator
                allPassed={allPassed}
                totalItems={totalItems}
                checkedCount={checkedCount}
            />

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    variant="outline"
                    onClick={handleCopyToClipboard}
                    className="flex-1 border-zinc-700"
                >
                    {copied ? (
                        <>
                            <Check className="w-4 h-4 mr-2" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="w-4 h-4 mr-2" />
                            Export to Notes
                        </>
                    )}
                </Button>
                <Button
                    onClick={handleSaveLog}
                    disabled={isSaving}
                    className={allPassed
                        ? 'flex-1 bg-emerald-600 hover:bg-emerald-500'
                        : 'flex-1 bg-zinc-700 hover:bg-zinc-600'
                    }
                >
                    {isSaving ? 'Saving...' : 'Save & Continue'}
                </Button>
            </div>
        </div>
    );
}

export default PreTradeChecklist;
