import type { Action, Bet, BetTypeId, Cents, GameState, TableRules } from '../engine/types';
import type { StrategySpec } from './types';

/** Building blocks shared by the preset strategies and the custom-system interpreter (I013). */

export const D = 100;

/** What a strategy wants to do before the next roll. `blocked`: its core bets are unaffordable. */
export interface Plan {
  actions: Action[];
  blocked: boolean;
}

export const ceilTo = (x: Cents, m: Cents): Cents => Math.ceil(x / m - 1e-9) * m;
export const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi);
export const whole = (x: Cents): Cents => Math.floor(x / D) * D;

export function flatAmount(rules: TableRules, x: Cents): Cents {
  return clamp(ceilTo(x, D), rules.tableMin, rules.tableMax);
}
export function propAmount(rules: TableRules, x: Cents): Cents {
  return clamp(ceilTo(x, D), rules.propMin, rules.tableMax);
}

/** Collects actions while tracking spendable cash (rack money). */
export class Builder {
  actions: Action[] = [];
  blocked = false;
  cash: Cents;
  constructor(readonly state: GameState) {
    this.cash = state.bankroll;
  }
  /** Place a bet if affordable; otherwise mark blocked (when core). */
  place(betType: BetTypeId, amount: Cents, parentId?: string, core = true): boolean {
    if (amount > this.cash) {
      if (core) this.blocked = true;
      return false;
    }
    this.cash -= amount;
    this.actions.push(
      parentId === undefined
        ? { type: 'place-bet', betType, amount }
        : { type: 'place-bet', betType, amount, parentId },
    );
    return true;
  }
  /** All-or-nothing group of bets. */
  placeAll(items: Array<[BetTypeId, Cents]>): void {
    const total = items.reduce((a, [, x]) => a + x, 0);
    if (items.length === 0) return;
    if (total > this.cash) {
      this.blocked = true;
      return;
    }
    for (const [t, a] of items) this.place(t, a);
  }
  plan(): Plan {
    return { actions: this.actions, blocked: this.blocked };
  }
}

export function find(state: GameState, type: BetTypeId): Bet | undefined {
  for (const b of state.bets) if (b.type === type) return b;
  return undefined;
}
export function oddsTarget(flat: Cents, mult: number, cap: number): Cents {
  return whole(flat * Math.min(mult, cap));
}

/** Pass or don't pass with optional odds. `layOdds` selects the don't side. */
export function lineStrategy(
  state: GameState,
  spec: StrategySpec,
  dont: boolean,
  defaultMult: number,
): Plan {
  const rules = state.rules;
  const b = new Builder(state);
  const flatType: BetTypeId = dont ? 'dont-pass' : 'pass-line';
  const oddsType: BetTypeId = dont ? 'dont-pass-odds' : 'pass-odds';
  const flat = find(state, flatType);
  if (state.phase === 'come-out') {
    if (!flat) b.place(flatType, flatAmount(rules, spec.unit));
  } else if (flat && state.point !== null && !find(state, oddsType)) {
    const mult = spec.oddsMultiple ?? defaultMult;
    if (mult > 0) {
      const cap = (dont ? rules.maxLayOdds : rules.maxOdds)[state.point];
      const amt = Math.min(oddsTarget(flat.amount, mult, cap), whole(b.cash));
      if (amt >= D) b.place(oddsType, amt, flat.id, false);
    }
  }
  return b.plan();
}

/** Line bet plus up to `maxComes` come (don't come) bets, each with odds (Three-point Molly: 2). */
export function molly(state: GameState, spec: StrategySpec, dont = false, maxComes = 2): Plan {
  const rules = state.rules;
  const b = new Builder(state);
  const mult = spec.oddsMultiple ?? Infinity;
  const lineT: BetTypeId = dont ? 'dont-pass' : 'pass-line';
  const lineOdds: BetTypeId = dont ? 'dont-pass-odds' : 'pass-odds';
  const comeT: BetTypeId = dont ? 'dont-come' : 'come';
  const comeOdds: BetTypeId = dont ? 'dont-come-odds' : 'come-odds';
  const maxOdds = dont ? rules.maxLayOdds : rules.maxOdds;
  const unit = flatAmount(rules, spec.unit);
  const pass = find(state, lineT);
  if (state.phase === 'come-out') {
    if (!pass) b.place(lineT, unit);
  }
  if (state.phase === 'point' && state.point !== null) {
    if (pass && !find(state, lineOdds) && mult > 0) {
      const amt = Math.min(oddsTarget(pass.amount, mult, maxOdds[state.point]), whole(b.cash));
      if (amt >= D) b.place(lineOdds, amt, pass.id, false);
    }
  }
  // odds behind travelled come bets (also during come-out when they may be off, odds stay legal)
  let comes = 0;
  let boxed = false;
  for (const c of state.bets) {
    if (c.type !== comeT) continue;
    comes++;
    if (c.point === null) {
      boxed = true;
      continue;
    }
    if (mult <= 0 || state.phase !== 'point') continue;
    if (state.bets.some((o) => o.type === comeOdds && o.parentId === c.id)) continue;
    const amt = Math.min(oddsTarget(c.amount, mult, maxOdds[c.point]), whole(b.cash));
    if (amt >= D) b.place(comeOdds, amt, c.id, false);
  }
  if (state.phase === 'point' && pass && !boxed && comes < maxComes) {
    b.place(comeT, unit, undefined, comes === 0);
  }
  return b.plan();
}

export function placeNumbers(
  state: GameState,
  items: Array<[BetTypeId, Cents]>,
  withField = 0,
): Plan {
  const b = new Builder(state);
  const missing: Array<[BetTypeId, Cents]> = [];
  if (withField > 0 && !find(state, 'field')) missing.push(['field', withField]);
  for (const it of items) if (!find(state, it[0])) missing.push(it);
  if (state.phase !== 'point') {
    // Nothing is placed on the come-out, but a player who could never afford the layout is bust.
    const total = items.reduce((a, [, x]) => a + x, 0) + withField;
    if (state.bets.length === 0 && total > b.cash) b.blocked = true;
    return b.plan();
  }
  b.placeAll(missing);
  if (b.blocked && state.bets.length > 0) b.blocked = false;
  return b.plan();
}

export function unitDollars(rules: TableRules, spec: StrategySpec): number {
  return flatAmount(rules, spec.unit) / D;
}

/** Loss streak of pass-line decisions, derived from dice history (martingale). */
export function passLossStreak(state: GameState): number {
  let streak = 0;
  let phase: 'come-out' | 'point' = 'come-out';
  let point = 0;
  let started = false;
  for (const r of state.history) {
    if (!started) {
      if (r.phaseBefore !== 'come-out') continue;
      started = true;
    }
    const t = r.total;
    if (phase === 'come-out') {
      if (t === 7 || t === 11) streak = 0;
      else if (t === 2 || t === 3 || t === 12) streak++;
      else {
        phase = 'point';
        point = t;
      }
    } else if (t === point) {
      streak = 0;
      phase = 'come-out';
    } else if (t === 7) {
      streak++;
      phase = 'come-out';
    }
  }
  return streak;
}

/** Pass line doubled after each loss (at most `maxDoublings` times), back to one unit after a win. */
export function martingale(state: GameState, spec: StrategySpec, maxDoublings = 30): Plan {
  const rules = state.rules;
  const b = new Builder(state);
  const pass = find(state, 'pass-line');
  if (state.phase === 'come-out') {
    if (!pass) {
      const streak = Math.min(passLossStreak(state), maxDoublings);
      const want = flatAmount(rules, spec.unit) * 2 ** streak;
      const amt = Math.min(want, rules.tableMax, whole(b.cash));
      if (amt < rules.tableMin) b.blocked = true;
      else b.place('pass-line', amt);
    }
  } else if (pass && state.point !== null && !find(state, 'pass-odds')) {
    const mult = spec.oddsMultiple ?? 0;
    if (mult > 0) {
      const amt = Math.min(
        oddsTarget(pass.amount, mult, rules.maxOdds[state.point]),
        whole(b.cash),
      );
      if (amt >= D) b.place('pass-odds', amt, pass.id, false);
    }
  }
  return b.plan();
}

/** True when the last roll was a point-phase roll that came up `n` (so a place bet on `n` just won). */
export function hitLastRoll(state: GameState, n: number): boolean {
  const r = state.history[state.history.length - 1];
  return r !== undefined && r.total === n && r.phaseBefore === 'point';
}
