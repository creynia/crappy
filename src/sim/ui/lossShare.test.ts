import { describe, expect, it } from 'vitest';
import type { BetTypeStats } from '../engine/types';
import { lossBreakdown } from './lossShare';

const bt = (wagered: number, expectedLoss: number): BetTypeStats => ({
  count: 1,
  wagered,
  won: 0,
  lost: 0,
  vig: 0,
  net: 0,
  expectedLoss,
});

describe('lossBreakdown (I023)', () => {
  it('shares of loss sum to 100% and the costly bet gets the takeaway sentence', () => {
    // field: 10% of $100 action, 5.6% edge -> 56c of 183c expected loss; pass line: 90% of action, 127c
    const r = lossBreakdown({ field: bt(1000, 56), 'pass-line': bt(9000, 127) }, 10000);
    const total = Object.values(r.loss).reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 1)).toBeLessThan(0.01);
    expect(Math.round(r.loss.field! * 100)).toBe(31);
    expect(Math.round(r.loss['pass-line']! * 100)).toBe(69);
    expect(r.sentence).toBe(
      'Field bets were 10% of your action but 31% of your expected loss. Pass Line would have cost about $0.14 on all your costly bets.',
    );
  });

  it('no sentence when every bet is good or free', () => {
    const r = lossBreakdown({ 'pass-line': bt(10000, 141), 'pass-odds': bt(5000, 0) }, 15000);
    expect(r.sentence).toBeNull();
  });

  it('no sentence and zero shares with no expected loss', () => {
    const r = lossBreakdown({}, 0);
    expect(r.sentence).toBeNull();
    expect(r.loss).toEqual({});
  });

  it('sums all costly bets in the Pass Line comparison, not just the named one', () => {
    // field 10% of action, any 7 5%: both costly (5.6% and 16.6%); X = (1000 + 500) x 7/495 = 21.2c
    const r = lossBreakdown(
      { field: bt(1000, 56), 'any-7': bt(500, 83), 'pass-line': bt(8500, 120) },
      10000,
    );
    expect(r.sentence).toContain('Any seven bets were 5% of your action');
    expect(r.sentence).toContain('Pass Line would have cost about $0.21 on all your costly bets.');
  });
});
