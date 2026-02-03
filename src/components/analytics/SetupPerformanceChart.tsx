'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Legend,
} from 'recharts';
import { SetupPerformance, formatCurrency, formatPercent } from '@/lib/analyticsStats';

interface SetupPerformanceChartProps {
    data: SetupPerformance[];
}

export function SetupPerformanceChart({ data }: SetupPerformanceChartProps) {
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-slate-500">
                No setup data available
            </div>
        );
    }

    // Prepare data for display - show top setups
    const chartData = data.slice(0, 8).map((item) => ({
        ...item,
        displayName: item.setupType.length > 15
            ? item.setupType.substring(0, 12) + '...'
            : item.setupType,
    }));

    return (
        <ResponsiveContainer width="100%" height={300}>
            <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 10, bottom: 60 }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                    dataKey="displayName"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickLine={{ stroke: '#4b5563' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                />
                <YAxis
                    yAxisId="left"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={{ stroke: '#4b5563' }}
                    tickFormatter={(value) => `$${value}`}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#9ca3af"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={{ stroke: '#4b5563' }}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                    }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: number | undefined, name: string) => {
                        const val = value ?? 0;
                        if (name === 'netPnL') {
                            return [formatCurrency(val), 'Net PnL'];
                        }
                        if (name === 'winRate') {
                            return [formatPercent(val), 'Win Rate'];
                        }
                        return [val, name];
                    }) as any}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    labelFormatter={((label: string, payload: any[]) => {
                        if (payload && payload[0]) {
                            return payload[0].payload.setupType;
                        }
                        return label;
                    }) as any}
                />
                <Legend
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => <span style={{ color: '#e2e8f0' }}>{value}</span>}
                />
                <Bar
                    yAxisId="left"
                    dataKey="netPnL"
                    name="Net PnL"
                    radius={[4, 4, 0, 0]}
                >
                    {chartData.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.netPnL >= 0 ? '#22c55e' : '#ef4444'}
                        />
                    ))}
                </Bar>
                <Bar
                    yAxisId="right"
                    dataKey="winRate"
                    name="Win Rate"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
