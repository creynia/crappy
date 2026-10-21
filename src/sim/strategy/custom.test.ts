import { describe, expect, it } from 'vitest';
import { applyAction, createGame, resolveRules } from '../engine';
import type { GameState, PointNumber } from '../engine';
import {
  PRESETS_AS_CUSTOM,
  customPlan,
  decodeCustom,
  encodeCustom,
  validateCustom,
} from './custom';
import { strategyMetrics } from './metrics';
import { simulateMany, simulateSession } from './simulate';
import type { CustomSystem, StrategyId } from './types';

const ids = Object.keys(PRESETS_AS_CUSTOM) as StrategyId[];

describe('golden equivalence: presets re-expressed as custom systems play identically', () => {
  const REQUIRED: StrategyId[] = [
    'pass-max-odds',
    'three-point-molly',
    'place-6-8',
    'iron-cross',
    'martingale-pass',
  ];
  it('covers the five required presets', () => {
    for (const id of REQUIRED) expect(PRESETS_AS_CUSTOM[id]).toBeDefined();
  });
  it.each(ids)(
    '%s',
    (id) => {
      const custom = PRESETS_AS_CUSTOM[id]!;
      expect(validateCustom(custom)).toEqual([]);
      for (const [unit, seed, bankroll, rules] of [
        [500, 1, 50_000, undefined],
        [1000, 7, 20_000, 'odds-10x'],
        [2500, 42, 100_000, undefined],
        [3000, 99, 15_000, 'field-3x-12'],
        [500, 2024, 3_000, undefined], // small bankroll: busts and caps
      ] as const) {
        const base = { rolls: 2000, seed, bankroll, ...(rules ? { rules } : {}) };
        const preset = simulateSession({ ...base, strategy: { id, unit } });
        const mine = simulateSession({ ...base, strategy: { id: 'custom', unit, custom } });
        expect(mine).toEqual(preset);
      }
    },
    60_000,
  );
});

// ---- fuzz: random valid systems never emit an action the engine rejects ----
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const POINTS: PointNumber[] = [4, 5, 6, 8, 9, 10];

function randomSystem(r: () => number): CustomSystem {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const odds = () => pick([0, 1, 2, 3, 5, 'max'] as const);
  const c: CustomSystem = {};
  if (r() < 0.7) c.line = { side: pick(['pass', 'dont'] as const), odds: odds() };
  if (c.line && r() < 0.5) c.come = { count: 1 + Math.floor(r() * 3), odds: odds() };
  if (r() < 0.6 || !c.line) {
    const kind = pick(['place', 'buy', 'lay'] as const);
    const ns = POINTS.filter(() => r() < 0.5);
    if (ns.length === 0) ns.push(pick(POINTS));
    c.numbers = { kind, bets: ns.map((n) => ({ n, units: pick([0.5, 1, 1.2, 2, 3]) })) };
    if (kind !== 'lay' && r() < 0.4) {
      c.onWin =
        r() < 0.5 || ns.length < 2
          ? { kind: 'press', units: 1 + Math.floor(r() * 2), capTimes: 2 + Math.floor(r() * 6) }
          : { kind: 'regress', keep: ns.slice(0, ns.length - 1) };
    }
  }
  if (r() < 0.3) c.field = { units: pick([1, 2]) };
  if (c.line?.side === 'pass' && !c.come && r() < 0.3)
    c.onLoss = { kind: 'martingale', maxDoublings: 1 + Math.floor(r() * 6) };
  return c;
}

describe('fuzz: random valid systems x 5000 rolls', () => {
  it('never produce a rejected action', () => {
    const r = rng(13);
    for (let k = 0; k < 40; k++) {
      const custom = randomSystem(r);
      expect(validateCustom(custom)).toEqual([]);
      const rules = resolveRules(
        k % 3 === 0
          ? 'odds-10x'
          : k % 3 === 1
            ? undefined
            : { vig: { rate: 0.05, timing: 'upfront', rounding: 'floor-dollar-min-1' } },
      );
      const spec = { id: 'custom' as const, unit: [500, 1000, 2500][k % 3]!, custom };
      let state: GameState = createGame({ seed: 100 + k, bankroll: 1_000_000, rules });
      for (let i = 0; i < 5000; i++) {
        for (const a of customPlan(state, spec).actions) {
          const res = applyAction(state, a);
          if (!res.ok)
            throw new Error(
              `${JSON.stringify(custom)} roll ${i}: ${JSON.stringify(a)} -> ${res.error.message}`,
            );
          state = res.state;
        }
        // skip the exact expected-loss bookkeeping: this test is about legality only
        const res = applyAction(state, { type: 'roll' }, { expectedLossFn: () => 0 });
        if (!res.ok) throw new Error(res.error.message);
        state = res.state;
      }
    }
  });
});

describe('custom systems: metrics, stops, validation, URL', () => {
  const rules = resolveRules();
  it.each(ids)('metrics of the custom %s equal the preset (structural chains, I040)', (id) => {
    for (const r of [
      rules,
      resolveRules('odds-10x'),
      resolveRules({ comeOddsWorkOnComeOut: true }),
    ]) {
      const a = strategyMetrics({ id, unit: 1000 }, r);
      const b = strategyMetrics({ id: 'custom', unit: 1000, custom: PRESETS_AS_CUSTOM[id]! }, r);
      expect(b.edgeOnAction).toBeCloseTo(a.edgeOnAction, 12);
      expect(b.expectedLossPerRoll).toBeCloseTo(a.expectedLossPerRoll, 12);
      expect(b.avgAction).toBeCloseTo(a.avgAction, 12);
      expect(!!b.approximate).toBe(!!a.approximate);
    }
  });
  it('a Molly with come odds unlike the line odds is approximate', () => {
    const m = strategyMetrics(
      {
        id: 'custom',
        unit: 1000,
        custom: { line: { side: 'pass', odds: 'max' }, come: { count: 2, odds: 1 } },
      },
      rules,
    );
    expect(m.approximate).toBe(true);
  });
  it('a one-come Molly uses the chain with one come bet', () => {
    const one = strategyMetrics(
      {
        id: 'custom',
        unit: 1000,
        custom: { line: { side: 'pass', odds: 'max' }, come: { count: 1, odds: 'max' } },
      },
      rules,
    );
    const two = strategyMetrics({ id: 'three-point-molly', unit: 1000 }, rules);
    expect(one.approximate).toBeUndefined();
    expect(one.expectedLossPerRoll).toBeLessThan(two.expectedLossPerRoll);
  });
  it('a progression marks the edge as approximate (simulated)', () => {
    const m = strategyMetrics(
      { id: 'custom', unit: 1000, custom: PRESETS_AS_CUSTOM['martingale-pass']! },
      rules,
    );
    expect(m.approximate).toBe(true);
  });
  it("the system's own stop-win / stop-loss end the session", async () => {
    const custom: CustomSystem = {
      line: { side: 'pass', odds: 'max' },
      stopWin: 2000,
      stopLoss: 2000,
    };
    const m = await simulateMany(
      { rolls: 1000, seed: 3, bankroll: 50_000, strategy: { id: 'custom', unit: 1000, custom } },
      50,
    );
    expect(m.stopWinRate + m.stopLossRate).toBeGreaterThan(0.9);
    // a stop set on the run wins over the system's own
    const r = simulateSession({
      rolls: 300,
      seed: 3,
      bankroll: 50_000,
      stopWin: 1_000_000,
      stopLoss: 1_000_000,
      strategy: { id: 'custom', unit: 1000, custom },
    });
    expect(r.endedBy).toBe('rolls');
  });
  it('rejects malformed systems with readable errors', () => {
    expect(validateCustom({})).toEqual([
      'custom: needs at least one bet: a line bet, numbers or the field',
    ]);
    expect(validateCustom({ come: { count: 2, odds: 'max' } })).toContain(
      'custom.come: needs a line bet',
    );
    expect(
      validateCustom({
        line: { side: 'dont', odds: 2 },
        onLoss: { kind: 'martingale', maxDoublings: 5 },
      }),
    ).toEqual(['custom.onLoss: Martingale needs a pass line bet']);
    expect(
      validateCustom({
        numbers: { kind: 'lay', bets: [{ n: 4, units: 1 }] },
        onWin: { kind: 'press', units: 1, capTimes: 3 },
      }),
    ).toContain('custom.onWin: lay bets win on a 7, so they cannot be pressed on a hit');
    expect(
      validateCustom({
        numbers: {
          kind: 'place',
          bets: [
            { n: 6, units: 1 },
            { n: 6, units: 1 },
            { n: 7, units: 1 },
          ],
        },
      }),
    ).toEqual([
      'custom.numbers.bets[1].n: is listed twice',
      'custom.numbers.bets[2].n: must be 4, 5, 6, 8, 9 or 10',
    ]);
    expect(validateCustom({ line: { side: 'pass', odds: 'max' }, extra: 1 })).toEqual([
      'custom.extra: unknown key',
    ]);
  });
  it('round-trips through a URL-safe string and rejects garbage', () => {
    for (const c of Object.values(PRESETS_AS_CUSTOM)) {
      const s = encodeCustom(c);
      expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(decodeCustom(s)).toEqual(c);
    }
    expect(decodeCustom('not base64!')).toBeNull();
    expect(decodeCustom(encodeCustom({}))).toBeNull();
    expect(decodeCustom(null)).toBeNull();
  });
});
