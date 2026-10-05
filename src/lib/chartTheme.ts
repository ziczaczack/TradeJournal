// Colours for code that cannot read CSS variables: Recharts props, the
// lightweight-charts canvas and next/og share images. The P&L values must
// match --profit, --loss and --warning in src/app/globals.css
// (chartTheme.test.ts fails if they drift apart).

export const PNL = {
    profit: '#34d399', // emerald-400
    loss: '#fb7185', // rose-400
    warning: '#fbbf24', // amber-400
} as const;

/** Chart chrome on the dark theme, all from the zinc scale. */
export const CHART = {
    grid: '#27272a', // zinc-800
    axisLine: '#52525b', // zinc-600
    axisText: '#a1a1aa', // zinc-400: readable tick labels
    tooltipBg: '#18181b', // zinc-900
    tooltipBorder: '#3f3f46', // zinc-700
    tooltipText: '#e4e4e7', // zinc-200
    accent: '#3b82f6', // blue-500
} as const;

export const pnlColor = (value: number): string => (value >= 0 ? PNL.profit : PNL.loss);
