import { describe, expect, it } from 'vitest';
import type { Bet, GameEvent, RollRecord } from '../engine/types';
import { portraitLayout } from './layouts';
import { createGame } from '../engine';
import { previewAction } from '../math';
import type { Action, BetTypeId, GameState } from '../engine/types';
import type { BetInit } from '../engine';
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
  it('combined edge is per decision: pass + max odds 0.374%, DP + max lay 0.273%', () => {
    const pass = createGame({
      phase: 'point',
      point: 6,
      bets: [{ type: 'pass-line', amount: 1000 }],
    });
    const po = { type: 'place-bet', betType: 'pass-odds', amount: 5000 } as const;
    const f1 = buildEvFacts(previewAction(pass, po), pass)!;
    expect(f1.combined!.edge * 100).toBeCloseTo(0.374, 2);
    const dp = createGame({
      phase: 'point',
      point: 6,
      bets: [{ type: 'dont-pass', amount: 1000 }],
    });
    const dpo = { type: 'place-bet', betType: 'dont-pass-odds', amount: 6000 } as const;
    const f2 = buildEvFacts(previewAction(dp, dpo), dp)!;
    expect(f2.combined!.edge * 100).toBeCloseTo(0.273, 2);
  });
  it('returns null for a roll', () => {
    expect(facts({ type: 'roll' })).toBeNull();
  });
});

describe('combined edge with two Come bets', () => {
  // Come $10 on 4 and Come $10 on 6. The figure for 6 must use 6's max odds (5x), not 4's (3x).
  const come4 = { ref: 'c4', type: 'come', amount: 1000, point: 4 } as const;
  const come6 = { ref: 'c6', type: 'come', amount: 1000, point: 6 } as const;
  const odds6 = (amount: number) => ({ type: 'come-odds', amount, parentRef: 'c6' }) as const;
  const two = (extra: BetInit[] = []) =>
    createGame({ phase: 'point', point: 8, bankroll: 100000, bets: [come4, come6, ...extra] });
  const single = (extra: BetInit[] = []) =>
    createGame({ phase: 'point', point: 8, bankroll: 100000, bets: [come6, ...extra] });
  const byType = (s: GameState, type: BetTypeId, point?: number) =>
    s.bets.find((b) => b.type === type && (point === undefined || b.point === point))!;
  const combinedOf = (s: GameState, action: Action) =>
    buildEvFacts(previewAction(s, action), s)!.combined;

  it('odds placed on the 6 come bet use 6 max odds (5x), not the 4 point (3x)', () => {
    const s = two();
    const action = {
      type: 'place-bet',
      betType: 'come-odds',
      amount: 5000,
      parentId: byType(s, 'come', 6).id,
    } as const;
    const ref = single();
    const refAction = { ...action, parentId: byType(ref, 'come', 6).id };
    expect(combinedOf(s, action)).toEqual(combinedOf(ref, refAction));
    expect(combinedOf(s, action)!.label).toBe('Come + Odds');
  });

  it('set-amount on the odds of the 6 come bet uses the managed bet', () => {
    const s = two([odds6(5000)]);
    const ref = single([odds6(2000)]);
    const action = { type: 'set-amount', betId: byType(s, 'come-odds').id, amount: 2000 } as const;
    const refAction = { ...action, betId: byType(ref, 'come-odds').id };
    expect(combinedOf(s, action)).toEqual(combinedOf(ref, refAction));
  });

  it('set-amount on the 6 come bet itself uses its own point', () => {
    const s = two([odds6(5000)]);
    const ref = single([odds6(5000)]);
    const action = { type: 'set-amount', betId: byType(s, 'come', 6).id, amount: 2000 } as const;
    const refAction = { ...action, betId: byType(ref, 'come').id };
    expect(combinedOf(s, action)).toEqual(combinedOf(ref, refAction));
  });
});
