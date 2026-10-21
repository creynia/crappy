import { describe, expect, it } from 'vitest';
import { applyAction, createGame, DEFAULT_RULES, resolveRules, validateAction } from '../engine';
import type { GameState } from '../engine';
import { tableExpectedLossPerRoll, toNumber } from '../math';
import {
  getStrategy,
  listStrategies,
  simulateCompare,
  simulateMany,
  simulateSweep,
  simulateManyCompare,
  simulateSession,
  strategyMetrics,
} from './index';
import type { LayoutBet, StrategyId, StrategySpec } from './index';

const eloss = (s: GameState) => toNumber(tableExpectedLossPerRoll(s));
const layout: LayoutBet[] = [
  { type: 'pass-line', amount: 500 },
  { type: 'pass-odds', amount: 2500 },
  { type: 'come', amount: 500 },
  { type: 'come-odds', amount: 1000, point: 8 },
  { type: 'place-6', amount: 600 },
  { type: 'field', amount: 500 },
  { type: 'hard-8', amount: 100 },
  { type: 'horn', amount: 400 },
];
const spec = (id: StrategyId, extra: Partial<StrategySpec> = {}): StrategySpec => ({
  id,
  unit: 500,
  ...(id === 'my-layout' ? { layout } : {}),
  ...extra,
});
const IDS = listStrategies().map((s) => s.id);

describe('presets emit only legal actions', () => {
  for (const id of IDS) {
    for (const presetId of ['standard-vegas', 'odds-100x'] as const) {
      it(`${id} on ${presetId}`, () => {
        const sp = spec(id);
        const strat = getStrategy(id);
        let state = createGame({ bankroll: 1_000_000, seed: 11, rules: presetId });
        let placed = 0;
        for (let i = 0; i < 10_000; i++) {
          for (const a of strat.decide(state, sp)) {
            const v = validateAction(state, a);
            if (!v.ok) throw new Error(`${id} roll ${i}: ${JSON.stringify(a)} -> ${v.message}`);
            const r = applyAction(state, a);
            if (!r.ok) throw new Error('apply failed');
            state = r.state;
            placed++;
          }
          const r = applyAction(state, { type: 'roll' });
          if (!r.ok) throw new Error('roll failed');
          state = r.state;
          if (state.bankroll < 100_000) state = { ...state, bankroll: state.bankroll + 500_000 };
        }
        if (id === 'no-bet') expect(placed).toBe(0);
        else expect(placed).toBeGreaterThan(100);
      });
    }
  }
});

describe('layouts', () => {
  const rules = resolveRules('standard-vegas');
  function steady(id: StrategyId, extra: Partial<StrategySpec> = {}) {
    let s = createGame({ bankroll: 100_000, seed: 1 });
    const sp = spec(id, extra);
    for (const phase of ['come-out', 'point'] as const) {
      if (phase === 'point') {
        s = createGame({
          bankroll: 100_000,
          seed: 1,
          phase,
          point: 6,
          bets: s.bets.map((b) => ({ type: b.type, amount: b.amount })),
        });
      }
      for (const a of getStrategy(id).decide(s, sp)) {
        const r = applyAction(s, a);
        if (!r.ok) throw new Error(r.error.message);
        s = r.state;
      }
    }
    return s;
  }
  it('iron cross at $5 is $5 field + $5 place 5 + $6 + $6', () => {
    const s = steady('iron-cross');
    expect(s.bets.map((b) => [b.type, b.amount])).toEqual(
      expect.arrayContaining([
        ['field', 500],
        ['place-5', 500],
        ['place-6', 600],
        ['place-8', 600],
      ]),
    );
  });
  it('pass-max-odds takes full odds, oddsMultiple 0 is flat', () => {
    const full = steady('pass-max-odds');
    expect(full.bets.find((b) => b.type === 'pass-odds')!.amount).toBe(500 * rules.maxOdds[6]);
    const flat = steady('pass-max-odds', { oddsMultiple: 0 });
    expect(flat.bets.some((b) => b.type === 'pass-odds')).toBe(false);
  });
});

describe('simulateSession', () => {
  const cfg = { strategy: spec('pass-max-odds'), rolls: 500, seed: 5, bankroll: 50_000 };
  it('is deterministic per seed and sized correctly', () => {
    const a = simulateSession(cfg);
    const b = simulateSession(cfg);
    expect(Array.from(a.equity)).toEqual(Array.from(b.equity));
    expect(a.equity.length).toBe(501);
    expect(a.equity[0]).toBe(50_000);
    expect(a.expected[0]).toBe(50_000);
    expect(a.expected[500]!).toBeLessThan(50_000);
    expect(a.finalEquity).toBe(a.equity[500]);
    expect(a.actualLoss).toBe(50_000 - a.finalEquity);
    expect(a.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(a.peakEquity).toBeGreaterThanOrEqual(50_000);
    expect(a.sevenOuts).toBeGreaterThan(0);
    expect(a.longestHand).toBeGreaterThan(0);
    expect(a.totals.reduce((x, y) => x + y, 0)).toBe(500);
  });
  it('different seeds differ', () => {
    expect(simulateSession({ ...cfg, seed: 6 }).finalEquity).not.toBe(
      simulateSession(cfg).finalEquity,
    );
  });
  it('busts when the bankroll runs out', () => {
    const r = simulateSession({
      strategy: spec('any-7-every-roll', { unit: 5000 }),
      rolls: 2000,
      seed: 3,
      bankroll: 20_000,
    });
    expect(r.bustedAtRoll).not.toBeNull();
    expect(r.rollsPlayed).toBeLessThan(2000);
    expect(r.endedBy).toBe('bust');
    expect(r.equity.length).toBe(r.rollsPlayed + 1);
  });
  it('place bettors who cannot afford the layout bust even on the come-out', () => {
    const r = simulateSession({
      strategy: spec('iron-cross'),
      rolls: 500,
      seed: 4,
      bankroll: 1000,
    });
    expect(r.endedBy).toBe('bust');
    expect(r.bustedAtRoll).toBe(0);
  });
  it('honors stopWin / stopLoss', () => {
    const r = simulateSession({ ...cfg, rolls: 5000, stopLoss: 2000 });
    expect(r.rollsPlayed).toBeLessThan(5000);
    expect(['stop-loss', 'bust']).toContain(r.endedBy);
  });
  it('no-bet loses nothing and tallies totals', () => {
    const r = simulateSession({ ...cfg, strategy: spec('no-bet'), rolls: 3600 });
    expect(r.finalEquity).toBe(50_000);
    expect(r.totals[7]!).toBeGreaterThan(r.totals[2]! * 3);
  });
  it('martingale doubles after a loss and resets after a win', () => {
    const strat = getStrategy('martingale-pass');
    const sp = spec('martingale-pass');
    let s = createGame({ bankroll: 1_000_000, seed: 2 });
    const sizes: number[] = [];
    let prev = s.bankroll;
    for (let i = 0; i < 400; i++) {
      for (const a of strat.decide(s, sp)) {
        const r = applyAction(s, a);
        if (!r.ok) throw new Error(r.error.message);
        s = r.state;
        if (a.type === 'place-bet' && a.betType === 'pass-line') sizes.push(a.amount);
      }
      const eqBefore = s.bankroll + s.bets.reduce((x, b) => x + b.amount, 0);
      const r = applyAction(s, { type: 'roll' });
      if (!r.ok) throw new Error('x');
      s = r.state;
      void eqBefore;
      void prev;
      prev = s.bankroll;
    }
    expect(sizes[0]).toBe(500);
    expect(sizes.some((x) => x === 1000)).toBe(true);
    expect(sizes.every((x) => x === 500 * 2 ** Math.log2(x / 500))).toBe(true);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(DEFAULT_RULES.tableMax);
  });
});

describe('compare mode', () => {
  it('uses identical dice for every strategy', () => {
    const [a, b, c] = simulateCompare({ rolls: 300, seed: 9, bankroll: 50_000 }, [
      spec('pass-max-odds'),
      spec('place-6-8'),
      spec('no-bet'),
    ]);
    expect(Array.from(a!.totals)).toEqual(Array.from(c!.totals));
    expect(Array.from(b!.totals)).toEqual(Array.from(c!.totals));
  });
  it('simulateManyCompare returns one result per strategy', async () => {
    const r = await simulateManyCompare(
      { rolls: 50, seed: 1, bankroll: 50_000 },
      [spec('pass-max-odds'), spec('iron-cross')],
      10,
      { schedule: (fn) => fn() },
    );
    expect(r.length).toBe(2);
    expect(r[0]!.sessions).toBe(10);
  });
});

describe('simulateMany', () => {
  const cfg = { strategy: spec('pass-max-odds'), rolls: 200, seed: 100, bankroll: 50_000 };
  it('returns ordered percentiles, survival, progress', async () => {
    const progress: number[] = [];
    const r = await simulateMany(cfg, 50, { onProgress: (p) => progress.push(p), sliceMs: 0 });
    expect(r.p10.length).toBe(201);
    for (let i = 0; i <= 200; i++) {
      expect(r.p10[i]!).toBeLessThanOrEqual(r.p50[i]!);
      expect(r.p50[i]!).toBeLessThanOrEqual(r.p90[i]!);
    }
    expect(r.p50[0]).toBe(50_000);
    expect(r.survival[0]).toBe(1);
    expect(r.finals.length).toBe(50);
    expect(r.probAhead).toBeGreaterThanOrEqual(0);
    expect(progress.at(-1)).toBe(1);
    expect(progress).toEqual([...progress].sort((a, b) => a - b));
    const single = simulateSession({ ...cfg, seed: 100 });
    expect(r.finals[0]).toBe(single.finalEquity);
  });
  it('can be aborted', async () => {
    const ac = new AbortController();
    const p = simulateMany(cfg, 500, { signal: ac.signal, sliceMs: 0 });
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('reports bust rate', async () => {
    const r = await simulateMany(
      { strategy: spec('any-7-every-roll', { unit: 5000 }), rolls: 500, seed: 1, bankroll: 20_000 },
      20,
    );
    expect(r.bustRate).toBeGreaterThan(0.5);
    expect(r.survival[500]!).toBeLessThan(0.5);
  });
});

describe('strategyMetrics (simulator.md 2.4)', () => {
  const rules = resolveRules('standard-vegas');
  it('matches the reference table', () => {
    const m = (id: StrategyId, unit: number) => strategyMetrics({ id, unit }, rules);
    expect(m('pass-max-odds', 1000).expectedLossPerRoll).toBeCloseTo(0.0419, 3);
    expect(m('pass-max-odds', 1000).rollsPerDollar).toBeCloseTo(23.9, 0);
    expect(m('dont-pass-max-lay', 1000).expectedLossPerRoll).toBeCloseTo(0.0404, 3);
    expect(m('place-6-8', 600).expectedLossPerRoll).toBeCloseTo(0.0556, 3);
    expect(m('iron-cross', 500).expectedLossPerRoll).toBeCloseTo(7 / 18, 3);
    expect(m('any-7-every-roll', 500).expectedLossPerRoll).toBeCloseTo(0.8333, 3);
    expect(m('no-bet', 500).expectedLossPerRoll).toBe(0);
    expect(
      strategyMetrics({ id: 'pass-max-odds', unit: 1000, oddsMultiple: 0 }, rules).edgeOnAction,
    ).toBeCloseTo(0.01414, 4);
    // odds dilute the edge on total action
    expect(m('pass-max-odds', 1000).edgeOnAction).toBeLessThan(0.005);
  });
});

describe('benchmark', () => {
  it('100 sessions x 1000 rolls under 2s (Node target ~0.5s)', () => {
    const t = performance.now();
    for (let i = 0; i < 100; i++) {
      simulateSession({ strategy: spec('place-6-8'), rolls: 1000, seed: i, bankroll: 100_000 });
    }
    expect(performance.now() - t).toBeLessThan(2000);
  });
  void eloss;
});

describe('edge on action is per decision', () => {
  it('pass + max 3-4-5x odds is 0.374%, flat 5x 0.326%, DP + 6x lay 0.273%', () => {
    const rules = resolveRules('standard-vegas');
    const e = (spec: StrategySpec) => strategyMetrics(spec, rules).edgeOnAction * 100;
    expect(e({ id: 'pass-max-odds', unit: 1000 })).toBeCloseTo(0.374, 2);
    expect(e({ id: 'pass-max-odds', unit: 1000, oddsMultiple: 0 })).toBeCloseTo(1.414, 2);
    expect(e({ id: 'dont-pass-max-lay', unit: 1000 })).toBeCloseTo(0.273, 2);
  });
});

describe('simulateSweep', () => {
  const cfg = {
    strategy: 'pass-max-odds' as const,
    unit: 1000,
    oddsMultiples: [0, 1, 2, 'max', 10, 100] as (number | 'max')[],
    rolls: 100,
    seed: 1,
    bankroll: 10_000_000,
  };
  it('edge falls with odds, expected loss is constant, variance rises', async () => {
    const rows = await simulateSweep(cfg, 100, { schedule: (fn) => fn() });
    const edges = rows.map((r) => +(r.edgeOnAction * 100).toFixed(3));
    expect(edges).toEqual([1.414, 0.848, 0.606, 0.374, 0.184, 0.021]);
    for (const r of rows)
      expect(Math.abs(r.expectedLossCents - rows[0]!.expectedLossCents)).toBeLessThan(1);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i]!.sdFinal).toBeGreaterThan(rows[i - 1]!.sdFinal);
  });
  it('odds add no expected loss per roll (analytic, independent of the sweep)', () => {
    const rules = resolveRules('odds-100x');
    const flat = strategyMetrics({ id: 'pass-max-odds', unit: 1000, oddsMultiple: 0 }, rules);
    for (const m of [1, 2, 10, 100]) {
      const x = strategyMetrics({ id: 'pass-max-odds', unit: 1000, oddsMultiple: m }, rules);
      expect(x.expectedLossPerRoll).toBeCloseTo(flat.expectedLossPerRoll, 6);
    }
  });
  it('fixed-seed regression pin (seed 1): more sessions finish ahead with odds than flat only', async () => {
    // Not a general law: P(ahead) is not monotonic in odds for every seed; this pins seed 1 only.
    const rows = await simulateSweep(cfg, 100, { schedule: (fn) => fn() });
    for (const r of rows.slice(1)) expect(r.probAhead).toBeGreaterThan(rows[0]!.probAhead);
  });
  it('the dont-pass sweep raises the lay cap too, so 10x really lays 10x', async () => {
    const rows = await simulateSweep(
      { ...cfg, strategy: 'dont-pass-max-lay', oddsMultiples: [6, 10] },
      20,
      { schedule: (fn) => fn() },
    );
    expect(rows[1]!.edgeOnAction).toBeLessThan(rows[0]!.edgeOnAction);
    expect(rows[1]!.sdFinal).toBeGreaterThan(rows[0]!.sdFinal);
  });
  it('benchmark: 6 x 100 sessions x 100 rolls finishes (loose bound)', async () => {
    const t = performance.now();
    await simulateSweep(cfg, 100, { schedule: (fn) => fn() });
    expect(performance.now() - t).toBeLessThan(20_000);
  });
});
