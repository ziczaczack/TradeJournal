'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FileUploader } from '@/components/FileUploader';
import { Button } from '@/components/ui/button';
import { ArrowRight, RefreshCcw, Shield, BookOpen, LogIn } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

      {/* File Uploader or Auth Prompt */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {loading ? (
          <div className="glass-card p-12 text-center">
            <div className="animate-pulse text-zinc-400">Checking session...</div>
          </div>
        ) : user ? (
          <FileUploader
            userId={user.id}
            onUploadComplete={(result) => {
              console.log('Upload complete:', result);
            }}
          />
        ) : (
          <div className="glass-card p-12 text-center space-y-8 relative overflow-hidden group">
            {/* Animated background decoration */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl group-hover:bg-blue-600/20 transition-colors duration-500" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl group-hover:bg-purple-600/20 transition-colors duration-500" />

            <div className="relative z-10">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-zinc-800/50 flex items-center justify-center mb-6 border border-zinc-700/50 shadow-xl group-hover:scale-110 transition-transform duration-500">
                <LogIn className="w-10 h-10 text-blue-400" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="text-2xl font-bold text-white mb-3">Begin Your Journey</h3>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                  Join a community of disciplined traders. Sign in to securely upload, track, and analyze your performance.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-8 h-12 rounded-xl shadow-lg shadow-blue-600/20 btn-scale group">
                      Sign In Now
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link href="/login" className="w-full sm:w-auto">
                    <Button variant="outline" className="w-full sm:w-auto border-zinc-700 hover:bg-zinc-800/50 text-zinc-300 px-8 h-12 rounded-xl">
                      Create Free Account
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
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
            <BookOpen className="w-6 h-6 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            Daily Journaling
          </h3>
          <p className="text-zinc-400 text-sm">
            Write up each trade and each trading day to review your decisions.
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
        <p className="text-muted-foreground mb-4">Already have trades imported?</p>
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
