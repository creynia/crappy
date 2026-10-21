import { describe, expect, it } from 'vitest';
import { resolveRules } from '../engine';
import type { Bet } from '../engine/types';
import { exposureIsApproximate, exposureOf, maxExposure } from './metrics';

const std = resolveRules('standard-vegas');
const odds100 = resolveRules('odds-100x');

const bet = (over: Partial<Bet> & Pick<Bet, 'id' | 'type' | 'amount'>): Bet => ({
  point: null,
  parentId: null,
  working: 'auto',
  placedOnRoll: 0,
  vigPaid: 0,
  ...over,
});

describe('maxExposure: preset steady layouts (I057)', () => {
  it('pass + 2x odds is 3 units ($100 unit)', () => {
    expect(maxExposure({ id: 'pass-2x-odds', unit: 10_000 }, std)).toBe(30_000);
  });

  it('pass-max-odds is 6 units under 3-4-5x (the table maximum at 6 or 8), $100 unit', () => {
    expect(maxExposure({ id: 'pass-max-odds', unit: 10_000 }, std)).toBe(60_000);
  });

  it('pass-max-odds under 100x odds rules is 101 units ($100 unit)', () => {
    expect(maxExposure({ id: 'pass-max-odds', unit: 10_000 }, odds100)).toBe(1_010_000);
  });

  it('a lay strategy carries lay odds, not pass odds ($100 unit)', () => {
    const lay = maxExposure({ id: 'dont-pass-max-lay', unit: 10_000 }, std);
    expect(lay).toBeGreaterThan(10_000);
    expect(lay % 10_000).toBe(0);
  });

  it('place and buy bets count their own amount', () => {
    expect(maxExposure({ id: 'place-6-8', unit: 600 }, std)).toBeGreaterThanOrEqual(600);
    expect(maxExposure({ id: 'buy-4-10', unit: 500 }, std)).toBeGreaterThanOrEqual(500);
  });

  it('a flat one-roll bet is exactly its unit ($100)', () => {
    expect(maxExposure({ id: 'field-every-roll', unit: 10_000 }, std)).toBe(10_000);
  });

  it('martingale is approximate: it counts the starting bet only', () => {
    expect(exposureIsApproximate({ id: 'martingale-pass', unit: 10_000 })).toBe(true);
    expect(exposureIsApproximate({ id: 'pass-max-odds', unit: 10_000 })).toBe(false);
  });
});

describe('exposureOf on a live layout (I057)', () => {
  it('a $25 pass line with $1 odds is $26 out, not $150', () => {
    const bets = [
      bet({ id: 'b1', type: 'pass-line', amount: 2500, point: 6 }),
      bet({ id: 'b2', type: 'pass-odds', amount: 100, parentId: 'b1', point: 6 }),
    ];
    expect(exposureOf(bets)).toBe(2600);
  });

  it('come bets with odds count the come chips and the odds placed behind them', () => {
    const bets = [
      bet({ id: 'c1', type: 'come', amount: 1000, point: 8 }),
      bet({ id: 'c2', type: 'come-odds', amount: 3000, point: 8, parentId: 'c1' }),
    ];
    expect(exposureOf(bets)).toBe(4000);
  });

  it("lay odds on a don't side count as placed", () => {
    const bets = [
      bet({ id: 'd1', type: 'dont-pass', amount: 500, point: 4 }),
      bet({ id: 'd2', type: 'dont-pass-odds', amount: 1000, point: 4, parentId: 'd1' }),
    ];
    expect(exposureOf(bets)).toBe(1500);
  });

  it('empty table is zero', () => {
    expect(exposureOf([])).toBe(0);
  });
});
