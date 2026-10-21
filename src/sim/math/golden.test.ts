import { describe, expect, it } from 'vitest';
import { BET_TYPES } from '../engine/bets';
import { DEFAULT_RULES, RULE_PRESETS } from '../engine/rules';
import type { Bet, BetTypeId, Dice, Die, PointNumber, TableRules } from '../engine/types';
import { betEV, betOutcomes, betVariance } from './ev';
import { toNumber } from './fraction';
import type { BetCtx } from './types';

const ctx = (
  phase: 'come-out' | 'point',
  point: PointNumber | null,
  rules: TableRules = DEFAULT_RULES,
): BetCtx => ({
  phase,
  point,
  rules,
});
const nets = (type: BetTypeId, dollars: number, c: BetCtx, point: PointNumber | null = null) =>
  betOutcomes({ type, amount: dollars * 100, point }, c).map((r) => Number(r.net.n / r.net.d));

describe('golden payouts come from the engine registry', () => {
  it('place / buy / lay', () => {
    const p = ctx('point', 6);
    expect(nets('place-6', 12, p)).toContain(1400);
    expect(nets('place-5', 10, p)).toContain(1400);
    expect(nets('place-4', 10, p)).toContain(1800);
    expect(nets('buy-4', 20, p)).toContain(3900);
    expect(nets('buy-5', 20, p)).toContain(2900);
    expect(nets('buy-6', 20, p)).toContain(2300);
    expect(nets('lay-4', 40, p)).toContain(1900);
    expect(nets('lay-5', 30, p)).toContain(1900);
    expect(nets('lay-6', 24, p)).toContain(1900);
    expect(nets('buy-4', 20, p)).toContain(-2000);
  });
  it('odds', () => {
    expect(nets('pass-odds', 30, ctx('point', 4), 4)).toContain(6000);
    expect(nets('pass-odds', 40, ctx('point', 5), 5)).toContain(6000);
    expect(nets('pass-odds', 50, ctx('point', 6), 6)).toContain(6000);
    expect(nets('dont-pass-odds', 60, ctx('point', 4), 4)).toContain(3000);
    expect(nets('dont-pass-odds', 60, ctx('point', 5), 5)).toContain(4000);
    expect(nets('dont-pass-odds', 60, ctx('point', 6), 6)).toContain(5000);
  });
  it('center bets', () => {
    const c = ctx('come-out', null);
    expect(nets('field', 5, c)).toEqual(expect.arrayContaining([1000, 500, -500]));
    expect(
      nets('field', 5, ctx('come-out', null, { ...DEFAULT_RULES, ...RULE_PRESETS['field-3x-12'] })),
    ).toContain(1500);
    expect(nets('big-6', 6, c)).toContain(600);
    expect(nets('hard-6', 5, c)).toContain(4500);
    expect(nets('hard-4', 5, c)).toContain(3500);
    expect(nets('any-7', 5, c)).toContain(2000);
    expect(nets('any-craps', 5, c)).toContain(3500);
    expect(nets('yo-11', 5, c)).toContain(7500);
    expect(nets('aces-2', 1, c)).toContain(3000);
    expect(nets('horn', 4, c)).toEqual(expect.arrayContaining([2700, 1200]));
    expect(nets('c-e', 2, c)).toEqual(expect.arrayContaining([600, 1400]));
    expect(nets('world', 5, c)).toEqual(expect.arrayContaining([2600, 1100, 0]));
  });
  it('short pay: place 6 $5', () => {
    expect(nets('place-6', 5, ctx('point', 6))).toContain(583);
    expect(nets('place-6', 5, ctx('point', 6, { ...DEFAULT_RULES, payoutUnit: 100 }))).toContain(
      500,
    );
  });
  it('vig rounding: buy-4 $10 pays $20 - $1 and costs 10% of the bet', () => {
    expect(nets('buy-4', 10, ctx('point', 6))).toContain(1900);
  });
});

// ---- Monte Carlo cross-check: play bets straight through the registry with a seeded RNG ----
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const die = (r: () => number): Die => (1 + Math.floor(r() * 6)) as Die;

function simulate(
  type: BetTypeId,
  amount: number,
  trials: number,
  seed: number,
  rules = DEFAULT_RULES,
) {
  const r = lcg(seed);
  const def = BET_TYPES[type];
  let sum = 0;
  let sumSq = 0;
  const record = (x: number) => {
    sum += x;
    sumSq += x * x;
  };
  for (let i = 0; i < trials; i++) {
    let bet: Bet = {
      id: 'x',
      type,
      amount,
      point: null,
      parentId: null,
      working: 'on',
      placedOnRoll: 0,
      vigPaid: 0,
    };
    let phase: 'come-out' | 'point' =
      type === 'pass-line' || type === 'dont-pass' ? 'come-out' : 'point';
    let point: PointNumber | null = phase === 'point' ? 6 : null;
    for (;;) {
      const dice: Dice = [die(r), die(r)];
      const total = dice[0] + dice[1];
      const res = def.resolve(
        bet,
        { dice, total, hard: dice[0] === dice[1], phase, point },
        rules,
        true,
      );
      if (res.kind === 'win') {
        record(res.profit - res.vig);
        break;
      }
      if (res.kind === 'lose') {
        record(-amount);
        break;
      }
      if (res.kind === 'push') break;
      if (res.kind === 'travel') {
        bet = { ...bet, point: res.point };
        continue;
      }
      if (phase === 'come-out' && [4, 5, 6, 8, 9, 10].includes(total)) {
        phase = 'point';
        point = total as PointNumber;
      }
    }
  }
  return { mean: sum / trials, meanSq: sumSq / trials };
}

describe('Monte Carlo agrees with exact EV', () => {
  const N = 200_000;
  it.each([
    ['pass-line', 1000, ctx('come-out', null)],
    ['dont-pass', 1000, ctx('come-out', null)],
    ['come', 1000, ctx('point', 6)],
    ['field', 500, ctx('point', 6)],
    ['place-5', 1000, ctx('point', 6)],
    ['buy-4', 2000, ctx('point', 6)],
    ['hard-8', 500, ctx('point', 6)],
    ['horn', 400, ctx('point', 6)],
  ] as const)('%s', (type, amount, c) => {
    const exact = toNumber(betEV({ type, amount, point: null }, c));
    const mc = simulate(type, amount, N, 12345).mean;
    // std of a single trial is at most ~amount*2; allow 4.5 sigma
    expect(Math.abs(mc - exact)).toBeLessThan((4.5 * amount * 1.5) / Math.sqrt(N));
  });
});

describe('Monte Carlo agrees with exact variance (sample variance within 5%)', () => {
  const N = 200_000;
  it.each([
    ['pass-line', 1000, ctx('come-out', null)],
    ['dont-pass', 1000, ctx('come-out', null)],
    ['come', 1000, ctx('point', 6)],
    ['field', 500, ctx('point', 6)],
    ['place-5', 1000, ctx('point', 6)],
    ['buy-4', 2000, ctx('point', 6)],
    ['hard-8', 500, ctx('point', 6)],
    ['horn', 400, ctx('point', 6)],
  ] as const)('%s', (type, amount, c) => {
    const exact = toNumber(betVariance({ type, amount, point: null }, c));
    const { mean, meanSq } = simulate(type, amount, N, 54321);
    const sample = meanSq - mean * mean;
    expect(Math.abs(sample - exact) / exact).toBeLessThan(0.05);
  });
});
