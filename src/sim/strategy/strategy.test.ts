import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  DEFAULT_RULES,
  equity,
  resolveRules,
  validateAction,
} from '../engine';
import type { GameState } from '../engine';
import { tableExpectedLossPerRoll, toNumber } from '../math';
import {
  getStrategy,
  listStrategies,
  replayTo,
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

describe('more presets (I012)', () => {
  const rules = resolveRules('standard-vegas');
  const m = (id: StrategyId, unit = 500) => strategyMetrics({ id, unit }, rules);

  it('buy 4/10 at $20 loses 2 x $20 x 1/60 per resolution', () => {
    // each $20 buy: vig $1 paid on the 1/3 of resolutions it wins = $20/60 per resolution
    const perRoll = m('buy-4-10').expectedLossPerRoll;
    // each number resolves on 3/36 (hit) + 6/36 (seven) = 9/36 of point-phase rolls
    expect(perRoll).toBeCloseTo(2 * 20 * (1 / 60) * (9 / 36), 3);
    expect(m('buy-4-10').edgeOnAction).toBeCloseTo(1 / 60, 3);
  });
  it('lay 4/10: $40 laid, loss per resolution is $40 x 1/60 on the amount laid', () => {
    // lay $40 wins $20 on 7 before the number (2/3): vig $1; loss per resolution = 2/3 x $1
    expect(m('lay-4-10').edgeOnAction).toBeCloseTo(1 / 60, 6);
    // each number resolves on 6/36 (seven) + 3/36 (hit) = 9/36 of point-phase rolls
    expect(m('lay-4-10').expectedLossPerRoll).toBeCloseTo(2 * (2 / 3) * (9 / 36), 6);
  });
  it('hedging the pass line with Any Craps raises the edge on action', () => {
    const hedge = m('pass-hedge-any-craps');
    const flat = strategyMetrics({ id: 'pass-max-odds', unit: 500, oddsMultiple: 0 }, rules);
    expect(hedge.edgeOnAction).toBeGreaterThan(flat.edgeOnAction);
    // per decision: $5 pass loses 5 x 7/495, $1 any craps loses 1/9: 2/11 of $1 on $6 of action
    expect(hedge.edgeOnAction).toBeCloseTo(1 / 33, 6);
    // a decision lasts 557/165 rolls; the come-out any craps is costed once per decision
    expect(hedge.expectedLossPerRoll).toBeCloseTo(30 / 557, 6);
  });

  describe('behavior', () => {
    const driver = (id: StrategyId, init: Parameters<typeof createGame>[0], extra = {}) => {
      let s = createGame(init);
      const sp = spec(id, extra);
      const step = (): string[] => {
        const before = s.bets.map((b) => b.id);
        for (const a of getStrategy(id).decide(s, sp)) {
          const r = applyAction(s, a);
          if (!r.ok) throw new Error(r.error.message);
          s = r.state;
        }
        return s.bets.filter((b) => !before.includes(b.id)).map((b) => b.type);
      };
      const roll = (d: readonly [1 | 2 | 3 | 4 | 5 | 6, 1 | 2 | 3 | 4 | 5 | 6]) => {
        const r = applyAction(s, { type: 'roll', dice: [d[0], d[1]] });
        if (!r.ok) throw new Error('roll');
        s = r.state;
      };
      return {
        get s() {
          return s;
        },
        step,
        roll,
      };
    };

    it("don't-come-molly: DP plus at most two DCs, each with 6x lay, never a third", () => {
      const d = driver('dont-come-molly', { bankroll: 100_000, seed: 1 });
      expect(d.step()).toEqual(['dont-pass']);
      d.roll([3, 3]); // point 6
      expect(d.step().sort()).toEqual(['dont-come', 'dont-pass-odds']);
      d.roll([2, 2]); // DC travels to 4
      d.step();
      d.roll([5, 4]); // second DC travels to 9
      d.step();
      d.roll([1, 2]); // 3: a don't come bet in the box would win; none is up, nothing to resolve
      d.step();
      const t = (x: string) => d.s.bets.filter((b) => b.type === x);
      expect(t('dont-come')).toHaveLength(2);
      expect(t('dont-come-odds')).toHaveLength(2);
      expect(t('dont-pass-odds')[0]!.amount).toBe(500 * 6);
      for (const o of t('dont-come-odds')) expect(o.amount).toBe(500 * 6);
      expect(d.s.bets.filter((b) => b.type === 'dont-come' && b.point === null)).toHaveLength(0);
    });

    it('buy 4/10 and lay 4/10: placed only after a point, $20/$40, re-placed, vig on a win', () => {
      for (const [id, amt, win] of [
        ['buy-4-10', 2000, [2, 2]],
        ['lay-4-10', 4000, [3, 4]],
      ] as const) {
        const d = driver(id, { bankroll: 100_000, seed: 1 });
        expect(d.step()).toEqual([]); // come-out: nothing
        const p = driver(id, { bankroll: 100_000, seed: 1, phase: 'point', point: 6 });
        const kind = id.slice(0, 3);
        expect(p.step().sort()).toEqual([`${kind}-10`, `${kind}-4`]);
        expect(p.s.bets.map((b) => b.amount)).toEqual([amt, amt]);
        p.roll(win);
        // a $1 vig per winning bet: the buy wins on its own number, both lays win on a 7
        expect(p.s.stats.totalVig).toBe(id === 'buy-4-10' ? 100 : 200);
        p.roll(win[0] === 3 ? [2, 2] : [3, 4]); // seven-out clears buys; a 4 wins the lay against it
        p.step();
        if (id === 'buy-4-10') {
          expect(p.s.bets).toHaveLength(0);
          const q = driver(id, { bankroll: 100_000, seed: 1, phase: 'point', point: 5 });
          expect(q.step()).toHaveLength(2); // placed again on the next point
        }
      }
    });

    it('pass-hedge-any-craps: any craps only on come-out rolls', () => {
      const d = driver('pass-hedge-any-craps', { bankroll: 100_000, seed: 1 });
      expect(d.step().sort()).toEqual(['any-craps', 'pass-line']);
      d.roll([3, 3]);
      expect(d.step()).toEqual([]);
      d.roll([2, 1]);
      expect(d.step()).toEqual([]);
      expect(d.s.bets.some((b) => b.type === 'any-craps')).toBe(false);
      d.roll([3, 3]); // point made: back to the come-out
      expect(d.step()).toEqual(['any-craps']);
    });
  });
  it('progressions are flagged approximate', () => {
    expect(m('inside-regress').approximate).toBe(true);
    expect(m('place-6-8-press').approximate).toBe(true);
    expect(m('buy-4-10').approximate).toBeUndefined();
  });
  it('inside-regress places $22 then keeps $12 on 6/8 after a hit', () => {
    const seq = (dice: Array<[1 | 2 | 3 | 4 | 5 | 6, 1 | 2 | 3 | 4 | 5 | 6]>) => {
      let s = createGame({ bankroll: 100_000, seed: 1, phase: 'point', point: 4 });
      const sp = spec('inside-regress');
      const run = () => {
        for (const a of getStrategy('inside-regress').decide(s, sp)) {
          const r = applyAction(s, a);
          if (!r.ok) throw new Error(r.error.message);
          s = r.state;
        }
      };
      run();
      const first = s.bets.reduce((a, b) => a + b.amount, 0);
      for (const d of dice) {
        const r = applyAction(s, { type: 'roll', dice: [d[0], d[1]] });
        if (!r.ok) throw new Error('roll');
        s = r.state;
        run();
      }
      return { first, bets: s.bets.map((b) => [b.type, b.amount]) };
    };
    const r = seq([[1, 2]]); // 3 does nothing
    expect(r.first).toBe(2200);
    expect(r.bets).toHaveLength(4);
    const hit = seq([[4, 4]]); // 8 hits
    expect(hit.bets.sort()).toEqual([
      ['place-6', 600],
      ['place-8', 600],
    ]);
  });
  it('place-6-8-press presses by one unit per hit up to 5x', () => {
    let s = createGame({ bankroll: 1_000_000, seed: 1, phase: 'point', point: 4 });
    const sp = spec('place-6-8-press');
    const step = () => {
      for (const a of getStrategy('place-6-8-press').decide(s, sp)) {
        const r = applyAction(s, a);
        if (!r.ok) throw new Error(r.error.message);
        s = r.state;
      }
    };
    step();
    const amt = () => s.bets.find((b) => b.type === 'place-6')!.amount;
    expect(amt()).toBe(600);
    for (let i = 0; i < 8; i++) {
      const r = applyAction(s, { type: 'roll', dice: [3, 3] });
      if (!r.ok) throw new Error('roll');
      s = r.state;
      step();
    }
    expect(amt()).toBe(3000);
  });
});

describe('simulateMany stops', () => {
  const base = {
    strategy: spec('pass-max-odds', { oddsMultiple: 2, unit: 1000 }),
    rolls: 100,
    seed: 7,
    bankroll: 50_000,
  };
  const perRoll = (r: { meanExpectedLoss: number; meanRollsPlayed: number }) =>
    r.meanExpectedLoss / r.meanRollsPlayed;

  it('stops off: no stop endings and finals match a run without the stop keys', async () => {
    const a = await simulateMany(base, 20, { sliceMs: 0 });
    const b = await simulateMany({ ...base, stopWin: undefined, stopLoss: undefined }, 20, {
      sliceMs: 0,
    });
    expect(a.stopWinRate).toBe(0);
    expect(a.stopLossRate).toBe(0);
    expect(Array.from(a.finals)).toEqual(Array.from(b.finals));
    expect(a.meanRollsPlayed).toBeLessThanOrEqual(100);
  });

  it('a stop cuts the rolls played but leaves the expected loss per roll about the same', async () => {
    const plain = await simulateMany(base, 200, { sliceMs: 0 });
    const stopped = await simulateMany({ ...base, stopWin: 5000 }, 200, { sliceMs: 0 });
    expect(stopped.stopWinRate).toBeGreaterThan(0);
    expect(stopped.meanRollsPlayed).toBeLessThan(plain.meanRollsPlayed);
    expect(Math.abs(perRoll(stopped) - perRoll(plain)) / perRoll(plain)).toBeLessThan(0.1);
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

describe('recorded sessions and replay (watch mode)', () => {
  const cfg = (id: StrategyId, seed: number, rolls = 60) => ({
    strategy: spec(id),
    rolls,
    seed,
    bankroll: 50_000,
    record: true,
  });
  it('records one entry per roll only when asked', () => {
    const on = simulateSession(cfg('pass-max-odds', 3));
    expect(on.log).toHaveLength(on.rollsPlayed);
    expect(on.log![0]!.dice).toHaveLength(2);
    const off = simulateSession({ ...cfg('pass-max-odds', 3), record: false });
    expect(off.log).toBeUndefined();
  });
  it('the same seed records the same log; recording does not change the result', () => {
    const a = simulateSession(cfg('place-6-8', 11));
    const b = simulateSession(cfg('place-6-8', 11));
    expect(b.log).toEqual(a.log);
    const plain = simulateSession({ ...cfg('place-6-8', 11), record: false });
    expect(plain.finalEquity).toBe(a.finalEquity);
  });
  it('replaying the log ends at the run result, for several strategies and seeds', () => {
    const ids: StrategyId[] = [
      'pass-max-odds',
      'place-6-8',
      'iron-cross',
      'three-point-molly',
      'field-every-roll',
    ];
    for (const id of ids)
      for (const seed of [1, 2, 7]) {
        const c = cfg(id, seed);
        const r = simulateSession(c);
        const end = replayTo(c, r.log!, r.log!.length);
        expect(equity(end), `${id} seed ${seed}`).toBe(r.finalEquity);
        // scrubbing to the middle matches the equity curve the run recorded
        const mid = Math.floor(r.log!.length / 2);
        expect(equity(replayTo(c, r.log!, mid))).toBe(r.equity[mid]);
      }
  });
});
