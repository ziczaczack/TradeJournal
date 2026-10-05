'use client';

import {
    PieChart,
    Pie,
    Cell,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { PsychologyBreakdown, formatCurrency } from '@/lib/analyticsStats';

interface PsychologyImpactChartProps {
    data: PsychologyBreakdown[];
}

// Color palette for psychology tags
const COLORS = [
    '#22c55e', // green
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
];

export function PsychologyImpactChart({ data }: PsychologyImpactChartProps) {
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-zinc-500">
                No psychology data available
            </div>
        );
    }

    // Prepare data with absolute values for pie chart sizing
    const chartData = data.map((item, index) => ({
        ...item,
        value: Math.abs(item.totalPnL) || 1, // Use 1 as minimum for visibility
        color: COLORS[index % COLORS.length],
    }));

    const renderCustomLabel = ({
        cx,
        cy,
        midAngle,
        innerRadius,
        outerRadius,
        percent,
        tag,
    }: {
        cx: number;
        cy: number;
        midAngle: number;
        innerRadius: number;
        outerRadius: number;
        percent: number;
        tag: string;
    }) => {
        if (percent < 0.05) return null; // Don't show labels for small slices

        const RADIAN = Math.PI / 180;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill="white"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight="bold"
            >
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    label={renderCustomLabel as any}
                    outerRadius={100}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="tag"
                    paddingAngle={2}
                >
                    {chartData.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.color}
                            stroke="#1e293b"
                            strokeWidth={2}
                        />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                    }}
                    labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={((value: number | undefined, name: string, props: any) => {
                        const item = props?.payload;
                        if (!item) return [value, name];
                        return [
                            <span key="value" className="flex flex-col">
                                <span>PnL: {formatCurrency(item.totalPnL)}</span>
                                <span>Trades: {item.tradeCount}</span>
                            </span>,
                            item.tag,
                        ];
                    }) as any}
                />
                <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ paddingLeft: '20px' }}
                    formatter={(value, entry) => {
                        const item = chartData.find((d) => d.tag === value);
                        if (item) {
                            return (
                                <span style={{ color: '#e2e8f0' }}>
                                    {value}{' '}
                                    <span
                                        style={{
                                            color: item.totalPnL >= 0 ? '#22c55e' : '#ef4444',
                                            fontSize: '12px',
                                        }}
                                    >
                                        ({formatCurrency(item.totalPnL)})
                                    </span>
                                </span>
                            );
                        }
                        return <span style={{ color: '#e2e8f0' }}>{value}</span>;
                    }}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
