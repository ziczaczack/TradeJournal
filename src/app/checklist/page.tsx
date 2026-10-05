'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PreTradeChecklist } from '@/components/checklist/PreTradeChecklist';
import { RiskCalculator } from '@/components/tools/RiskCalculator';
import { motion } from 'framer-motion';
import { ClipboardCheck } from 'lucide-react';

export default function ChecklistPage() {
    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto px-4">
                {/* Page Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <ClipboardCheck className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">
                                Pre-Trade Planning
                            </h1>
                            <p className="text-zinc-400 text-sm">
                                Calculate your risk and verify your setup before entry
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Content Grid */}
                <div className="grid lg:grid-cols-2 gap-8 items-start">
                    {/* Checklist Component */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-6"
                    >
                        <PreTradeChecklist />
                    </motion.div>

                    {/* Risk Calculator Sidebar */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="lg:sticky lg:top-24"
                    >
                        <RiskCalculator isCompact />
                        <div className="mt-4 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 text-muted-foreground text-xs italic">
                            Tip: Professional traders rarely risk more than 1-2% of their total equity on a single trade.
                        </div>
                    </motion.div>
                </div>
            </div>
        </DashboardLayout>
    );
}
