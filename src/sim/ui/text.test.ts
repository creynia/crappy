import { describe, expect, it } from 'vitest';
import type { Bet, GameEvent, RollRecord } from '../engine/types';
import { portraitLayout } from './layouts';
import { createGame } from '../engine';
import { previewAction } from '../math';
import type { Action, GameState } from '../engine/types';
import { buildEvFacts, describeRoll, fmtMoney, normalizeTier, regionAriaLabel } from './text';

const rec = (over: Partial<RollRecord>): RollRecord => ({
  n: 1,
  dice: [3, 3],
  total: 6,
  hard: true,
  phaseBefore: 'point',
  pointBefore: 6,
  forced: false,
  net: 7000,
  ...over,
});

describe('fmtMoney', () => {
  it('formats whole dollars, cents, signs and thousands', () => {
    expect(fmtMoney(1000)).toBe('$10');
    expect(fmtMoney(14)).toBe('$0.14');
    expect(fmtMoney(-14)).toBe('-$0.14');
    expect(fmtMoney(3900, { sign: true })).toBe('+$39');
    expect(fmtMoney(125000)).toBe('$1,250');
    expect(fmtMoney(1000, { exact: true })).toBe('$10.00');
  });
});

describe('describeRoll', () => {
  it('summarizes a point made with wins', () => {
    const events: GameEvent[] = [
      { type: 'dice-rolled', roll: rec({}) },
      { type: 'point-made', point: 6 },
      {
        type: 'bet-won',
        betId: 'b1',
        betType: 'pass-line',
        amount: 1000,
        profit: 1000,
        vig: 0,
        staysUp: true,
      },
      {
        type: 'bet-won',
        betId: 'b2',
        betType: 'pass-odds',
        amount: 3000,
        profit: 6000,
        vig: 0,
        staysUp: false,
      },
    ];
    expect(describeRoll(events)).toBe(
      '6, the hard way. Point made! Pass line wins $10, Pass odds wins $60. Net +$70.',
    );
  });
  it('summarizes a seven-out with losses', () => {
    const events: GameEvent[] = [
      { type: 'dice-rolled', roll: rec({ dice: [3, 4], total: 7, hard: false, net: -1500 }) },
      { type: 'seven-out', point: 6 },
      { type: 'bet-lost', betId: 'b1', betType: 'pass-line', amount: 1000 },
      { type: 'bet-lost', betId: 'b3', betType: 'field', amount: 500 },
    ];
    expect(describeRoll(events)).toBe(
      '7. Seven out. Pass line loses $10, Field loses $5. Net -$15.',
    );
  });
  it('subtracts vig from a win and names pushes', () => {
    const events: GameEvent[] = [
      { type: 'dice-rolled', roll: rec({ dice: [2, 2], total: 4, net: 2900 }) },
      {
        type: 'bet-won',
        betId: 'b1',
        betType: 'buy-4',
        amount: 2000,
        profit: 4000,
        vig: 100,
        staysUp: true,
      },
      { type: 'bet-pushed', betId: 'b2', betType: 'dont-pass', amount: 1000 },
    ];
    const t = describeRoll(events);
    expect(t).toContain('Buy 4 wins $39');
    expect(t).toContain("Don't pass pushes.");
  });
});

describe('regionAriaLabel', () => {
  const region = portraitLayout.regions.find((r) => r.id === 'box-6')!;
  const bet: Bet = {
    id: 'b1',
    type: 'place-6',
    amount: 1200,
    point: null,
    parentId: null,
    working: 'auto',
    placedOnRoll: 0,
    vigPaid: 0,
  };
  it('includes the amount and working state', () => {
    expect(regionAriaLabel(region, { bets: [bet] })).toContain('Place 6 $12, working');
    expect(regionAriaLabel(region, { bets: [bet], offIds: new Set(['b1']) })).toContain(
      'Place 6 $12, off',
    );
  });
  it('says no bet and lesson availability', () => {
    expect(regionAriaLabel(region)).toContain('No bet');
    expect(regionAriaLabel(region, { disabled: true })).toContain('Not available in this lesson');
  });
});

describe('tiers and ev facts', () => {
  it('normalizes the five tiers', () => {
    expect(normalizeTier('poor')).toBe('poor');
    expect(normalizeTier('zero')).toBe('free');
  });
  const state = createGame({
    point: 6,
    bankroll: 100000,
    bets: [
      { ref: 'p', type: 'pass-line', amount: 1000 },
      { type: 'pass-odds', amount: 3000, parentRef: 'p' },
    ],
  });
  const facts = (action: Action, s: GameState = state) => buildEvFacts(previewAction(s, action), s);

  it('derives edge, loss, per hour, chance and payout for place 6', () => {
    const f = facts({ type: 'place-bet', betType: 'place-6', amount: 1200 })!;
    expect(f.oneRoll).toBe(false);
    expect(f.edge).toBeCloseTo(0.0152, 3);
    expect(f.expectedLossCents).toBeCloseTo(18.2, 0);
    expect(f.pays).toBe('7 to 6');
    expect(f.chance).toBe('5 in 11 (45%)');
    expect(f.perHourCents).toBeGreaterThan(0);
    expect(f.combined).toBeNull();
  });
  it('hard 4 is not a one-roll bet and pays 7 to 1', () => {
    const f = facts({ type: 'place-bet', betType: 'hard-4', amount: 500 })!;
    expect(f.oneRoll).toBe(false);
    expect(f.pays).toBe('7 to 1');
  });
  it('field is a one-roll bet with a per-roll chance', () => {
    const f = facts({ type: 'place-bet', betType: 'field', amount: 500 })!;
    expect(f.oneRoll).toBe(true);
    expect(f.chance).toMatch(/rolls/);
  });
  it('odds are a free bet and show the combined edge with the flat bet', () => {
    const f = facts({ type: 'place-bet', betType: 'pass-odds', amount: 3000 })!;
    expect(f.edge).toBe(0);
    expect(f.combined?.label).toBe('Pass + Odds');
    expect(f.combined!.edge).toBeGreaterThan(0);
    expect(f.combined!.edge).toBeLessThan(0.0141);
  });
  it('returns null for a roll', () => {
    expect(facts({ type: 'roll' })).toBeNull();
  });
});
