import { describe, expect, it } from 'vitest';
import { BET_TYPES } from '../engine/bets';
import { DEFAULT_RULES } from '../engine/rules';
import type { Bet, BetTypeId, Dice, Die, PointNumber } from '../engine/types';
import {
  atsEV,
  atsExpectedRolls,
  atsWinProb,
  bonusDistribution,
  fireEV,
  fireExpectedRolls,
  firePointsDistribution,
} from './bonus';
import { ways } from './dice';
import { betEdge, betEV } from './ev';
import { add, frac, mul, sub, toNumber, ONE, ZERO, type Fraction } from './fraction';
import { edgeTier } from './tiers';

const same = (a: Fraction, b: Fraction) => expect(a).toEqual(b);
const big = (n: string, d: string): Fraction => frac(BigInt(n), BigInt(d));

/** Inclusion-exclusion cross-check: P(all of `set` roll before a 7) = sum_U (-1)^|U| 6/(6 + ways(U)). */
function raceByInclusionExclusion(set: number[]): Fraction {
  let p = ZERO;
  const n = set.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    let w = 0;
    let bits = 0;
    for (let i = 0; i < n; i++)
      if (mask & (1 << i)) {
        w += ways(set[i]!);
        bits++;
      }
    const term = frac(6, 6 + w);
    p = bits % 2 === 0 ? add(p, term) : sub(p, term);
  }
  return p;
}

describe('Fire Bet (exact Markov over subsets of points)', () => {
  const d = firePointsDistribution();
  it('P(k distinct points) matches the published values', () => {
    same(d[0]!, frac(98, 165));
    same(d[1]!, frac(78834, 302335));
    same(d[2]!, big('1970803095086', '19459848690711'));
    expect(toNumber(d[3]!)).toBeCloseTo(0.033434212, 9);
    expect(toNumber(d[4]!)).toBeCloseTo(0.008798178, 9);
    expect(toNumber(d[5]!)).toBeCloseTo(0.001639933, 9);
    expect(toNumber(d[6]!)).toBeCloseTo(0.000162435, 9);
    same(
      d.reduce((a, x) => add(a, x), ZERO),
      ONE,
    );
  });
  it('edge is 20.763% at 24/249/999 and 19.70% at 25/250/1000', () => {
    expect(toNumber(fireEV())).toBeCloseTo(-0.2076275, 7);
    expect(toNumber(fireEV([], { 4: 25, 5: 250, 6: 1000 }))).toBeCloseTo(-0.197027, 6);
  });
  it('progress changes the value: 5 points made is a big favourite', () => {
    const five = firePointsDistribution([4, 5, 6, 8, 9]);
    expect(toNumber(five[5]!)).toBeGreaterThan(0.8);
    expect(toNumber(fireEV([4, 5, 6, 8, 9]))).toBeGreaterThan(200);
    // a point counted twice is still one point
    same(firePointsDistribution([4, 4, 5])[0]!, ZERO);
    expect(firePointsDistribution([4, 4, 5])).toEqual(firePointsDistribution([5, 4]));
  });
  it('expected rolls is just under the average hand length (1671/196): 6 points pays early', () => {
    expect(toNumber(fireExpectedRolls())).toBeCloseTo(8.524125, 5);
    expect(toNumber(fireExpectedRolls())).toBeLessThan(1671 / 196);
    same(fireExpectedRolls([4, 5, 6, 8, 9, 10]), ZERO);
  });
});

describe('All / Tall / Small (exact)', () => {
  it('P(hit) matches the published values and inclusion-exclusion', () => {
    same(atsWinProb('small'), frac(20049, 760760));
    same(atsWinProb('tall'), frac(20049, 760760));
    same(atsWinProb('all'), big('126538525259', '24067258815600'));
    same(atsWinProb('small'), raceByInclusionExclusion([2, 3, 4, 5, 6]));
    same(atsWinProb('all'), raceByInclusionExclusion([2, 3, 4, 5, 6, 8, 9, 10, 11, 12]));
    expect(toNumber(atsWinProb('small'))).toBeCloseTo(0.026354, 6);
    expect(toNumber(atsWinProb('all'))).toBeCloseTo(0.005258, 6);
  });
  it('edges: 7.761% / 7.464% at 34:1 / 175:1; 18.30% / 20.61% at 30:1 / 150:1', () => {
    same(atsEV('small'), frac(-1687, 21736));
    same(atsEV('tall'), frac(-1687, 21736));
    same(atsEV('all'), big('-10207263466', '136745788725'));
    expect(toNumber(atsEV('small'))).toBeCloseTo(-0.07761, 5);
    expect(toNumber(atsEV('all'))).toBeCloseTo(-0.07464, 5);
    expect(toNumber(atsEV('small', [], 30))).toBeCloseTo(-0.18303, 5);
    expect(toNumber(atsEV('all', [], 150))).toBeCloseTo(-0.20609, 5);
  });
  it('progress: with one number left the chance is ways/(ways + 6)', () => {
    same(atsWinProb('small', [2, 3, 4, 5]), frac(5, 11));
    same(atsWinProb('tall', [9, 10, 11, 12]), frac(5, 11));
    same(atsExpectedRolls('small', [2, 3, 4, 5]), frac(36, 11));
    same(atsWinProb('small', [2, 3, 4, 5, 6]), ONE);
    // numbers outside the set are ignored
    same(atsWinProb('small', [8, 9]), atsWinProb('small'));
  });
});

describe('bonus bets through the generic EV machinery', () => {
  const ctx = { phase: 'come-out' as const, point: null, rules: DEFAULT_RULES };
  it('betEdge per resolved matches the direct EV; tiers follow the edge scheme', () => {
    same(betEdge('fire', 100, ctx).perResolved, mul(frac(-1), fireEV()));
    same(betEdge('small', 100, ctx).perResolved, frac(1687, 21736));
    same(betEdge('all', 500, ctx).perResolved, mul(frac(-1), atsEV('all')));
    expect(edgeTier(betEdge('fire', 100, ctx).perResolved)).toBe('avoid');
    expect(edgeTier(betEdge('small', 100, ctx).perResolved)).toBe('poor');
    expect(edgeTier(betEdge('all', 100, ctx).perResolved)).toBe('poor');
  });
  it('betEV honours progress and the amount', () => {
    same(
      betEV({ type: 'small', amount: 500, point: null, progress: [2, 3, 4, 5] }, ctx),
      frac(500 * (34 * 5 - 6), 11),
    );
    expect(bonusDistribution('fire', 100, [4, 5, 6, 8]).rows.map((r) => r.label)).toContain(
      'Never happens',
    );
    const rows = bonusDistribution('tall', 100, undefined).rows;
    same(
      rows.reduce((a, r) => add(a, r.probability), ZERO),
      ONE,
    );
  });
});

// ---- Monte Carlo: play whole hands through the registry's resolve() with a seeded RNG ----
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const die = (r: () => number): Die => (1 + Math.floor(r() * 6)) as Die;

function simulateHands(type: BetTypeId, amount: number, hands: number, seed: number) {
  const r = lcg(seed);
  const def = BET_TYPES[type];
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < hands; i++) {
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
    let phase: 'come-out' | 'point' = 'come-out';
    let point: PointNumber | null = null;
    let net: number | null = null;
    while (net === null) {
      const dice: Dice = [die(r), die(r)];
      const total = dice[0] + dice[1];
      const res = def.resolve(
        bet,
        { dice, total, hard: dice[0] === dice[1], phase, point },
        DEFAULT_RULES,
        true,
      );
      if (res.kind === 'win') net = res.profit;
      else if (res.kind === 'lose') net = -amount;
      else if (res.kind === 'advance') bet = { ...bet, progress: res.progress };
      if (phase === 'come-out') {
        if ([4, 5, 6, 8, 9, 10].includes(total)) {
          phase = 'point';
          point = total as PointNumber;
        }
      } else if (total === point || total === 7) {
        phase = 'come-out';
        point = null;
      }
    }
    sum += net;
    sumSq += net * net;
  }
  const mean = sum / hands;
  const sd = Math.sqrt(Math.max(0, sumSq / hands - mean * mean));
  return { mean, se: sd / Math.sqrt(hands) };
}

describe('Monte Carlo over 200k hands agrees with the exact EV (4 sigma)', () => {
  const N = 200_000;
  it.each([
    ['fire', fireEV()],
    ['small', atsEV('small')],
    ['all', atsEV('all')],
  ] as const)('%s', (type, ev) => {
    const exact = toNumber(ev) * 100;
    const mc = simulateHands(type, 100, N, 20251021);
    expect(Math.abs(mc.mean - exact)).toBeLessThan(4 * mc.se + 1e-9);
  });
});
