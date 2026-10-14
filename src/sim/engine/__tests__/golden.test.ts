import { describe, expect, it } from 'vitest';
import { equity } from '../index';
import type { BetInit, CreateGameOptions, PointNumber } from '../index';
import { $, game, roll } from './helpers';

interface Case {
  name: string;
  bets: BetInit[];
  point?: PointNumber;
  rules?: CreateGameOptions['rules'];
  dice: [number, number];
  delta: number; // net equity change in cents
}
const B = (type: BetInit['type'], dollars: number, extra: Partial<BetInit> = {}): BetInit => ({
  type,
  amount: $(dollars),
  ...extra,
});

const cases: Case[] = [
  {
    name: 'pass-line 10 wins on come-out 7',
    bets: [B('pass-line', 10)],
    dice: [3, 4],
    delta: $(10),
  },
  {
    name: 'pass-line 10 loses on come-out 2',
    bets: [B('pass-line', 10)],
    dice: [1, 1],
    delta: -$(10),
  },
  { name: 'place-6 12 wins on 6', bets: [B('place-6', 12)], point: 9, dice: [2, 4], delta: $(14) },
  { name: 'place-5 10', bets: [B('place-5', 10)], point: 9, dice: [1, 4], delta: $(14) },
  { name: 'place-4 10', bets: [B('place-4', 10)], point: 9, dice: [1, 3], delta: $(18) },
  {
    name: 'place-6 5 short pay (unit 1)',
    bets: [B('place-6', 5)],
    point: 9,
    dice: [2, 4],
    delta: 583,
  },
  {
    name: 'place-6 5 short pay (unit 100)',
    bets: [B('place-6', 5)],
    point: 9,
    rules: { payoutUnit: 100 },
    dice: [2, 4],
    delta: $(5),
  },
  {
    name: 'buy-4 20 wins +40 -1 vig',
    bets: [B('buy-4', 20)],
    point: 9,
    dice: [1, 3],
    delta: $(39),
  },
  {
    name: 'buy-4 10 wins +20 -1 vig',
    bets: [B('buy-4', 10)],
    point: 9,
    dice: [2, 2],
    delta: $(19),
  },
  { name: 'buy-5 20 wins +30 -1', bets: [B('buy-5', 20)], point: 9, dice: [1, 4], delta: $(29) },
  { name: 'buy-6 20 wins +24 -1', bets: [B('buy-6', 20)], point: 9, dice: [1, 5], delta: $(23) },
  {
    name: 'buy-10 40 wins +80 -2',
    bets: [B('buy-10', 40)],
    point: 9,
    dice: [4, 6].slice(0, 2) as [number, number],
    delta: $(78),
  },
  { name: 'lay-4 40 wins +20 -1', bets: [B('lay-4', 40)], point: 9, dice: [3, 4], delta: $(19) },
  { name: 'lay-5 30 wins +20 -1', bets: [B('lay-5', 30)], point: 9, dice: [3, 4], delta: $(19) },
  { name: 'lay-6 24 wins +20 -1', bets: [B('lay-6', 24)], point: 9, dice: [3, 4], delta: $(19) },
  { name: 'lay-4 40 loses on 4', bets: [B('lay-4', 40)], point: 9, dice: [2, 2], delta: -$(40) },
  {
    name: 'buy-4 20 upfront vig: paid at placement, nothing on win',
    bets: [B('buy-4', 20)],
    point: 9,
    rules: { vig: { rate: 0.05, timing: 'upfront', rounding: 'floor-dollar-min-1' } },
    dice: [1, 3],
    delta: $(40),
  },
  { name: 'field 5 on 2 (2x)', bets: [B('field', 5)], dice: [1, 1], delta: $(10) },
  { name: 'field 5 on 12 (2x)', bets: [B('field', 5)], dice: [6, 6], delta: $(10) },
  {
    name: 'field 5 on 12 (3x preset)',
    bets: [B('field', 5)],
    rules: 'field-3x-12',
    dice: [6, 6],
    delta: $(15),
  },
  { name: 'field 5 on 3', bets: [B('field', 5)], dice: [1, 2], delta: $(5) },
  { name: 'field 5 on 8 loses', bets: [B('field', 5)], dice: [3, 5], delta: -$(5) },
  { name: 'big-6 6', bets: [B('big-6', 6)], point: 9, dice: [1, 5], delta: $(6) },
  { name: 'hard-6 5', bets: [B('hard-6', 5)], point: 9, dice: [3, 3], delta: $(45) },
  { name: 'hard-4 5', bets: [B('hard-4', 5)], point: 9, dice: [2, 2], delta: $(35) },
  { name: 'hard-6 loses to easy 6', bets: [B('hard-6', 5)], point: 9, dice: [1, 5], delta: -$(5) },
  { name: 'any-7 5', bets: [B('any-7', 5)], dice: [3, 4], delta: $(20) },
  { name: 'any-craps 5 on 3', bets: [B('any-craps', 5)], dice: [1, 2], delta: $(35) },
  { name: 'yo-11 5', bets: [B('yo-11', 5)], dice: [5, 6], delta: $(75) },
  { name: 'aces-2 1', bets: [B('aces-2', 1)], dice: [1, 1], delta: $(30) },
  { name: 'boxcars 1', bets: [B('boxcars-12', 1)], dice: [6, 6], delta: $(30) },
  { name: 'ace-deuce 1', bets: [B('ace-deuce-3', 1)], dice: [2, 1], delta: $(15) },
  { name: 'horn 4 on 2', bets: [B('horn', 4)], dice: [1, 1], delta: $(27) },
  { name: 'horn 4 on 3', bets: [B('horn', 4)], dice: [1, 2], delta: $(12) },
  { name: 'horn 4 on 7', bets: [B('horn', 4)], dice: [3, 4], delta: -$(4) },
  { name: 'c-e 2 on 2', bets: [B('c-e', 2)], dice: [1, 1], delta: $(6) },
  { name: 'c-e 2 on 11', bets: [B('c-e', 2)], dice: [5, 6], delta: $(14) },
  { name: 'world 5 on 2', bets: [B('world', 5)], dice: [1, 1], delta: $(26) },
  { name: 'world 5 on 3', bets: [B('world', 5)], dice: [1, 2], delta: $(11) },
  { name: 'world 5 on 7 pushes', bets: [B('world', 5)], dice: [3, 4], delta: 0 },
  { name: 'dont-pass 10 pushes on 12', bets: [B('dont-pass', 10)], dice: [6, 6], delta: 0 },
  { name: 'dont-pass 10 wins on 3', bets: [B('dont-pass', 10)], dice: [1, 2], delta: $(10) },
];

describe('golden payouts', () => {
  it.each(cases)('$name', (c) => {
    const s = game({
      bets: c.bets,
      rules: c.rules,
      ...(c.point ? { phase: 'point' as const, point: c.point } : {}),
    });
    const before = equity(s);
    const r = roll(s, c.dice[0], c.dice[1]);
    const upfrontVig = s.stats.totalVig;
    expect(equity(r.state) - before).toBe(c.delta);
    expect(upfrontVig).toBe(s.stats.totalVig);
  });

  it('odds payouts: pass odds 30/40/50 on 4/5/6 pay +60', () => {
    for (const [p, amt, dice] of [
      [4, 30, [2, 2]],
      [5, 40, [1, 4]],
      [6, 50, [3, 3]],
    ] as const) {
      const s = game({
        phase: 'point',
        point: p,
        bets: [B('pass-line', 10, { ref: 'f' }), B('pass-odds', amt, { parentRef: 'f' })],
      });
      const r = roll(s, dice[0], dice[1]);
      const won = r.events.find((e) => e.type === 'bet-won' && e.betType === 'pass-odds');
      expect(won).toMatchObject({ profit: $(60) });
      expect(r.state.bets.map((b) => b.type)).toEqual(['pass-line']); // odds come down, flat stays
      expect(equity(r.state) - equity(s)).toBe($(60) + $(10));
    }
  });

  it('dont-pass odds 60 on 4/5/6 win +30/+40/+50 on a 7', () => {
    for (const [p, win] of [
      [4, 30],
      [5, 40],
      [6, 50],
    ] as const) {
      const s = game({
        phase: 'point',
        point: p,
        bets: [B('dont-pass', 10, { ref: 'f' }), B('dont-pass-odds', 60, { parentRef: 'f' })],
      });
      const r = roll(s, 3, 4);
      expect(
        r.events.find((e) => e.type === 'bet-won' && e.betType === 'dont-pass-odds'),
      ).toMatchObject({
        profit: $(win),
      });
    }
  });

  it('bet-won event carries gross profit and the vig separately', () => {
    const s = game({ phase: 'point', point: 9, bets: [B('buy-4', 20)] });
    const r = roll(s, 1, 3);
    expect(r.events.find((e) => e.type === 'bet-won')).toMatchObject({
      profit: $(40),
      vig: $(1),
      staysUp: true,
    });
    expect(r.state.stats.totalVig).toBe($(1));
    expect(r.state.stats.totalWon).toBe($(39));
  });

  it('upfront vig: buy-4 $20 wins three times; the first is covered by the upfront vig, later wins pay $1 each', () => {
    const rules = {
      vig: { rate: 0.05, timing: 'upfront' as const, rounding: 'floor-dollar-min-1' as const },
    };
    let s = game({ phase: 'point', point: 9, rules, bets: [B('buy-4', 20)] });
    expect(s.bankroll).toBe($(1000 - 21));
    const profits: number[] = [];
    for (let i = 0; i < 3; i++) {
      const before = equity(s);
      s = roll(s, 1, 3).state;
      profits.push(equity(s) - before);
    }
    expect(profits).toEqual([$(40), $(39), $(39)]);
    expect(s.bets[0]!.vigPaid).toBe(0);
    expect(s.stats.totalVig).toBe($(3)); // 1 upfront + 2 on later wins
    // lay: same
    let l = game({ phase: 'point', point: 9, rules, bets: [B('lay-4', 40)] });
    const b0 = equity(l);
    l = roll(l, 3, 4).state;
    l = roll(l, 3, 4).state;
    expect(equity(l) - b0).toBe($(20) + $(19));
  });
});
