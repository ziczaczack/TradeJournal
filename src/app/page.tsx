'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FileUploader } from '@/components/FileUploader';
import { Button } from '@/components/ui/button';
import { ArrowRight, RefreshCcw, Shield, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <DashboardLayout>
      {/* Hero Section */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
            Import Your Trades
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Upload your Tradovate Performance Report CSV to automatically import and track your trades.
            Duplicate trades are automatically detected and skipped.
          </p>
        </motion.div>
      </div>

      {/* File Uploader */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <FileUploader
          onUploadComplete={(result) => {
            console.log('Upload complete:', result);
          }}
        />
      </motion.div>

      {/* Features Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-16 grid md:grid-cols-3 gap-6"
      >
        <div className="glass-card p-6 hover-lift">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
            <RefreshCcw className="w-6 h-6 text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Automatic Parsing
          </h3>
          <p className="text-zinc-400 text-sm">
            Parses Tradovate CSV format and extracts symbol, PnL, prices, and timestamps.
          </p>
        </div>

        <div className="glass-card p-6 hover-lift">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Duplicate Protection
          </h3>
          <p className="text-zinc-400 text-sm">
            Each trade gets a unique ID to prevent duplicate imports.
          </p>
        </div>

        <div className="glass-card p-6 hover-lift">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
            <Sparkles className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            AI-Powered Insights
          </h3>
          <p className="text-zinc-400 text-sm">
            Get personalized coaching from your AI Trading Mentor based on your patterns.
          </p>
        </div>
      </motion.div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-16 text-center"
      >
        <p className="text-zinc-500 mb-4">Already have trades imported?</p>
        <Link href="/history">
          <Button className="bg-blue-600 hover:bg-blue-700 btn-scale">
            View Trade History
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </motion.div>
    </DashboardLayout>
  );
}
