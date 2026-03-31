'use client';

import { PlaybookComparison, formatPercent } from '@/lib/analyticsStats';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Legend,
    Cell,
} from 'recharts';

interface PlaybookComparisonChartProps {
    data: PlaybookComparison[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const target = payload.find((p: any) => p.dataKey === 'targetWinRate')?.value ?? 0;
    const actual = payload.find((p: any) => p.dataKey === 'actualWinRate')?.value ?? 0;
    const trades = payload[0]?.payload?.tradeCount ?? 0;
    const delta = actual - target;

    return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-2xl text-xs">
            <div className="font-bold text-white mb-2">{label}</div>
            <div className="space-y-1.5">
                <div className="flex justify-between gap-6">
                    <span className="text-blue-400">Target WR</span>
                    <span className="text-white font-medium">{formatPercent(target)}</span>
                </div>
                <div className="flex justify-between gap-6">
                    <span className="text-emerald-400">Actual WR</span>
                    <span className="text-white font-medium">{formatPercent(actual)}</span>
                </div>
                <div className="flex justify-between gap-6 pt-1 border-t border-zinc-700">
                    <span className="text-zinc-400">Delta</span>
                    <span className={delta >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {delta >= 0 ? '+' : ''}{formatPercent(delta)}
                    </span>
                </div>
                <div className="flex justify-between gap-6">
                    <span className="text-zinc-500">Trades</span>
                    <span className="text-zinc-300">{trades}</span>
                </div>
            </div>
        </div>
    );
};

export function PlaybookComparisonChart({ data }: PlaybookComparisonChartProps) {
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 text-zinc-500 text-sm text-center px-8">
                No Playbook setups found, or no live trades match your setup names yet.
                <br />
                <span className="text-zinc-600 text-xs mt-1 block">
                    Define setups in The Playbook, then tag your trades with matching setup types.
                </span>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height={Math.max(200, data.length * 60)}>
            <BarChart
                layout="vertical"
                data={data}
                margin={{ top: 5, right: 40, left: 20, bottom: 5 }}
                barCategoryGap="25%"
                barGap={4}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" horizontal={false} />
                <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke="#52525B"
                    tick={{ fill: '#71717A', fontSize: 11 }}
                />
                <YAxis
                    type="category"
                    dataKey="setupName"
                    width={110}
                    stroke="#52525B"
                    tick={{ fill: '#A1A1AA', fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                    formatter={(value) =>
                        value === 'targetWinRate' ? (
                            <span className="text-xs text-blue-400">Target WR</span>
                        ) : (
                            <span className="text-xs text-emerald-400">Actual WR</span>
                        )
                    }
                />
                <ReferenceLine x={50} stroke="#52525B" strokeDasharray="4 4" label={{ value: '50%', fill: '#52525B', fontSize: 10 }} />

                {/* Target WR bar (semi-transparent blue) */}
                <Bar dataKey="targetWinRate" name="targetWinRate" fill="rgba(59,130,246,0.3)" radius={[0, 3, 3, 0]}>
                    {data.map((entry, i) => (
                        <Cell key={i} fill="rgba(59,130,246,0.3)" />
                    ))}
                </Bar>

                {/* Actual WR bar (solid, green/red based on vs target) */}
                <Bar dataKey="actualWinRate" name="actualWinRate" radius={[0, 3, 3, 0]}>
                    {data.map((entry, i) => (
                        <Cell
                            key={i}
                            fill={
                                entry.tradeCount === 0
                                    ? '#52525B'
                                    : entry.actualWinRate >= entry.targetWinRate
                                        ? 'rgba(34,197,94,0.85)'
                                        : 'rgba(239,68,68,0.85)'
                            }
                        />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
}
