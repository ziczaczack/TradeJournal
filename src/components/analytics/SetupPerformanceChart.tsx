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
import { CHART, PNL } from '@/lib/chartTheme';

interface SetupPerformanceChartProps {
    data: SetupPerformance[];
}

export function SetupPerformanceChart({ data }: SetupPerformanceChartProps) {
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
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
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis
                    dataKey="displayName"
                    stroke={CHART.axisText}
                    tick={{ fill: CHART.axisText, fontSize: 11 }}
                    tickLine={{ stroke: CHART.axisLine }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                />
                <YAxis
                    yAxisId="left"
                    stroke={CHART.axisText}
                    tick={{ fill: CHART.axisText, fontSize: 12 }}
                    tickLine={{ stroke: CHART.axisLine }}
                    tickFormatter={(value) => `$${value}`}
                />
                <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke={CHART.axisText}
                    tick={{ fill: CHART.axisText, fontSize: 12 }}
                    tickLine={{ stroke: CHART.axisLine }}
                    tickFormatter={(value) => `${value}%`}
                    domain={[0, 100]}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: CHART.tooltipBg,
                        border: `1px solid ${CHART.tooltipBorder}`,
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                    }}
                    labelStyle={{ color: CHART.tooltipText, fontWeight: 'bold' }}
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
                    formatter={(value) => <span style={{ color: CHART.tooltipText }}>{value}</span>}
                />
                <Bar
                    yAxisId="left"
                    dataKey="netPnL"
                    name="Net PnL"
                    fill={PNL.profit}
                    radius={[4, 4, 0, 0]}
                >
                    {chartData.map((entry, index) => (
                        <Cell
                            key={`cell-${index}`}
                            fill={entry.netPnL >= 0 ? PNL.profit : PNL.loss}
                        />
                    ))}
                </Bar>
                <Bar
                    yAxisId="right"
                    dataKey="winRate"
                    name="Win Rate"
                    fill={CHART.accent}
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
