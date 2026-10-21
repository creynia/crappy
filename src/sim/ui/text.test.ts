import { describe, expect, it } from 'vitest';
import type { Bet, GameEvent, RollRecord } from '../engine/types';
import { portraitLayout } from './layouts';
import { createGame } from '../engine';
import { previewAction } from '../math';
import type { Action, BetTypeId, GameState } from '../engine/types';
import type { BetInit } from '../engine';
import {
  buildEvFacts,
  describeRoll,
  fmtMoney,
  edgeOnAction,
  nextCostUnit,
  normalizeTier,
  regionAriaLabel,
  rollCostText,
  swingCopy,
  typeEdgeLabel,
} from './text';

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
      '6, the hard way. Point made! Pass line wins $10, pass odds wins $60. Net +$70.',
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
      '7. Seven out. Pass line loses $10, field loses $5. Net -$15.',
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
      amount: 2000,
      parentId: byType(s, 'come', 6).id,
    } as const;
    const ref = single();
    const refAction = { ...action, parentId: byType(ref, 'come', 6).id };
    expect(combinedOf(s, action)).toEqual(combinedOf(ref, refAction));
    expect(combinedOf(s, action)!.label).toBe('Come + Odds');
    // $20 odds on the 6 (5x max = $50): 6's max odds, not 4's 3x.
    expect(combinedOf(s, action)!.edge).toBeCloseTo(7 / 1045, 12);
  });

  it('set-amount on the odds of the 6 come bet uses the managed bet', () => {
    const s = two([odds6(5000)]);
    const ref = single([odds6(2000)]);
    const action = { type: 'set-amount', betId: byType(s, 'come-odds').id, amount: 2000 } as const;
    const refAction = { ...action, betId: byType(ref, 'come-odds').id };
    expect(combinedOf(s, action)).toEqual(combinedOf(ref, refAction));
    expect(combinedOf(s, action)!.edge).toBeCloseTo(7 / 1045, 12);
  });

  it('set-amount on the 6 come bet itself uses its own point', () => {
    const s = two([odds6(5000)]);
    const ref = single([odds6(5000)]);
    const action = { type: 'set-amount', betId: byType(s, 'come', 6).id, amount: 2000 } as const;
    const refAction = { ...action, betId: byType(ref, 'come').id };
    expect(combinedOf(s, action)).toEqual(combinedOf(ref, refAction));
    expect(combinedOf(s, action)!.edge).toBeCloseTo(14 / 2365, 12);
  });
});

describe('roll cost units (I043)', () => {
  const edgeOf = (bets: BetInit[]) => edgeOnAction(createGame({ bankroll: 100000, bets }));
  it('cycles per roll → per hour → per $100 bet → per roll', () => {
    expect(nextCostUnit('roll')).toBe('hour');
    expect(nextCostUnit('hour')).toBe('bet100');
    expect(nextCostUnit('bet100')).toBe('roll');
  });
  it('per $100 bet is the edge on action: pass $10 is $1.41', () => {
    const e = edgeOf([{ type: 'pass-line', amount: 1000 }]);
    expect(rollCostText('bet100', 14.1, 100, e)).toBe('Expected cost: $1.41 per $100 bet');
  });
  it('odds count 0 in the numerator but stay in the denominator: pass $10 + $50 odds is $0.24', () => {
    const g = createGame({
      phase: 'point',
      point: 6,
      bankroll: 100000,
      bets: [
        { ref: 'p', type: 'pass-line', amount: 1000 },
        { type: 'pass-odds', amount: 5000, parentRef: 'p' },
      ],
    });
    const e = edgeOnAction(g);
    expect(rollCostText('bet100', 14.1, 100, e)).toBe('Expected cost: $0.24 per $100 bet');
  });
  it('place 6 $12 is $1.52 and field $5 is $5.56 per $100 bet', () => {
    expect(rollCostText('bet100', 18.2, 100, edgeOf([{ type: 'place-6', amount: 1200 }]))).toBe(
      'Expected cost: $1.52 per $100 bet',
    );
    expect(rollCostText('bet100', 27.8, 100, edgeOf([{ type: 'field', amount: 500 }]))).toBe(
      'Expected cost: $5.56 per $100 bet',
    );
  });
  it('per roll and per hour are literal: $0.14 per roll is $14.10 per hour at 100 rolls', () => {
    expect(rollCostText('roll', 14.1, 100, null)).toBe('Expected cost: $0.14 per roll');
    expect(rollCostText('hour', 14.1, 100, null)).toBe('Expected cost: $14.10 per hour');
    expect(rollCostText('bet100', 14.1, 100, null)).toBeUndefined();
  });
});

describe('typical swing', () => {
  it('pass $10 swings about $10.00 with a $0.14 edge; pass-odds $30 on the 4 swings $42.43', () => {
    const pass = createGame({ bankroll: 100000 });
    const f = buildEvFacts(
      previewAction(pass, { type: 'place-bet', betType: 'pass-line', amount: 1000 }),
      pass,
    )!;
    expect(Math.round(f.swingCents!)).toBe(1000);
    expect(swingCopy(f.swingCents!, f.edge, f.expectedLossCents)).toBe(
      'Typical swing per decision: ±$10.00 (the edge is $0.14).',
    );
    const four = createGame({
      phase: 'point',
      point: 4,
      bets: [{ type: 'pass-line', amount: 1000 }],
    });
    const o = buildEvFacts(
      previewAction(four, { type: 'place-bet', betType: 'pass-odds', amount: 3000 }),
      four,
    )!;
    expect(Math.round(o.swingCents!)).toBe(4243);
    expect(swingCopy(o.swingCents!, 0, 0)).toBe('No edge, but it adds ±$42.43 of swing.');
  });
});

describe('typeEdgeLabel', () => {
  const state = createGame({ bankroll: 100000 });
  it('box-4 options show their house edge at the sheet amount', () => {
    expect(typeEdgeLabel('place-4', 1000, state)).toMatchObject({ edgeText: '6.67%' });
    expect(typeEdgeLabel('buy-4', 2000, state)).toMatchObject({ edgeText: '1.67%' });
    expect(typeEdgeLabel('buy-4', 1000, state)).toMatchObject({ edgeText: '3.33%' });
  });
});

describe('typical swing values (I004 review)', () => {
  const swingOfBet = (type: string, amount: number, extra: Record<string, unknown> = {}) => {
    const g = createGame({ bankroll: 100000 });
    const f = buildEvFacts(
      previewAction(g, { type: 'place-bet', betType: type, amount, ...extra } as never),
      g,
    )!;
    return f;
  };
  it('place 6 $12 swings $12.95 and any-7 $5 shows swing and edge', () => {
    expect(swingCopy(swingOfBet('place-6', 1200).swingCents!, 0.0152, 0)).toContain('±$12.95');
    const any7 = swingOfBet('any-7', 500);
    expect(any7.swingCents).not.toBeNull();
    expect(any7.edge).not.toBeNull();
  });
  it('field $10 swings $10.79, hard 8 $10 swings $28.75, dont-pass $10 swings $9.86', () => {
    expect(Math.round(swingOfBet('field', 1000).swingCents!)).toBe(1079);
    expect(Math.round(swingOfBet('hard-8', 1000).swingCents!)).toBe(2875);
    expect(Math.round(swingOfBet('dont-pass', 1000).swingCents!)).toBe(986);
  });
  it('a null edge shows the swing only; a zero edge says "No edge"', () => {
    expect(swingCopy(1000, null, 0)).toBe('Typical swing per decision: ±$10.00.');
    expect(swingCopy(1000, 0, 0)).toBe('No edge, but it adds ±$10.00 of swing.');
  });
});
