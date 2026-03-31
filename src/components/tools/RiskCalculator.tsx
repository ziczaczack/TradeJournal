'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAccount } from '@/components/providers/AccountContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Calculator,
    ShieldCheck,
    AlertCircle,
    Trophy,
    Info
} from 'lucide-react';

interface AssetConfig {
    name: string;
    multiplier: number; // Tick value or point value
    isContracts: boolean;
}

const ASSET_PRESETS: Record<string, AssetConfig> = {
    'NQ (Nasdaq)': { name: 'NQ', multiplier: 20, isContracts: true },
    'MNQ (Micro Nasdaq)': { name: 'MNQ', multiplier: 2, isContracts: true },
    'ES (S&P 500)': { name: 'ES', multiplier: 50, isContracts: true },
    'MES (Micro S&P)': { name: 'MES', multiplier: 5, isContracts: true },
    'GC (Gold)': { name: 'GC', multiplier: 100, isContracts: true },
    'CL (Crude Oil)': { name: 'CL', multiplier: 1000, isContracts: true },
    'Stocks/Crypto': { name: 'Shares', multiplier: 1, isContracts: false },
};

export function RiskCalculator({ isCompact = false }: { isCompact?: boolean }) {
    const { currentAccount } = useAccount();

    // State
    const [balance, setBalance] = useState<number>(currentAccount?.initial_balance || 50000);
    const [riskPercent, setRiskPercent] = useState<number>(1);
    const [entryPrice, setEntryPrice] = useState<string>('');
    const [stopLoss, setStopLoss] = useState<string>('');
    const [assetType, setAssetType] = useState<string>('NQ (Nasdaq)');

    // Auto-update balance if account changes
    useEffect(() => {
        if (currentAccount?.initial_balance) {
            setBalance(currentAccount.initial_balance);
        }
    }, [currentAccount]);

    // Calculations
    const calculations = useMemo(() => {
        const entry = parseFloat(entryPrice);
        const sl = parseFloat(stopLoss);
        const config = ASSET_PRESETS[assetType];

        if (!entry || !sl || entry === sl) return null;

        const riskAmount = (balance * (riskPercent / 100));
        const distance = Math.abs(entry - sl);

        // For futures: Distance * Multiplier = Risk per contract
        // For stocks: Distance * 1 = Risk per share
        const riskPerUnit = distance * config.multiplier;
        const positionSize = Math.floor(riskAmount / riskPerUnit);
        const actualRisk = positionSize * riskPerUnit;

        return {
            riskAmount,
            distance,
            positionSize,
            actualRisk,
            riskPerUnit,
            isLong: entry > sl
        };
    }, [balance, riskPercent, entryPrice, stopLoss, assetType]);

    const riskSeverity = riskPercent > 3 ? 'high' : riskPercent > 1.5 ? 'medium' : 'low';
    const severityColor = {
        high: 'text-rose-400 border-rose-500/50 bg-rose-500/10',
        medium: 'text-amber-400 border-amber-500/50 bg-amber-500/10',
        low: 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10'
    }[riskSeverity];

    return (
        <div className={`glass-card p-6 ${isCompact ? 'max-w-md' : 'w-full'}`}>
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Calculator className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                    <h3 className="text-xl font-bold text-white tracking-tight">Risk Calculator</h3>
                    <p className="text-sm text-zinc-500">Calculate position size before entry</p>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Left Side: Inputs */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-zinc-400 text-xs uppercase tracking-wider block">Account Balance</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                            <Input
                                type="number"
                                value={balance}
                                onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
                                className="pl-7 bg-zinc-900/50 border-zinc-700"
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-zinc-400 text-xs uppercase tracking-wider block">Risk Amount</label>
                            <span className={`text-sm font-bold ${severityColor.split(' ')[0]}`}>
                                {riskPercent}% (${(balance * (riskPercent / 100)).toLocaleString()})
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0.1"
                            max="5"
                            step="0.1"
                            value={riskPercent}
                            onChange={(e) => setRiskPercent(parseFloat(e.target.value))}
                            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-zinc-400 text-xs uppercase tracking-wider block">Entry Price</label>
                            <Input
                                placeholder="0.00"
                                value={entryPrice}
                                onChange={(e) => setEntryPrice(e.target.value)}
                                className="bg-zinc-900/50 border-zinc-700 focus:border-blue-500/50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-zinc-400 text-xs uppercase tracking-wider block">Stop Loss</label>
                            <Input
                                placeholder="0.00"
                                value={stopLoss}
                                onChange={(e) => setStopLoss(e.target.value)}
                                className="bg-zinc-900/50 border-zinc-700 focus:border-rose-500/50"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-zinc-400 text-xs uppercase tracking-wider block">Asset / Instrument</label>
                        <select
                            value={assetType}
                            onChange={(e) => setAssetType(e.target.value)}
                            className="w-full bg-zinc-900/50 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            {Object.keys(ASSET_PRESETS).map(key => (
                                <option key={key} value={key}>{key}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Right Side: Results */}
                <div className="flex flex-col gap-4">
                    <div className={`flex-1 rounded-2xl border p-6 flex flex-col justify-center items-center relative overflow-hidden ${calculations ? severityColor : 'bg-zinc-800/20 border-zinc-800 text-zinc-600'}`}>
                        {calculations ? (
                            <>
                                <motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    className="text-center z-10"
                                >
                                    <span className="text-xs uppercase tracking-[0.2em] opacity-70 mb-2 block font-medium">Position Size</span>
                                    <div className="text-5xl font-black mb-2 tabular-nums">
                                        {calculations.positionSize}
                                    </div>
                                    <span className="text-sm font-semibold opacity-80 uppercase text-center block">
                                        {ASSET_PRESETS[assetType].isContracts ? 'Contracts' : 'Shares'}
                                    </span>
                                </motion.div>

                                {/* Background Decoration */}
                                <div className="absolute -bottom-8 -right-8 opacity-10">
                                    <ShieldCheck className="w-32 h-32" />
                                </div>
                            </>
                        ) : (
                            <div className="text-center space-y-3">
                                <Info className="w-10 h-10 mx-auto opacity-20" />
                                <p className="text-sm">Enter Entry and Stop Loss to calculate</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="glass-card p-4 border-zinc-800 text-center">
                            <p className="text-[10px] text-zinc-500 uppercase mb-1">Total Risk</p>
                            <p className="text-lg font-bold text-white tabular-nums">
                                ${calculations ? calculations.actualRisk.toLocaleString() : '0'}
                            </p>
                        </div>
                        <div className="glass-card p-4 border-zinc-800 text-center">
                            <p className="text-[10px] text-zinc-500 uppercase mb-1">Stop Distance</p>
                            <p className="text-lg font-bold text-white tabular-nums">
                                {calculations ? calculations.distance.toFixed(2) : '0'}
                            </p>
                        </div>
                    </div>

                    {calculations && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                            {calculations.isLong ? (
                                <Trophy className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <AlertCircle className="w-4 h-4 text-rose-400" />
                            )}
                            <p className="text-xs text-zinc-300">
                                {calculations.isLong
                                    ? `Long position detected. Good luck!`
                                    : `Short position detected. Stick to the plan.`}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
