'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CustomChecklistEditor } from '@/components/checklist/CustomChecklistEditor';
import { motion } from 'framer-motion';
import { Settings2 } from 'lucide-react';

export default function ChecklistEditorPage() {
    return (
        <DashboardLayout showAIPanel={false}>
            <div className="max-w-3xl mx-auto">
                {/* Page Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <Settings2 className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">
                                Checklist Editor
                            </h1>
                            <p className="text-zinc-400 text-sm">
                                Customize your pre-trade checklist items
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Editor Component */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                >
                    <CustomChecklistEditor />
                </motion.div>
            </div>
        </DashboardLayout>
    );
}
