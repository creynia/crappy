import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, RULE_PRESETS } from '../engine/rules';
import type { BetTypeId, TableRules } from '../engine/types';
import { betEdge, betEV, betOutcomes, betStdDev, betVariance, perRollVariance } from './ev';
import { add, frac, mul, sub, type Fraction } from './fraction';
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

  it('bonus side bets (I037): Fire 20.763%, Small/Tall 7.761%, All 7.464%', () => {
    same(edge('small', 1).perResolved, frac(1687, 21736));
    same(edge('tall', 1).perResolved, frac(1687, 21736));
    same(edge('all', 1).perResolved, frac(10207263466n, 136745788725n));
    expect(
      Number(edge('fire', 1).perResolved.n) / Number(edge('fire', 1).perResolved.d),
    ).toBeCloseTo(0.2076275, 7);
    expect(edgeTier(edge('fire', 1).perResolved)).toBe('avoid');
    expect(edgeTier(edge('small', 1).perResolved)).toBe('poor');
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

describe('exact variance (cents^2; $1 = 10000)', () => {
  // Reference: field $1 (2:1 on 2 and 12, 1:1 on 3 4 9 10 11, lose 5 6 7 8), summed over 36 dice.
  const fieldNet = (t: number) =>
    t === 2 || t === 12 ? 200 : [3, 4, 9, 10, 11].includes(t) ? 100 : -100;
  const fieldRef = (() => {
    let ev = frac(0);
    let m2 = frac(0);
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        const net = fieldNet(a + b);
        ev = add(ev, frac(net, 36));
        m2 = add(m2, frac(net * net, 36));
      }
    }
    return { ev, var: sub(m2, mul(ev, ev)) };
  })();

  it('pass-line $1 from come-out: Var = 1 - (7/495)^2 dollars^2', () => {
    const c = { phase: 'come-out', point: null, rules: DEFAULT_RULES } as BetCtx;
    same(
      betVariance({ type: 'pass-line', amount: 100, point: null }, c),
      frac(10000n * 244976n, 245025n),
    );
    expect(betStdDev({ type: 'pass-line', amount: 100, point: null }, c)).toBeCloseTo(99.99, 2);
  });

  it('field $1 matches the 36-outcome reference loop (377/324 dollars^2)', () => {
    const c = comeOut();
    same(fieldRef.var, frac(3770000, 324));
    same(betEV({ type: 'field', amount: 100, point: null }, c), fieldRef.ev);
    same(betVariance({ type: 'field', amount: 100, point: null }, c), fieldRef.var);
  });

  it('any-7 $1 at 4:1: EV -1/6, Var = 125/36 dollars^2', () => {
    const c = comeOut();
    same(betEV({ type: 'any-7', amount: 100, point: null }, c), frac(-50, 3));
    same(betVariance({ type: 'any-7', amount: 100, point: null }, c), frac(312500, 9));
  });

  it('place-6 $6 conditional on resolution: EV -1/11, Var = 5070/121 dollars^2', () => {
    const c = onPoint(6);
    same(betEV({ type: 'place-6', amount: 600, point: null }, c), frac(-100, 11));
    same(betVariance({ type: 'place-6', amount: 600, point: null }, c), frac(50700000, 121));
  });

  it('pass-odds $1 on 4 (2:1): EV 0, Var = 2 dollars^2', () => {
    const c = onPoint(4);
    same(betEV({ type: 'pass-odds', amount: 100, point: null }, c), frac(0));
    same(betVariance({ type: 'pass-odds', amount: 100, point: null }, c), frac(20000));
  });

  it('perRollVariance: one-roll bets that resolve every roll equal betVariance', () => {
    const c = comeOut();
    same(perRollVariance({ type: 'field', amount: 100, point: null }, c), frac(3770000, 324));
    same(perRollVariance({ type: 'any-7', amount: 100, point: null }, c), frac(312500, 9));
  });

  it('perRollVariance on pass-line with point 6, $1: 246875/81 cents^2', () => {
    // per roll: win 5/36 (+100c), lose 6/36 (-100c), else 0 -> E = -100/36, Var = 11/36*10^4 - (100/36)^2
    same(
      perRollVariance({ type: 'pass-line', amount: 100, point: 6 }, onPoint(6)),
      frac(246875, 81),
    );
  });

  it('perRollVariance counts the non-resolving rolls as zero: place-6 $6 = 16595/1296 dollars^2', () => {
    same(
      perRollVariance({ type: 'place-6', amount: 600, point: null }, onPoint(6)),
      frac(10371875, 81),
    );
  });

  it('rejects come-out line bets', () => {
    expect(() =>
      perRollVariance(
        { type: 'pass-line', amount: 100, point: null },
        {
          phase: 'come-out',
          point: null,
          rules: DEFAULT_RULES,
        },
      ),
    ).toThrow(/several rolls/);
  });
});

describe('crapless craps (rules.variant crapless)', () => {
  const cr = rules(RULE_PRESETS.crapless);
  const crComeOut = comeOut(cr);
  const crOn = (p: 2 | 3 | 4 | 5 | 6 | 8 | 9 | 10 | 11 | 12): BetCtx => ({
    phase: 'point',
    point: p,
    rules: cr,
  });

  it('pass and come edge is exactly 373/6930 (5.382%), P(win) 6557/13860', () => {
    for (const t of ['pass-line', 'come'] as BetTypeId[]) {
      const e = edge(t, 10, crComeOut);
      same(e.perResolved, frac(373, 6930));
      same(e.expectedRolls, frac(9613, 2310));
      same(e.perRoll, frac(373, 28839));
    }
    expect(Number(frac(373, 6930).n) / Number(frac(373, 6930).d)).toBeCloseTo(0.05382, 5);
    const rows = betOutcomes({ type: 'pass-line', amount: 1000, point: null }, crComeOut);
    const win = rows
      .filter((r) => r.net.n > 0n)
      .reduce((a, r) => a + Number(r.probability.n) / Number(r.probability.d), 0);
    expect(win).toBeCloseTo(6557 / 13860, 12);
  });

  it('place 2/12 (11 to 2) is 1/14 = 7.14%, place 3/11 (11 to 4) is 1/16 = 6.25%', () => {
    same(edge('place-2', 10, crComeOut).perResolved, frac(1, 14));
    same(edge('place-12', 10, crComeOut).perResolved, frac(1, 14));
    same(edge('place-3', 20, crComeOut).perResolved, frac(1, 16));
    same(edge('place-11', 20, crComeOut).perResolved, frac(1, 16));
  });

  it('odds have no edge on every crapless point (6 to 1 on 2/12, 3 to 1 on 3/11)', () => {
    for (const p of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] as const) {
      same(betEV({ type: 'pass-odds', amount: 3000, point: p }, crOn(p)), frac(0));
      same(betEV({ type: 'come-odds', amount: 3000, point: p }, crOn(p)), frac(0));
    }
  });

  it('standard-rules numbers are untouched by the variant', () => {
    same(edge('pass-line', 10).perResolved, frac(7, 495));
  });
});
