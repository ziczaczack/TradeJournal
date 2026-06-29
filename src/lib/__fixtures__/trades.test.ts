import { describe, it, expect } from 'vitest';
import { makeTrade } from './trades';

describe('makeTrade', () => {
    it('returns a complete trade with default values', () => {
        const trade = makeTrade();
        expect(trade.symbol).toBe('NQ');
        expect(trade.pnl).toBe(0);
        expect(typeof trade.id).toBe('string');
        expect(typeof trade.trade_id).toBe('string');
    });

    it('applies overrides', () => {
        const trade = makeTrade({ pnl: 150, psychology_tag: 'Revenge' });
        expect(trade.pnl).toBe(150);
        expect(trade.psychology_tag).toBe('Revenge');
    });

    it('gives each trade a unique id', () => {
        expect(makeTrade().id).not.toBe(makeTrade().id);
    });
});
