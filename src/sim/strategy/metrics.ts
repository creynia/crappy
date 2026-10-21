import type { Action, Bet, BetTypeId, GameState, PointNumber, TableRules } from '../engine';
import { betEdge, tableExpectedLossPerRoll, toNumber } from '../math';
import { customIsProgressive } from './custom';
import { getImpl } from './presets';
import type { StrategyMetrics, StrategySpec } from './types';

/** P(each point is established) given a decision of a line/come bet, in 36ths. */
const POINT_WAYS: Record<PointNumber, number> = { 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3 };

/**
 * Expected odds wagered per decision, as a multiple of the flat bet, when odds are always taken at the table
 * maximum: sum over points of P(point) x max multiple. 3-4-5x gives 100/36; 6x lay gives 4.
 */
export function oddsMultiplePerDecision(rules: TableRules, lay: boolean): number {
  let t = 0;
  for (const n of [4, 5, 6, 8, 9, 10] as PointNumber[])
    t += (POINT_WAYS[n] / 36) * (lay ? rules.maxLayOdds[n] : rules.maxOdds[n]);
  return t;
}

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

const ONE_ROLL: ReadonlySet<BetTypeId> = new Set<BetTypeId>([
  'field',
  'any-7',
  'any-craps',
  'yo-11',
  'aces-2',
  'boxcars-12',
  'ace-deuce-3',
  'horn',
  'c-e',
  'world',
]);

/** The strategy's steady-state layout in the point phase (point 6), built via its own `decide`. */
function steadyState(
  spec: StrategySpec,
  rules: TableRules,
): { state: GameState; comeOutOnly: Bet[] } {
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
    stats: {
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      totalVig: 0,
      expectedLoss: 0,
      variance: 0,
      byType: {},
    },
  } as GameState;
  s = materialize(s, impl.decide(s, spec));
  // One-roll bets placed on the come-out (an Any Craps hedge) are gone after that roll. Take them out
  // of the point-phase layout; they are costed once per decision instead (see strategyMetrics). A
  // one-roll bet the strategy re-places every roll (field, any 7) stays in the layout.
  const oneRoll = s.bets.filter((b) => ONE_ROLL.has(b.type));
  s = { ...s, phase: 'point', point: 6, bets: s.bets.filter((b) => !ONE_ROLL.has(b.type)) };
  for (let i = 0; i < 4; i++) {
    const acts = impl.decide(s, spec);
    if (acts.length === 0) break;
    s = materialize(s, acts);
  }
  const comeOutOnly = oneRoll.filter((b) => !s.bets.some((x) => x.type === b.type));
  return { state: s, comeOutOnly };
}

/** Strategies that change their layout over time: metrics describe the starting layout (approximate). */
const APPROXIMATE: ReadonlySet<string> = new Set(['place-6-8-press', 'inside-regress']);

/** Analytic cost of keeping the strategy's layout up (see simulator.md §2.4). */
export function strategyMetrics(spec: StrategySpec, rules: TableRules): StrategyMetrics {
  const r = rules;
  const { state, comeOutOnly } = steadyState(spec, r);
  let lossCents = toNumber(tableExpectedLossPerRoll(state));
  // action per roll = sum of amounts / expected rolls until each resolves
  let action = 0;
  for (const b of state.bets) {
    if (b.type.endsWith('-odds')) {
      // Odds are measured per DECISION of their flat bet: the amount wagered on odds depends on which
      // point is made, so use the expected odds over the point distribution (same fraction of the
      // table maximum as this layout takes at its own point).
      const parent = state.bets.find((x) => x.id === b.parentId);
      if (!parent) continue;
      const lay = b.type === 'dont-pass-odds' || b.type === 'dont-come-odds';
      const maxMult = (lay ? r.maxLayOdds : r.maxOdds)[b.point ?? 6];
      const frac =
        maxMult > 0 && parent.amount > 0 ? Math.min(1, b.amount / (parent.amount * maxMult)) : 0;
      const e = betEdge(parent.type, parent.amount, { phase: 'come-out', point: null, rules: r });
      action +=
        (parent.amount * frac * oddsMultiplePerDecision(r, lay)) / toNumber(e.expectedRolls);
      continue;
    }
    const ctx = LINE_TYPES.has(b.type)
      ? { phase: 'come-out' as const, point: null }
      : { phase: 'point' as const, point: 6 as PointNumber };
    const e = betEdge(b.type, b.amount, { ...ctx, rules: r });
    action += b.amount / toNumber(e.expectedRolls);
  }
  if (comeOutOnly.length > 0) {
    // one come-out roll per decision: spread the bet over the rolls a decision lasts
    const line = state.bets.find((b) => LINE_TYPES.has(b.type));
    const perDecision = line
      ? toNumber(
          betEdge(line.type, line.amount, { phase: 'come-out', point: null, rules: r })
            .expectedRolls,
        )
      : 1;
    for (const b of comeOutOnly) {
      const e = betEdge(b.type, b.amount, { phase: 'come-out', point: null, rules: r });
      lossCents += (toNumber(e.perResolved) * b.amount) / perDecision;
      action += b.amount / perDecision;
    }
  }
  const expectedLossPerRoll = lossCents / 100;
  return {
    edgeOnAction: action > 0 ? lossCents / action : 0,
    expectedLossPerRoll,
    rollsPerDollar: expectedLossPerRoll > 0 ? 1 / expectedLossPerRoll : Infinity,
    ...(APPROXIMATE.has(spec.id) || (spec.id === 'custom' && customIsProgressive(spec.custom))
      ? { approximate: true }
      : {}),
  };
}

/**
 * Edge on action for a line bet with odds at `multiple` x the flat bet (capped by the table at each point,
 * 'max' = the table maximum): flat edge / (1 + expected odds per decision).
 */
export function lineOddsEdge(
  flatEdge: number,
  rules: TableRules,
  multiple: number | 'max',
  lay = false,
): number {
  if (multiple === 'max') return flatEdge / (1 + oddsMultiplePerDecision(rules, lay));
  let t = 0;
  for (const n of [4, 5, 6, 8, 9, 10] as PointNumber[]) {
    const cap = (lay ? rules.maxLayOdds : rules.maxOdds)[n];
    t += (POINT_WAYS[n] / 36) * Math.min(multiple, cap);
  }
  return flatEdge / (1 + t);
}
