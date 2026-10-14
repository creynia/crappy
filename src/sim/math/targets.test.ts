import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, RULE_PRESETS } from '../engine/rules';
import type { BetTypeId, TableRules } from '../engine/types';
import { betEdge, betEV, betOutcomes } from './ev';
import { frac, type Fraction } from './fraction';
import { edgeTier } from './tiers';
import type { BetCtx } from './types';

const rules = (over: Partial<TableRules> = {}): TableRules => ({ ...DEFAULT_RULES, ...over });
const comeOut = (r = rules()): BetCtx => ({ phase: 'come-out', point: null, rules: r });
const onPoint = (p: 4 | 5 | 6 | 8 | 9 | 10, r = rules()): BetCtx => ({
  phase: 'point',
  point: p,
  rules: r,
});

function edge(type: BetTypeId, dollars: number, ctx: BetCtx = comeOut()) {
  return betEdge(type, dollars * 100, ctx);
}
const same = (a: Fraction, b: Fraction) => expect(a).toEqual(b);

describe('section 2.3 target numbers (per resolved / per roll)', () => {
  const cases: [BetTypeId, number, Fraction, Fraction][] = [
    ['pass-line', 10, frac(7, 495), frac(7, 1671)],
    ['come', 10, frac(7, 495), frac(7, 1671)],
    ['dont-pass', 10, frac(3, 220), frac(9, 2228)],
    ['dont-come', 10, frac(3, 220), frac(9, 2228)],
    ['place-6', 12, frac(1, 66), frac(1, 216)],
    ['place-8', 12, frac(1, 66), frac(1, 216)],
    ['place-5', 10, frac(1, 25), frac(1, 90)],
    ['place-9', 10, frac(1, 25), frac(1, 90)],
    ['place-4', 10, frac(1, 15), frac(1, 60)],
    ['place-10', 10, frac(1, 15), frac(1, 60)],
    ['buy-4', 20, frac(1, 60), frac(1, 240)],
    ['buy-10', 20, frac(1, 60), frac(1, 240)],
    ['buy-5', 20, frac(1, 50), frac(1, 180)],
    ['buy-9', 20, frac(1, 50), frac(1, 180)],
    ['buy-6', 20, frac(1, 44), frac(1, 144)],
    ['buy-8', 20, frac(1, 44), frac(1, 144)],
    ['lay-4', 40, frac(1, 60), frac(1, 240)],
    ['lay-10', 40, frac(1, 60), frac(1, 240)],
    ['lay-5', 30, frac(1, 50), frac(1, 180)],
    ['lay-9', 30, frac(1, 50), frac(1, 180)],
    ['lay-6', 24, frac(1, 44), frac(1, 144)],
    ['lay-8', 24, frac(1, 44), frac(1, 144)],
    ['field', 5, frac(1, 18), frac(1, 18)],
    ['big-6', 6, frac(1, 11), frac(1, 36)],
    ['big-8', 6, frac(1, 11), frac(1, 36)],
    ['hard-4', 5, frac(1, 9), frac(1, 36)],
    ['hard-10', 5, frac(1, 9), frac(1, 36)],
    ['hard-6', 5, frac(1, 11), frac(1, 36)],
    ['hard-8', 5, frac(1, 11), frac(1, 36)],
    ['any-7', 5, frac(1, 6), frac(1, 6)],
    ['any-craps', 5, frac(1, 9), frac(1, 9)],
    ['yo-11', 5, frac(1, 9), frac(1, 9)],
    ['ace-deuce-3', 5, frac(1, 9), frac(1, 9)],
    ['aces-2', 1, frac(5, 36), frac(5, 36)],
    ['boxcars-12', 1, frac(5, 36), frac(5, 36)],
    ['horn', 4, frac(1, 8), frac(1, 8)],
    ['c-e', 2, frac(1, 9), frac(1, 9)],
    ['world', 5, frac(2, 15), frac(2, 15)],
  ];
  it.each(cases)('%s $%i', (type, dollars, perResolved, perRoll) => {
    const e = edge(type, dollars);
    same(e.perResolved, perResolved);
    same(e.perRoll, perRoll);
  });

  it('field 3x on 12 is 1/36', () => {
    const e = edge('field', 5, comeOut(rules(RULE_PRESETS['field-3x-12'])));
    same(e.perResolved, frac(1, 36));
  });

  it('dont-pass excluding push is 27/1925', () => {
    same(edge('dont-pass', 10).perResolvedExPush, frac(27, 1925));
  });

  it('line bets take 557/165 rolls', () => {
    same(edge('pass-line', 10).expectedRolls, frac(557, 165));
  });

  it('upfront vig uses bet+vig as base', () => {
    const up = comeOut(rules({ vig: { ...DEFAULT_RULES.vig, timing: 'upfront' } }));
    same(edge('buy-4', 20, up).perResolved, frac(1, 21));
    same(edge('lay-4', 40, up).perResolved, frac(1, 41));
    same(edge('lay-5', 30, up).perResolved, frac(1, 31));
    same(edge('lay-6', 24, up).perResolved, frac(1, 25));
  });

  it('odds have no edge', () => {
    same(edge('pass-odds', 30, onPoint(4)).perResolved, frac(0));
    same(edge('pass-odds', 40, onPoint(5)).perResolved, frac(0));
    same(edge('pass-odds', 50, onPoint(6)).perResolved, frac(0));
    same(edge('dont-pass-odds', 60, onPoint(4)).perResolved, frac(0));
    same(edge('dont-pass-odds', 60, onPoint(5)).perResolved, frac(0));
    same(edge('dont-pass-odds', 60, onPoint(6)).perResolved, frac(0));
  });
});

describe('exact facts', () => {
  it('P(pass wins) = 244/495', () => {
    const rows = betOutcomes({ type: 'pass-line', amount: 1000, point: null }, comeOut());
    const win = rows
      .filter((r) => r.net.n > 0n)
      .reduce((a, r) => a + Number(r.probability.n) / Number(r.probability.d), 0);
    expect(win).toBeCloseTo(244 / 495, 12);
    expect(
      rows.reduce((a, r) => a + Number(r.probability.n) / Number(r.probability.d), 0),
    ).toBeCloseTo(1, 12);
  });
  it('contract value of a flat bet on a point (cents per $1 = per 100c)', () => {
    const val = (type: BetTypeId, p: 4 | 5 | 6) =>
      betEV({ type, amount: 100, point: null }, onPoint(p));
    same(val('pass-line', 4), frac(-100, 3));
    same(val('pass-line', 5), frac(-20));
    same(val('pass-line', 6), frac(-100, 11));
    same(val('dont-pass', 4), frac(100, 3));
    same(val('dont-pass', 5), frac(20));
    same(val('dont-pass', 6), frac(100, 11));
  });
  it('dont-pass $10 with point 4 is worth +$3.33', () => {
    same(betEV({ type: 'dont-pass', amount: 1000, point: null }, onPoint(4)), frac(1000, 3));
  });
  it('tiers match the design', () => {
    const t = (type: BetTypeId, d: number, c = comeOut()) => edgeTier(edge(type, d, c).perResolved);
    expect(t('pass-odds', 30, onPoint(4))).toBe('free');
    expect(t('pass-line', 10)).toBe('good');
    expect(t('place-6', 12)).toBe('good');
    expect(t('buy-4', 20)).toBe('good');
    expect(t('buy-6', 20)).toBe('fair');
    expect(t('place-5', 10)).toBe('fair');
    expect(t('place-4', 10)).toBe('poor');
    expect(t('field', 5)).toBe('poor');
    expect(t('field', 5, comeOut(rules(RULE_PRESETS['field-3x-12'])))).toBe('fair');
    expect(t('big-6', 6)).toBe('avoid');
    expect(t('hard-6', 5)).toBe('avoid');
    expect(t('any-7', 5)).toBe('avoid');
    expect(t('horn', 4)).toBe('avoid');
  });
});
