import { describe, it, expect } from 'vitest';
import { analyzeEmotionCorrelation } from './aiMentor';
import { makeTrade } from './__fixtures__/trades';

describe('analyzeEmotionCorrelation', () => {
    it('returns no warnings for an empty array', () => {
        expect(analyzeEmotionCorrelation([])).toEqual([]);
    });

    it('returns no warnings when there are no losing trades', () => {
        const trades = [
            makeTrade({ pnl: 100, psychology_tag: 'Calm' }),
            makeTrade({ pnl: 50, psychology_tag: 'Revenge' }),
        ];
        expect(analyzeEmotionCorrelation(trades)).toEqual([]);
    });

    it('flags a dangerous tag whose losses exceed 1.5x the normal average loss', () => {
        const trades = [
            makeTrade({ pnl: -100, psychology_tag: 'Revenge' }),
            makeTrade({ pnl: -100, psychology_tag: 'Revenge' }),
            makeTrade({ pnl: -20, psychology_tag: 'Calm' }),
            makeTrade({ pnl: -20, psychology_tag: 'Calm' }),
        ];
        // normal avg loss = (100+100+20+20)/4 = 60; Revenge avg = 100 > 90 => warn
        const warnings = analyzeEmotionCorrelation(trades);
        expect(warnings).toHaveLength(1);
        expect(warnings[0].tag).toBe('Revenge');
        expect(warnings[0].severity).toBe('high');
        expect(warnings[0].tradeCount).toBe(2);
    });
});
