'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import { EquityCurvePoint, formatCurrency } from '@/lib/analyticsStats';

interface EquityCurveChartProps {
    data: EquityCurvePoint[];
}

export function EquityCurveChart({ data }: EquityCurveChartProps) {
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-zinc-500">
                No trade data available
            </div>
        );
    }

    const minValue = Math.min(...data.map((d) => d.cumulativePnL));
    const maxValue = Math.max(...data.map((d) => d.cumulativePnL));
    const padding = Math.abs(maxValue - minValue) * 0.1 || 100;

    // Determine if overall positive or negative for coloring
    const finalValue = data[data.length - 1]?.cumulativePnL || 0;
    const isPositive = finalValue >= 0;
    const strokeColor = isPositive ? '#22c55e' : '#ef4444';
    const gradientId = isPositive ? 'greenGradient' : 'redGradient';

    return (
        <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={{ stroke: '#4b5563' }}
                />
                <YAxis
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={{ stroke: '#4b5563' }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    domain={[minValue - padding, maxValue + padding]}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                    }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                    itemStyle={{ color: '#e2e8f0' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: number | undefined, name: string) => {
                        const val = value ?? 0;
                        if (name === 'cumulativePnL') {
                            return [formatCurrency(val), 'Cumulative PnL'];
                        }
                        return [formatCurrency(val), 'Trade PnL'];
                    }) as any}
                />
                <Area
                    type="monotone"
                    dataKey="cumulativePnL"
                    stroke={strokeColor}
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={false}
                    activeDot={{
                        r: 6,
                        fill: strokeColor,
                        stroke: '#1e293b',
                        strokeWidth: 2,
                    }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
