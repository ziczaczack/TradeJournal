import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PNL, pnlColor } from './chartTheme';

const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');

function cssVar(name: string): string | undefined {
    return css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim().toLowerCase();
}

describe('chartTheme', () => {
    it.each(['profit', 'loss', 'warning'] as const)('PNL.%s matches its CSS token', (name) => {
        expect(cssVar(name)).toBe(PNL[name]);
    });

    it('colours zero and gains as profit, negatives as loss', () => {
        expect(pnlColor(0)).toBe(PNL.profit);
        expect(pnlColor(12.5)).toBe(PNL.profit);
        expect(pnlColor(-0.01)).toBe(PNL.loss);
    });
});
