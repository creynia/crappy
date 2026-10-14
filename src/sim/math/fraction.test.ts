import { describe, expect, it } from 'vitest';
import { add, cmp, div, frac, mul, neg, roundToInt, sub, toNumber } from './fraction';
import { edgeTier } from './tiers';

describe('Fraction', () => {
  it('normalizes', () => {
    expect(frac(2, -4)).toEqual({ n: -1n, d: 2n });
    expect(frac(0, 7)).toEqual({ n: 0n, d: 1n });
  });
  it('does arithmetic exactly', () => {
    expect(add(frac(1, 3), frac(1, 6))).toEqual(frac(1, 2));
    expect(sub(frac(1, 3), frac(1, 2))).toEqual(frac(-1, 6));
    expect(mul(frac(2, 3), frac(3, 4))).toEqual(frac(1, 2));
    expect(div(frac(1, 2), frac(1, 4))).toEqual(frac(2));
    expect(neg(frac(1, 2))).toEqual(frac(-1, 2));
    expect(cmp(frac(1, 3), frac(1, 2))).toBe(-1);
    expect(cmp(frac(2, 4), frac(1, 2))).toBe(0);
    expect(toNumber(frac(1, 4))).toBe(0.25);
    expect(roundToInt(frac(-5, 2))).toBe(-3n);
    expect(() => div(frac(1), frac(0))).toThrow();
  });
});

describe('edgeTier boundaries', () => {
  it.each([
    [frac(-1, 100), 'free'],
    [frac(0), 'free'],
    [frac(1, 100), 'good'],
    [frac(2, 100), 'good'],
    [frac(201, 10000), 'fair'],
    [frac(5, 100), 'fair'],
    [frac(501, 10000), 'poor'],
    [frac(899, 10000), 'poor'],
    [frac(9, 100), 'avoid'],
    [frac(1, 6), 'avoid'],
  ] as const)('%#', (edge, tier) => {
    expect(edgeTier(edge)).toBe(tier);
  });
});
