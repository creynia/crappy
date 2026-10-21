import { describe, expect, it } from 'vitest';
import {
  MIN_SAMPLES,
  exactProbability,
  rollTotals,
  scanStreaks,
  wilson,
  type StreakCondition,
} from './streaks';

const CONDITIONS: [string, StreakCondition][] = [
  ['after 1 seven', { kind: 'sevens', n: 1 }],
  ['after 2 sevens in a row', { kind: 'sevens', n: 2 }],
  ['after 15 rolls without a 6', { kind: 'drought', total: 6, n: 15 }],
  ['after 2 points made in a row', { kind: 'points', n: 2 }],
];

describe('exact probabilities', () => {
  it('7 is 1/6, 6 is 5/36, the next point is made 201/495 of the time', () => {
    expect(exactProbability('seven')).toEqual({ n: 1n, d: 6n });
    expect(exactProbability('six')).toEqual({ n: 5n, d: 36n });
    const p = exactProbability('point');
    expect(Number(p.n) / Number(p.d)).toBeCloseTo(201 / 495, 10);
  });
});

describe('scanStreaks', () => {
  it('is deterministic per seed and counts the rolls', () => {
    const a = scanStreaks({ seed: 3, rolls: 20_000, condition: CONDITIONS[1]![1] });
    const b = scanStreaks({ seed: 3, rolls: 20_000, condition: CONDITIONS[1]![1] });
    expect(a).toEqual(b);
    expect(a.rolls).toBe(20_000);
    expect(rollTotals(3, 100)).toEqual(rollTotals(3, 100));
  });

  for (const [name, condition] of CONDITIONS) {
    it(`${name}: what follows is within 4 sigma of the exact chance (dice have no memory)`, () => {
      const r = scanStreaks({ seed: 11, rolls: 100_000, condition });
      for (const stat of Object.values(r.stats)) {
        expect(stat.samples).toBeGreaterThan(200);
        expect(Math.abs(stat.z!)).toBeLessThan(4);
        expect(stat.hits).toBeLessThanOrEqual(stat.samples);
        // the interval is built from what was seen and contains the observed frequency
        expect(stat.ci![0]).toBeLessThanOrEqual(stat.frequency! + 1e-9);
        expect(stat.ci![1]).toBeGreaterThanOrEqual(stat.frequency!);
      }
    });
  }

  it('counts a longer streak once and reports the sample size', () => {
    const r = scanStreaks({ seed: 5, rolls: 100_000, condition: { kind: 'sevens', n: 1 } });
    // about 1/6 of rolls are 7s; non-overlapping 1-streaks start after every non-7 -> 7 transition
    expect(r.stats.seven.samples).toBeGreaterThan(8000);
    expect(r.stats.seven.samples).toBeLessThan(17_000);
  });

  it('scans 100k rolls in under 500 ms', () => {
    const t0 = performance.now();
    scanStreaks({ seed: 1, rolls: 100_000, condition: { kind: 'sevens', n: 2 } });
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('an empty condition has no frequency', () => {
    const r = scanStreaks({ seed: 1, rolls: 50, condition: { kind: 'sevens', n: 6 } });
    expect(r.stats.seven.frequency).toBeNull();
    expect(r.stats.seven.z).toBeNull();
  });

  it('Wilson interval stays sensible for tiny samples (0 of 3 is not 0% to 0%)', () => {
    const [lo, hi] = wilson(0, 3);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(0.5);
    const [l2, h2] = wilson(500, 1000);
    expect(l2).toBeLessThan(0.5);
    expect(h2).toBeGreaterThan(0.5);
    const r = scanStreaks({ seed: 1, rolls: 100_000, condition: { kind: 'sevens', n: 5 } });
    expect(r.stats.seven.enough).toBe(r.stats.seven.samples >= MIN_SAMPLES);
    expect(r.stats.seven.ci![1]).toBeGreaterThan(0.05);
  });
});
