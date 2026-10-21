import type { Action, Bet, GameState, PointNumber, TableRules } from '../engine';
import { betEdge, lossPerRoll, toNumber } from '../math';
import { POINT_PHASE_SHARE, offOnComeOut } from '../math/ev';
import { isLineLike } from '../math/outcomes';
import { getImpl } from './presets';
import type { StrategyMetrics, StrategySpec } from './types';

/** P(each point is established) given a decision of a line/come bet, in 36ths. */
const POINT_WAYS: Record<PointNumber, number> = { 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3 };

/**
 * Expected odds wagered per decision, as a multiple of the flat bet, when odds are always taken at the table
 * maximum: sum over points of P(point) x max multiple. 3-4-5x gives 100/36; 6x lay gives 4.
 */
export function oddsMultiplePerDecision(
  rules: TableRules,
  lay: boolean,
  mult: number = Infinity,
): number {
  let t = 0;
  for (const n of [4, 5, 6, 8, 9, 10] as PointNumber[])
    t += (POINT_WAYS[n] / 36) * Math.min(mult, lay ? rules.maxLayOdds[n] : rules.maxOdds[n]);
  return t;
}

/** Odds on the table as a multiple of the flat bet once a point is set (average over the point). */
function oddsOnTableMultiple(rules: TableRules, lay: boolean, mult: number): number {
  return oddsMultiplePerDecision(rules, lay, mult) / (24 / 36);
}

const POINTS: PointNumber[] = [4, 5, 6, 8, 9, 10];
const NON_POINT_ROLLS = [2, 3, 7, 11, 12];
const WAYS: Record<number, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

/**
 * Long-run rates of the three-point Molly (pass plus up to two come bets, one come in the box at a time,
 * placed only in the point phase), from the exact Markov chain over (point, come numbers, boxed come):
 * flat bets resolved per roll, and odds resolved per roll for each number (odds are returned, not
 * resolved, when a 7 hits come bets on a come-out roll). Independent of the rules and the unit.
 */
interface MollyRates {
  flatPerRoll: number;
  oddsPerRoll: Record<PointNumber, number>;
}
let mollyCache: MollyRates | undefined;
function mollyRates(): MollyRates {
  if (mollyCache) return mollyCache;
  type S = { p: number; cs: number[]; box: boolean };
  const key = (x: S) => `${x.p}|${x.cs.join(',')}|${x.box ? 1 : 0}`;
  const index = new Map<string, number>();
  const states: S[] = [];
  const add = (x: S): number => {
    const k = key(x);
    let i = index.get(k);
    if (i === undefined) {
      i = states.length;
      index.set(k, i);
      states.push(x);
    }
    return i;
  };
  add({ p: 0, cs: [], box: false });
  const edges: Array<Array<{ to: number; pr: number; flat: number; odds: number[] }>> = [];
  for (let i = 0; i < states.length; i++) {
    const x = states[i]!;
    const out: (typeof edges)[number] = [];
    for (let t = 2; t <= 12; t++) {
      const odds = [0, 0, 0, 0, 0, 0]; // by POINTS index
      let flat = 0;
      const cs: number[] = [];
      for (const n of x.cs) {
        if (t === 7 || t === n) {
          flat++;
          if (!(t === 7 && x.p === 0)) odds[POINTS.indexOf(n as PointNumber)]!++;
        } else cs.push(n);
      }
      let box = x.box;
      if (box) {
        if (NON_POINT_ROLLS.includes(t)) flat++;
        else cs.push(t);
        box = false;
      }
      let p = x.p;
      if (p === 0) {
        if (NON_POINT_ROLLS.includes(t)) flat++;
        else p = t;
      } else if (t === 7 || t === p) {
        flat++;
        odds[POINTS.indexOf(x.p as PointNumber)]!++;
        p = 0;
      }
      if (p !== 0 && cs.length < 2 && !box) box = true;
      cs.sort((a, b) => a - b);
      out.push({ to: add({ p, cs, box }), pr: WAYS[t]! / 36, flat, odds });
    }
    edges.push(out);
  }
  const n = states.length;
  let v = new Float64Array(n).fill(1 / n);
  for (let it = 0; it < 3000; it++) {
    const w = new Float64Array(n);
    for (let i = 0; i < n; i++) for (const e of edges[i]!) w[e.to]! += v[i]! * e.pr;
    v = w;
  }
  let flatPerRoll = 0;
  const oddsPerRoll = { 4: 0, 5: 0, 6: 0, 8: 0, 9: 0, 10: 0 } as Record<PointNumber, number>;
  for (let i = 0; i < n; i++)
    for (const e of edges[i]!) {
      flatPerRoll += v[i]! * e.pr * e.flat;
      POINTS.forEach((pt, k) => (oddsPerRoll[pt] += v[i]! * e.pr * e.odds[k]!));
    }
  mollyCache = { flatPerRoll, oddsPerRoll };
  return mollyCache;
}

const COME_NUMBERS: PointNumber[] = [8, 5, 9, 10, 4];

/** Apply place-bet actions without validation, to materialize the strategy's steady layout. */
function materialize(state: GameState, actions: Action[]): GameState {
  const bets: Bet[] = state.bets.slice();
  let nextBetId = state.nextBetId;
  for (const a of actions) {
    if (a.type !== 'place-bet') continue;
    bets.push({
      id: `b${nextBetId++}`,
      type: a.betType,
      amount: a.amount,
      point: null,
      parentId: a.parentId ?? null,
      working: 'auto',
      placedOnRoll: 0,
      vigPaid: 0,
    });
  }
  // travel come bets to distinct numbers; odds inherit their parent's point
  const used = new Set<PointNumber>();
  for (const b of bets) if (b.point !== null) used.add(b.point);
  for (const b of bets) {
    if ((b.type === 'come' || b.type === 'dont-come') && b.point === null) {
      const n = COME_NUMBERS.find((x) => !used.has(x));
      if (n !== undefined) {
        used.add(n);
        b.point = n;
      }
    }
  }
  for (const b of bets) {
    if (b.parentId) {
      const p = bets.find((x) => x.id === b.parentId);
      if (p) b.point = p.point ?? state.point;
    }
  }
  return { ...state, bets, nextBetId };
}

/** The strategy's steady-state layout in the point phase (point 6), built via its own `decide`. */
function steadyState(
  spec: StrategySpec,
  rules: TableRules,
): { state: GameState; comeOutIds: Set<string> } {
  const impl = getImpl(spec.id);
  let s = {
    version: 1,
    rules,
    phase: 'come-out',
    point: null,
    bankroll: 100_000_000,
    bets: [],
    rollCount: 0,
    history: [],
    rng: { s: [1, 2, 3, 4] },
    seed: 0,
    forcedDice: [],
    nextBetId: 1,
    stats: { totalWagered: 0, totalWon: 0, totalLost: 0, totalVig: 0, expectedLoss: 0, byType: {} },
  } as GameState;
  s = materialize(s, impl.decide(s, spec));
  // bets the strategy puts up before the point is set: they are up on come-out rolls too
  const comeOutIds = new Set(s.bets.map((b) => b.id));
  s = { ...s, phase: 'point', point: 6 };
  for (let i = 0; i < 4; i++) {
    const acts = impl.decide(s, spec);
    if (acts.length === 0) break;
    s = materialize(s, acts);
  }
  return { state: s, comeOutIds };
}

/**
 * Analytic cost of keeping the strategy's layout up (see simulator.md 2.4). Everything is per roll OVERALL,
 * come-outs included: bets that are off on the come-out (place, buy, hardways) work only 392/557 of rolls,
 * and line bets are amortized over whole decisions. The edge is per dollar of action, per decision.
 */
export function strategyMetrics(spec: StrategySpec, rules: TableRules): StrategyMetrics {
  const r = rules;
  const { state, comeOutIds } = steadyState(spec, r);
  const ctx = { phase: 'point' as const, point: 6 as PointNumber, rules: r };
  let lossCents = 0;
  let action = 0; // dollars per roll (overall)
  let onTable = 0; // dollars once the point is set, odds averaged over the point
  // Odds multiple actually taken at this layout's point, as 'Infinity' when it is the table maximum.
  const oddsMult = (b: Bet, parent: Bet, lay: boolean): number => {
    const cap = (lay ? r.maxLayOdds : r.maxOdds)[b.point ?? 6];
    const m = parent.amount > 0 ? b.amount / parent.amount : 0;
    return m >= cap - 1e-9 ? Infinity : m;
  };
  const molly = spec.id === 'three-point-molly';
  for (const b of state.bets) {
    if (b.type.endsWith('-odds')) {
      const parent = state.bets.find((x) => x.id === b.parentId);
      if (!parent) continue;
      const lay = b.type === 'dont-pass-odds' || b.type === 'dont-come-odds';
      const mult = oddsMult(b, parent, lay);
      onTable += (parent.amount / 100) * oddsOnTableMultiple(r, lay, mult);
      if (molly) continue; // priced from the chain below
      // odds are wagered once per decision of their flat bet: the amount depends on the point made
      const e = betEdge(parent.type, parent.amount, { phase: 'come-out', point: null, rules: r });
      action +=
        (parent.amount * oddsMultiplePerDecision(r, lay, mult)) / 100 / toNumber(e.expectedRolls);
      continue;
    }
    onTable += b.amount / 100;
    if (molly) continue;
    const line = isLineLike(b.type);
    const bctx = line ? { phase: 'come-out' as const, point: null, rules: r } : ctx;
    const e = betEdge(b.type, b.amount, bctx);
    // bets placed only after a point, or off on the come-out, work 392/557 of rolls
    const share =
      !line && (!comeOutIds.has(b.id) || offOnComeOut(b.type, r)) ? toNumber(POINT_PHASE_SHARE) : 1;
    lossCents += toNumber(lossPerRoll(b, ctx)) * share;
    action += (b.amount / 100 / toNumber(e.expectedRolls)) * share;
  }
  if (molly) {
    const pass = state.bets.find((b) => b.type === 'pass-line');
    const passOdds = state.bets.find((b) => b.type === 'pass-odds');
    if (pass) {
      const rates = mollyRates();
      const mult = passOdds ? oddsMult(passOdds, pass, false) : 0;
      const e = betEdge('pass-line', pass.amount, { phase: 'come-out', point: null, rules: r });
      lossCents = rates.flatPerRoll * pass.amount * toNumber(e.perResolved);
      action = rates.flatPerRoll * (pass.amount / 100);
      for (const n of POINTS)
        action += rates.oddsPerRoll[n] * (pass.amount / 100) * Math.min(mult, r.maxOdds[n]);
    }
  }
  const expectedLossPerRoll = lossCents / 100;
  return {
    edgeOnAction: action > 0 ? expectedLossPerRoll / action : 0,
    expectedLossPerRoll,
    rollsPerDollar: expectedLossPerRoll > 0 ? 1 / expectedLossPerRoll : Infinity,
    avgAction: onTable,
  };
}
