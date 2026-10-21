import { suggestAmount } from '../engine';
import type { Action, BetTypeId, Cents, GameState, PointNumber } from '../engine/types';
import {
  Builder,
  ceilTo,
  D,
  find,
  flatAmount,
  hitLastRoll,
  lineStrategy,
  martingale,
  molly,
  placeNumbers,
  type Plan,
} from './primitives';
import type { CustomSystem, OddsSetting, StrategyId, StrategySpec } from './types';

/**
 * The custom-system interpreter (I013): turns a declarative CustomSystem into the same legal
 * actions the preset strategies produce, by composing the presets' own building blocks. So a preset
 * re-expressed as a custom system (PRESETS_AS_CUSTOM) plays identically on the same seed.
 */

const POINTS: readonly PointNumber[] = [4, 5, 6, 8, 9, 10];
const oddsMult = (o: OddsSetting): number => (o === 'max' ? Infinity : o);

function numberType(kind: 'place' | 'buy' | 'lay', n: PointNumber): BetTypeId {
  return `${kind}-${n}`;
}

/** Amount for one number: `units` x the flat bet, in the bet's proper unit. */
function numberAmount(
  state: GameState,
  kind: 'place' | 'buy' | 'lay',
  n: PointNumber,
  units: number,
  flat: Cents,
): Cents {
  const raw = Math.round(flat * units);
  if (kind === 'place') return ceilTo(raw, n === 6 || n === 8 ? 6 * D : 5 * D);
  return suggestAmount(numberType(kind, n), ceilTo(raw, D), state);
}

/** Cash already committed by earlier blocks this roll. */
function spent(actions: readonly Action[], state: GameState): Cents {
  let t = 0;
  for (const a of actions) {
    if (a.type === 'place-bet') t += a.amount;
    else if (a.type === 'set-amount') {
      const b = state.bets.find((x) => x.id === a.betId);
      if (b) t += a.amount - b.amount;
    }
  }
  return t;
}

function linePlan(state: GameState, spec: StrategySpec, c: CustomSystem): Plan | null {
  const line = c.line;
  if (!line) return null;
  const dont = line.side === 'dont';
  const s: StrategySpec = { ...spec, oddsMultiple: oddsMult(line.odds) };
  if (c.onLoss?.kind === 'martingale' && !dont) return martingale(state, s, c.onLoss.maxDoublings);
  if (c.come && c.come.count > 0) {
    // molly takes one odds multiple for line and come bets: when the blocks differ, take the line bet
    // and its odds from a line-only plan, then the come bets from the cash that is left
    if (oddsMult(c.come.odds) === oddsMult(line.odds)) return molly(state, s, dont, c.come.count);
    const lineTypes: BetTypeId[] = dont
      ? ['dont-pass', 'dont-pass-odds']
      : ['pass-line', 'pass-odds'];
    const isLine = (a: Action) => a.type === 'place-bet' && lineTypes.includes(a.betType);
    const lineOnly = molly(state, s, dont, 0);
    const lineActs = lineOnly.actions.filter(isLine);
    const left = { ...state, bankroll: state.bankroll - spent(lineActs, state) };
    const comes = molly(left, { ...spec, oddsMultiple: oddsMult(c.come.odds) }, dont, c.come.count);
    return {
      actions: [...lineActs, ...comes.actions.filter((a) => !isLine(a))],
      blocked: lineOnly.blocked || comes.blocked,
    };
  }
  return lineStrategy(state, s, dont, Infinity);
}

function numbersPlan(state: GameState, spec: StrategySpec, c: CustomSystem): Plan | null {
  const nb = c.numbers;
  if (!nb && !c.field) return null;
  const flat = flatAmount(state.rules, spec.unit);
  const items: Array<[BetTypeId, Cents]> = (nb?.bets ?? []).map((x) => [
    numberType(nb!.kind, x.n),
    numberAmount(state, nb!.kind, x.n, x.units, flat),
  ]);
  const field = c.field ? flatAmount(state.rules, Math.round(flat * c.field.units)) : 0;
  const win = c.onWin;
  if (win?.kind === 'regress' && nb) return regressPlan(state, items, field, nb.kind, win.keep);
  const plan = placeNumbers(state, items, field);
  if (win?.kind === 'press' && nb) return pressPlan(state, plan, items, win.units, win.capTimes);
  return plan;
}

/** Press each number that just won by `units` x its starting bet, up to `capTimes` x (placePress). */
function pressPlan(
  state: GameState,
  plan: Plan,
  items: Array<[BetTypeId, Cents]>,
  units: number,
  capTimes: number,
): Plan {
  const b = new Builder(state);
  b.actions = plan.actions;
  b.blocked = plan.blocked;
  for (const a of plan.actions) if (a.type === 'place-bet') b.cash -= a.amount;
  for (const [t, base] of items) {
    const n = Number(t.slice(t.indexOf('-') + 1));
    const bet = find(state, t);
    if (!bet || !hitLastRoll(state, n) || bet.amount >= base * capTimes) continue;
    const next = Math.min(bet.amount + base * units, base * capTimes);
    if (next - bet.amount <= b.cash) {
      b.cash -= next - bet.amount;
      b.actions.push({ type: 'set-amount', betId: bet.id, amount: next });
    }
  }
  return b.plan();
}

/** Place every number, then after the first hit take down all but `keep` (insideRegress). */
function regressPlan(
  state: GameState,
  items: Array<[BetTypeId, Cents]>,
  field: Cents,
  kind: 'place' | 'buy' | 'lay',
  keep: readonly PointNumber[],
): Plan {
  const keepTypes = keep.map((n) => numberType(kind, n));
  const dropTypes = items.map(([t]) => t).filter((t) => !keepTypes.includes(t));
  const started = keepTypes.some((t) => find(state, t) !== undefined);
  const regressed = started && dropTypes.every((t) => find(state, t) === undefined);
  const b = new Builder(state);
  if (started) {
    if (
      !regressed &&
      items.some(([t]) => hitLastRoll(state, Number(t.slice(t.indexOf('-') + 1))))
    ) {
      for (const t of dropTypes) {
        const bet = find(state, t);
        if (bet) b.actions.push({ type: 'remove-bet', betId: bet.id });
      }
    }
    if (field > 0 && state.phase === 'point' && !find(state, 'field'))
      b.place('field', field, undefined, false);
    return b.plan();
  }
  return placeNumbers(state, items, field);
}

/** The custom strategy's plan for the next roll. */
export function customPlan(state: GameState, spec: StrategySpec): Plan {
  const c = spec.custom;
  if (!c) return { actions: [], blocked: false };
  const a = linePlan(state, spec, c);
  const used = a ? spent(a.actions, state) : 0;
  const rest = used > 0 ? { ...state, bankroll: state.bankroll - used } : state;
  const b = numbersPlan(rest, spec, c);
  if (!a) return b ?? { actions: [], blocked: false };
  if (!b) return a;
  return { actions: [...a.actions, ...b.actions], blocked: a.blocked || b.blocked };
}

/** True when the system changes its layout over time, so its analytic edge is only approximate. */
export function customIsProgressive(c: CustomSystem | undefined): boolean {
  return !!(c?.onWin || c?.onLoss);
}

// ---------------------------------------------------------------------------
// Presets re-expressed as custom systems (golden equivalence, and builder starting points)
// ---------------------------------------------------------------------------

export const PRESETS_AS_CUSTOM: Partial<Record<StrategyId, CustomSystem>> = {
  'pass-max-odds': { line: { side: 'pass', odds: 'max' } },
  'dont-pass-max-lay': { line: { side: 'dont', odds: 'max' } },
  'pass-2x-odds': { line: { side: 'pass', odds: 2 } },
  'three-point-molly': { line: { side: 'pass', odds: 'max' }, come: { count: 2, odds: 'max' } },
  'dont-come-molly': { line: { side: 'dont', odds: 'max' }, come: { count: 2, odds: 'max' } },
  'place-6-8': {
    numbers: {
      kind: 'place',
      bets: [
        { n: 6, units: 1 },
        { n: 8, units: 1 },
      ],
    },
  },
  'iron-cross': {
    numbers: {
      kind: 'place',
      bets: [
        { n: 5, units: 1 },
        { n: 6, units: 1.2 },
        { n: 8, units: 1.2 },
      ],
    },
    field: { units: 1 },
  },
  across: {
    numbers: {
      kind: 'place',
      bets: POINTS.map((n) => ({ n, units: 1 })),
    },
  },
  'buy-4-10': {
    numbers: {
      kind: 'buy',
      bets: [
        { n: 4, units: 4 },
        { n: 10, units: 4 },
      ],
    },
  },
  'lay-4-10': {
    numbers: {
      kind: 'lay',
      bets: [
        { n: 4, units: 8 },
        { n: 10, units: 8 },
      ],
    },
  },
  'martingale-pass': {
    line: { side: 'pass', odds: 0 },
    onLoss: { kind: 'martingale', maxDoublings: 30 },
  },
  'place-6-8-press': {
    numbers: {
      kind: 'place',
      bets: [
        { n: 6, units: 1 },
        { n: 8, units: 1 },
      ],
    },
    onWin: { kind: 'press', units: 1, capTimes: 5 },
  },
  'inside-regress': {
    numbers: {
      kind: 'place',
      bets: [
        { n: 5, units: 1 },
        { n: 6, units: 1 },
        { n: 8, units: 1 },
        { n: 9, units: 1 },
      ],
    },
    onWin: { kind: 'regress', keep: [6, 8] },
  },
};

// ---------------------------------------------------------------------------
// Validation and URL serialization
// ---------------------------------------------------------------------------

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const isPoint = (x: unknown): x is PointNumber => POINTS.includes(x as PointNumber);
const num = (x: unknown, lo: number, hi: number, int = false): boolean =>
  typeof x === 'number' &&
  Number.isFinite(x) &&
  x >= lo &&
  x <= hi &&
  (!int || Number.isInteger(x));

export const MAX_COME_BETS = 3;
const MAX_UNITS = 20;

/** Errors (path: message) for an untrusted custom system; empty when it is valid. */
export function validateCustom(c: unknown, path = 'custom'): string[] {
  const errs: string[] = [];
  const err = (p: string, m: string) => errs.push(`${path}${p}: ${m}`);
  if (!isObj(c)) return [`${path}: must be an object`];
  const allowed = ['line', 'come', 'numbers', 'field', 'onWin', 'onLoss', 'stopWin', 'stopLoss'];
  for (const k of Object.keys(c)) if (!allowed.includes(k)) err(`.${k}`, 'unknown key');
  const odds = (p: string, o: unknown) => {
    if (o !== 'max' && !num(o, 0, 100)) err(p, 'must be "max" or a multiple from 0 to 100');
  };
  if (c.line !== undefined) {
    if (!isObj(c.line)) err('.line', 'must be an object');
    else {
      if (c.line.side !== 'pass' && c.line.side !== 'dont')
        err('.line.side', 'must be "pass" or "dont"');
      odds('.line.odds', c.line.odds);
    }
  }
  if (c.come !== undefined) {
    if (!isObj(c.come)) err('.come', 'must be an object');
    else {
      if (!num(c.come.count, 1, MAX_COME_BETS, true))
        err('.come.count', `must be a whole number from 1 to ${MAX_COME_BETS}`);
      odds('.come.odds', c.come.odds);
      if (c.line === undefined) err('.come', 'needs a line bet');
    }
  }
  const numbers: PointNumber[] = [];
  let kind: unknown;
  if (c.numbers !== undefined) {
    if (!isObj(c.numbers)) err('.numbers', 'must be an object');
    else {
      kind = c.numbers.kind;
      if (kind !== 'place' && kind !== 'buy' && kind !== 'lay')
        err('.numbers.kind', 'must be "place", "buy" or "lay"');
      if (!Array.isArray(c.numbers.bets) || c.numbers.bets.length === 0)
        err('.numbers.bets', 'must list at least one number');
      else
        c.numbers.bets.forEach((b, i) => {
          if (!isObj(b) || !isPoint(b.n))
            return err(`.numbers.bets[${i}].n`, 'must be 4, 5, 6, 8, 9 or 10');
          if (numbers.includes(b.n)) err(`.numbers.bets[${i}].n`, 'is listed twice');
          numbers.push(b.n);
          if (!num(b.units, 0.1, MAX_UNITS))
            err(`.numbers.bets[${i}].units`, `must be from 0.1 to ${MAX_UNITS}`);
        });
    }
  }
  if (c.field !== undefined) {
    if (!isObj(c.field) || !num(c.field.units, 0.1, MAX_UNITS))
      err('.field.units', `must be from 0.1 to ${MAX_UNITS}`);
  }
  if (c.line === undefined && c.numbers === undefined && c.field === undefined)
    err('', 'needs at least one bet: a line bet, numbers or the field');
  if (c.onWin !== undefined) {
    const w = c.onWin;
    if (!isObj(w)) err('.onWin', 'must be an object');
    else if (c.numbers === undefined) err('.onWin', 'needs numbers to press or regress');
    else if (w.kind === 'press') {
      if (kind === 'lay') err('.onWin', 'lay bets win on a 7, so they cannot be pressed on a hit');
      if (!num(w.units, 1, 5, true)) err('.onWin.units', 'must be a whole number from 1 to 5');
      if (!num(w.capTimes, 2, 20, true))
        err('.onWin.capTimes', 'must be a whole number from 2 to 20');
    } else if (w.kind === 'regress') {
      if (kind === 'lay') err('.onWin', 'lay bets win on a 7, so they cannot regress on a hit');
      if (
        !Array.isArray(w.keep) ||
        w.keep.length === 0 ||
        !w.keep.every((n) => numbers.includes(n as PointNumber))
      )
        err('.onWin.keep', 'must list some of the numbers bet');
      else if (w.keep.length >= numbers.length)
        err('.onWin.keep', 'must leave at least one number to take down');
    } else err('.onWin.kind', 'must be "press" or "regress"');
  }
  if (c.onLoss !== undefined) {
    const l = c.onLoss;
    if (!isObj(l) || l.kind !== 'martingale') err('.onLoss.kind', 'must be "martingale"');
    else {
      if (!num(l.maxDoublings, 1, 30, true))
        err('.onLoss.maxDoublings', 'must be a whole number from 1 to 30');
      if (!isObj(c.line) || c.line.side !== 'pass')
        err('.onLoss', 'Martingale needs a pass line bet');
      if (c.come !== undefined) err('.onLoss', 'Martingale cannot be combined with come bets');
    }
  }
  for (const k of ['stopWin', 'stopLoss'] as const)
    if (c[k] !== undefined && !num(c[k], 100, 100_000_000, true))
      err(`.${k}`, 'must be whole cents, at least 100');
  return errs;
}

/** Compact, URL-safe form of a system (base64url JSON). */
export function encodeCustom(c: CustomSystem): string {
  const json = JSON.stringify(c);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The system in a URL param, or null when it is missing, garbled or invalid. */
export function decodeCustom(s: string | null | undefined): CustomSystem | null {
  if (!s) return null;
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const c: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return validateCustom(c).length === 0 ? (c as CustomSystem) : null;
  } catch {
    return null;
  }
}
