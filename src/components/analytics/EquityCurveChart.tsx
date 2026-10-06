'use client';

import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts';
import { EquityCurvePoint, formatCurrency } from '@/lib/analyticsStats';
import { CHART, PNL } from '@/lib/chartTheme';

interface EquityCurveChartProps {
    data: EquityCurvePoint[];
}

export function EquityCurveChart({ data }: EquityCurveChartProps) {
    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
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
    const strokeColor = isPositive ? PNL.profit : PNL.loss;
    const gradientId = isPositive ? 'greenGradient' : 'redGradient';

    return (
        <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <defs>
                    <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PNL.profit} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={PNL.profit} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={PNL.loss} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={PNL.loss} stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} />
                <XAxis
                    dataKey="date"
                    stroke={CHART.axisText}
                    tick={{ fill: CHART.axisText, fontSize: 12 }}
                    tickLine={{ stroke: CHART.axisLine }}
                />
                <YAxis
                    stroke={CHART.axisText}
                    tick={{ fill: CHART.axisText, fontSize: 12 }}
                    tickLine={{ stroke: CHART.axisLine }}
                    tickFormatter={(value) => `$${value.toLocaleString()}`}
                    domain={[minValue - padding, maxValue + padding]}
                />
                <Tooltip
                    contentStyle={{
                        backgroundColor: CHART.tooltipBg,
                        border: `1px solid ${CHART.tooltipBorder}`,
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                    }}
                    labelStyle={{ color: CHART.tooltipText, fontWeight: 'bold' }}
                    itemStyle={{ color: CHART.tooltipText }}
                    formatter={(value, name) => {
                        const val = Number(value ?? 0);
                        if (name === 'cumulativePnL') {
                            return [formatCurrency(val), 'Cumulative PnL'];
                        }
                        return [formatCurrency(val), 'Trade PnL'];
                    }}
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
                        stroke: CHART.tooltipBg,
                        strokeWidth: 2,
                    }}
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
