import { describe, expect, it } from 'vitest';
import { ALL_HOPS, BET_TYPES } from '../engine/bets';
import { applyAction, createGame } from '../engine/game';
import { DEFAULT_RULES } from '../engine/rules';
import type { Bet, Dice, Die } from '../engine/types';
import { betEdge, betEV, betOutcomes, tableExpectedLossPerRoll } from './ev';
import { frac, toNumber } from './fraction';
import { previewAction } from './preview';
import { edgeTier } from './tiers';
import type { BetCtx } from './types';

const comeOut: BetCtx = { phase: 'come-out', point: null, rules: DEFAULT_RULES };
const onSix: BetCtx = { phase: 'point', point: 6, rules: DEFAULT_RULES };
const D = (a: number, b: number): Dice => [a as Die, b as Die];
const isHard = (d: Dice) => d[0] === d[1];

describe('hop edges are exact (curriculum: easy 11.11%, hard 13.89%)', () => {
  it.each(ALL_HOPS.map((d) => [`${d[0]}-${d[1]}`, d] as const))('%s', (_n, d) => {
    for (const ctx of [comeOut, onSix]) {
      const e = betEdge('hop', 100, ctx, d);
      // easy: 2/36 x 15 - 34/36 = -4/36 = -1/9; hard: 1/36 x 30 - 35/36 = -5/36
      const want = isHard(d) ? frac(5, 36) : frac(1, 9);
      expect(e.perResolved).toEqual(want);
      expect(e.perResolvedExPush).toEqual(want);
      expect(e.perRoll).toEqual(want); // one-roll bet
      expect(e.expectedRolls).toEqual(frac(1));
      expect(edgeTier(e.perResolved)).toBe('avoid');
    }
  });
  it('EV in cents: $1 easy hop -11.11c, $1 hard hop -13.89c (exact)', () => {
    expect(betEV({ type: 'hop', amount: 100, point: null, hop: D(2, 4) }, comeOut)).toEqual(
      frac(-100, 9),
    );
    expect(betEV({ type: 'hop', amount: 100, point: null, hop: D(3, 3) }, comeOut)).toEqual(
      frac(-125, 9),
    );
  });
  it('order does not matter (4-2 is the 2-4 hop)', () => {
    expect(betEdge('hop', 500, comeOut, D(4, 2))).toEqual(betEdge('hop', 500, comeOut, D(2, 4)));
  });
  it('outcome rows name the pair and count dice combinations', () => {
    const easy = betOutcomes({ type: 'hop', amount: 200, point: null, hop: D(2, 4) }, comeOut);
    expect(easy.map((r) => [r.label, r.ways, r.outOf, toNumber(r.net)])).toEqual([
      ['Lose on any other roll', 34, 36, -200],
      ['Win on 2-4 (either way round)', 2, 36, 3000],
    ]);
    const hard = betOutcomes({ type: 'hop', amount: 100, point: null, hop: D(3, 3) }, comeOut);
    expect(hard.find((r) => r.net.n > 0n)).toMatchObject({ label: 'Win on 3-3', ways: 1 });
  });
  it('a hop without its pair has no distribution', () => {
    expect(() => betEdge('hop', 100, comeOut)).toThrow(/pair/);
  });
});

// ---- Monte Carlo: play hops straight through the registry with a seeded RNG ----
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

describe('Monte Carlo agrees with the exact hop EV', () => {
  const N = 400_000;
  it.each([
    ['easy 2-4', D(2, 4)],
    ['easy 5-6', D(6, 5)],
    ['hard 3-3', D(3, 3)],
    ['hard 1-1', D(1, 1)],
  ] as const)('%s', (_n, d) => {
    const r = lcg(2024);
    const die = () => (1 + Math.floor(r() * 6)) as Die;
    const amount = 100;
    const bet: Bet = {
      id: 'x',
      type: 'hop',
      amount,
      point: null,
      parentId: null,
      working: 'auto',
      placedOnRoll: 0,
      vigPaid: 0,
      hop: d,
    };
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const dice: Dice = [die(), die()];
      const total = dice[0] + dice[1];
      const res = BET_TYPES.hop.resolve(
        bet,
        { dice, total, hard: dice[0] === dice[1], phase: 'come-out', point: null },
        DEFAULT_RULES,
        true,
      );
      sum += res.kind === 'win' ? res.profit : -amount;
    }
    const exact = toNumber(betEV({ type: 'hop', amount, point: null, hop: d }, comeOut));
    // per-trial sd: hard ~5.1 x amount, easy ~3.9 x amount; allow 4.5 sigma
    const p = isHard(d) ? 1 / 36 : 2 / 36;
    const x = isHard(d) ? 30 : 15;
    const sd = amount * Math.sqrt(p * (x + 1) ** 2 - (p * (x + 1) - 1) ** 2);
    expect(Math.abs(sum / N - exact)).toBeLessThan((4.5 * sd) / Math.sqrt(N));
  });
});

describe('hop previews', () => {
  const g = createGame({ seed: 3, bankroll: 50_000 });
  it('previews a new hop with the exact edge, the sucker tier and a cheaper alternative', () => {
    const p = previewAction(g, { type: 'place-bet', betType: 'hop', amount: 500, hop: D(4, 2) });
    expect(p.validation.ok).toBe(true);
    expect(p.evCents).toEqual(frac(-500, 9));
    expect(p.tier).toBe('avoid');
    expect(p.headline).toContain('11.11%');
    expect(p.detail).toContain('One-roll bet');
    expect(p.explanation.rows).toHaveLength(2);
    expect(p.alternative?.action).toMatchObject({ betType: 'pass-line' });
  });
  it('hard hop preview is 13.89%', () => {
    const p = previewAction(g, { type: 'place-bet', betType: 'hop', amount: 100, hop: D(6, 6) });
    expect(p.headline).toContain('13.89%');
  });
  it('a hop without a pair previews as invalid without throwing', () => {
    const p = previewAction(g, { type: 'place-bet', betType: 'hop', amount: 100 });
    expect(p.validation.ok).toBe(false);
    expect(p.edge).toBeNull();
  });
  it('set-amount and remove previews keep the pair', () => {
    const r = applyAction(g, { type: 'place-bet', betType: 'hop', amount: 100, hop: D(1, 1) });
    if (!r.ok) throw new Error(r.error.message);
    const id = r.state.bets[0]!.id;
    const up = previewAction(r.state, { type: 'set-amount', betId: id, amount: 300 });
    expect(up.evCents).toEqual(frac(-250, 9)); // 2 more dollars at 5/36
    const rm = previewAction(r.state, { type: 'remove-bet', betId: id });
    expect(rm.evCents).toEqual(frac(125, 9));
  });
  it('table expected loss per roll counts every hop at its own edge', () => {
    let s = g;
    for (const d of [D(2, 4), D(3, 3)]) {
      const r = applyAction(s, { type: 'place-bet', betType: 'hop', amount: 900, hop: d });
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
    }
    // $9 x 1/9 + $9 x 5/36 = 100c + 125c
    expect(tableExpectedLossPerRoll(s)).toEqual(frac(225));
  });
});
