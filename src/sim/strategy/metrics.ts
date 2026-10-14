import type { Action, Bet, BetTypeId, GameState, PointNumber, TableRules } from '../engine';
import { betEdge, tableExpectedLossPerRoll, toNumber } from '../math';
import { getImpl } from './presets';
import type { StrategyMetrics, StrategySpec } from './types';

const COME_NUMBERS: PointNumber[] = [8, 5, 9, 10, 4];
const LINE_TYPES: ReadonlySet<BetTypeId> = new Set<BetTypeId>([
  'pass-line',
  'dont-pass',
  'come',
  'dont-come',
]);

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
function steadyState(spec: StrategySpec, rules: TableRules): GameState {
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
  s = { ...s, phase: 'point', point: 6 };
  for (let i = 0; i < 4; i++) {
    const acts = impl.decide(s, spec);
    if (acts.length === 0) break;
    s = materialize(s, acts);
  }
  return s;
}

/** Analytic cost of keeping the strategy's layout up (see simulator.md §2.4). */
export function strategyMetrics(spec: StrategySpec, rules: TableRules): StrategyMetrics {
  const r = rules;
  const state = steadyState(spec, r);
  const lossCents = toNumber(tableExpectedLossPerRoll(state));
  // action per roll = sum of amounts / expected rolls until each resolves
  let action = 0;
  for (const b of state.bets) {
    if (b.type.endsWith('-odds')) {
      const e = betEdge(b.type, b.amount, { phase: 'point', point: b.point, rules: r });
      action += b.amount / toNumber(e.expectedRolls);
      continue;
    }
    const ctx = LINE_TYPES.has(b.type)
      ? { phase: 'come-out' as const, point: null }
      : { phase: 'point' as const, point: 6 as PointNumber };
    const e = betEdge(b.type, b.amount, { ...ctx, rules: r });
    action += b.amount / toNumber(e.expectedRolls);
  }
  const expectedLossPerRoll = lossCents / 100;
  return {
    edgeOnAction: action > 0 ? lossCents / action : 0,
    expectedLossPerRoll,
    rollsPerDollar: expectedLossPerRoll > 0 ? 1 / expectedLossPerRoll : Infinity,
  };
}
