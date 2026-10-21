import { isHandStart } from '../engine/hand';
import type { Action, Bet, BetTypeId, Cents, GameState, TableRules } from '../engine/types';
import type { Strategy, StrategyId, StrategyLens, StrategySpec } from './types';

const D = 100;

/** What a strategy wants to do before the next roll. `blocked`: its core bets are unaffordable. */
export interface Plan {
  actions: Action[];
  blocked: boolean;
}
interface Impl extends Strategy {
  plan(state: GameState, spec: StrategySpec): Plan;
}

const ceilTo = (x: Cents, m: Cents): Cents => Math.ceil(x / m - 1e-9) * m;
const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi);
const whole = (x: Cents): Cents => Math.floor(x / D) * D;

function flatAmount(rules: TableRules, x: Cents): Cents {
  return clamp(ceilTo(x, D), rules.tableMin, rules.tableMax);
}
function propAmount(rules: TableRules, x: Cents): Cents {
  return clamp(ceilTo(x, D), rules.propMin, rules.tableMax);
}

/** Collects actions while tracking spendable cash (rack money). */
class Builder {
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

function find(state: GameState, type: BetTypeId): Bet | undefined {
  for (const b of state.bets) if (b.type === type) return b;
  return undefined;
}
function oddsTarget(flat: Cents, mult: number, cap: number): Cents {
  return whole(flat * Math.min(mult, cap));
}

/** Pass or don't pass with optional odds. `layOdds` selects the don't side. */
function lineStrategy(
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

function molly(state: GameState, spec: StrategySpec): Plan {
  const rules = state.rules;
  const b = new Builder(state);
  const mult = spec.oddsMultiple ?? Infinity;
  const unit = flatAmount(rules, spec.unit);
  const pass = find(state, 'pass-line');
  if (state.phase === 'come-out') {
    if (!pass) b.place('pass-line', unit);
  }
  if (state.phase === 'point' && state.point !== null) {
    if (pass && !find(state, 'pass-odds') && mult > 0) {
      const amt = Math.min(
        oddsTarget(pass.amount, mult, rules.maxOdds[state.point]),
        whole(b.cash),
      );
      if (amt >= D) b.place('pass-odds', amt, pass.id, false);
    }
  }
  // odds behind travelled come bets (also during come-out when they may be off, odds stay legal)
  let comes = 0;
  let boxed = false;
  for (const c of state.bets) {
    if (c.type !== 'come') continue;
    comes++;
    if (c.point === null) {
      boxed = true;
      continue;
    }
    if (mult <= 0 || state.phase !== 'point') continue;
    if (state.bets.some((o) => o.type === 'come-odds' && o.parentId === c.id)) continue;
    const amt = Math.min(oddsTarget(c.amount, mult, rules.maxOdds[c.point]), whole(b.cash));
    if (amt >= D) b.place('come-odds', amt, c.id, false);
  }
  if (state.phase === 'point' && pass && !boxed && comes < 2) {
    b.place('come', unit, undefined, comes === 0);
  }
  return b.plan();
}

function placeNumbers(state: GameState, items: Array<[BetTypeId, Cents]>, withField = 0): Plan {
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

function unitDollars(rules: TableRules, spec: StrategySpec): number {
  return flatAmount(rules, spec.unit) / D;
}

/** Loss streak of pass-line decisions, derived from dice history (martingale). */
function passLossStreak(state: GameState): number {
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

function martingale(state: GameState, spec: StrategySpec): Plan {
  const rules = state.rules;
  const b = new Builder(state);
  const pass = find(state, 'pass-line');
  if (state.phase === 'come-out') {
    if (!pass) {
      const streak = Math.min(passLossStreak(state), 30);
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

function repeatLayout(state: GameState, spec: StrategySpec): Plan {
  const rules = state.rules;
  const b = new Builder(state);
  const layout = spec.layout ?? [];
  const point = state.phase === 'point' ? state.point : null;
  const inPoint = point !== null;
  const used = new Set<string>(); // come bet ids already matched
  const boxed = new Set<BetTypeId>();
  for (const w of layout) {
    const t = w.type;
    const amount = clamp(whole(w.amount), D, rules.tableMax);
    switch (t) {
      case 'pass-line':
        if (!inPoint && !find(state, t)) {
          b.place(t, clamp(amount, rules.tableMin, rules.tableMax));
        }
        break;
      case 'dont-pass':
        if (!inPoint && !find(state, t)) {
          b.place(t, clamp(amount, rules.tableMin, rules.tableMax));
        }
        break;
      case 'come':
      case 'dont-come': {
        if (!inPoint) break;
        // match against existing bets of the type (box or numbers), one per snapshot entry
        const have = state.bets.filter((x) => x.type === t && !used.has(x.id));
        if (have[0]) used.add(have[0].id);
        else if (!boxed.has(t) && !state.bets.some((x) => x.type === t && x.point === null)) {
          boxed.add(t);
          b.place(t, clamp(amount, rules.tableMin, rules.tableMax));
        }
        break;
      }
      case 'pass-odds':
      case 'dont-pass-odds': {
        const parent = find(state, t === 'pass-odds' ? 'pass-line' : 'dont-pass');
        if (!inPoint || !parent || find(state, t)) break;
        const cap = (t === 'pass-odds' ? rules.maxOdds : rules.maxLayOdds)[point];
        const amt = Math.min(amount, whole(parent.amount * cap), whole(b.cash));
        if (amt >= D) b.place(t, amt, parent.id, false);
        break;
      }
      case 'come-odds':
      case 'dont-come-odds': {
        const pt = w.point ?? null;
        const parentType = t === 'come-odds' ? 'come' : 'dont-come';
        const parent = state.bets.find(
          (x) => x.type === parentType && x.point === pt && pt !== null,
        );
        if (!parent || state.bets.some((x) => x.type === t && x.parentId === parent.id)) break;
        const cap = (t === 'come-odds' ? rules.maxOdds : rules.maxLayOdds)[parent.point!];
        const amt = Math.min(amount, whole(parent.amount * cap), whole(b.cash));
        if (amt >= D) b.place(t, amt, parent.id, false);
        break;
      }
      case 'fire':
      case 'all':
      case 'tall':
      case 'small':
        // bonus bets go up for each new shooter (never core: the hand decides when they come down)
        if (!find(state, t) && isHandStart(state))
          b.place(t, propAmount(rules, amount), undefined, false);
        break;
      default: {
        // center/number bets: one instance per type
        if (find(state, t)) break;
        const amt = isProp(t) || isHard(t) ? propAmount(rules, amount) : flatAmount(rules, amount);
        b.place(t, amt);
      }
    }
  }
  if (b.blocked && state.bets.length > 0) b.blocked = false;
  return b.plan();
}

const PROPS: ReadonlySet<BetTypeId> = new Set<BetTypeId>([
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
const isProp = (t: BetTypeId): boolean => PROPS.has(t);
const isHard = (t: BetTypeId): boolean => t.startsWith('hard-');

function make(
  id: StrategyId,
  name: string,
  lens: StrategyLens,
  description: string,
  plan: (state: GameState, spec: StrategySpec) => Plan,
): Impl {
  return {
    id,
    name,
    lens,
    description,
    plan,
    decide: (state, spec) => plan(state, spec).actions,
  };
}

const place5 = (rules: TableRules, spec: StrategySpec): Cents =>
  ceilTo(flatAmount(rules, spec.unit), 5 * D);
const place6 = (rules: TableRules, spec: StrategySpec): Cents =>
  ceilTo(flatAmount(rules, spec.unit), 6 * D);

export const STRATEGIES: Impl[] = [
  make(
    'pass-max-odds',
    'Pass line + max odds',
    'lowest-edge',
    'Pass line every come-out, then take the biggest odds the table allows behind the point.',
    (s, spec) => lineStrategy(s, spec, false, Infinity),
  ),
  make(
    'dont-pass-max-lay',
    "Don't pass + max lay odds",
    'lowest-edge',
    "Don't pass every come-out, then lay the biggest odds the table allows.",
    (s, spec) => lineStrategy(s, spec, true, Infinity),
  ),
  make(
    'pass-2x-odds',
    'Pass line + 2x odds',
    'practical',
    'Pass line with double odds: most of the benefit, less money at risk.',
    (s, spec) => lineStrategy(s, spec, false, 2),
  ),
  make(
    'three-point-molly',
    'Three-point Molly',
    'practical',
    'Pass line plus up to two come bets, each with odds, so three numbers are working.',
    molly,
  ),
  make(
    'place-6-8',
    'Place 6 and 8',
    'practical',
    'After a point is set, place the 6 and 8 in $6 units. No line bet.',
    (s, spec) => {
      const a = place6(s.rules, spec);
      return placeNumbers(s, [
        ['place-6', a],
        ['place-8', a],
      ]);
    },
  ),
  make(
    'iron-cross',
    'Iron Cross',
    'fun',
    'Field plus place 5, 6 and 8 after a point: everything wins except a 7. Fun, but costly.',
    (s, spec) => {
      const unit = unitDollars(s.rules, spec);
      const six = ceilTo(Math.round(unit * 1.2 * D), 6 * D);
      return placeNumbers(
        s,
        [
          ['place-5', place5(s.rules, spec)],
          ['place-6', six],
          ['place-8', six],
        ],
        flatAmount(s.rules, spec.unit),
      );
    },
  ),
  make(
    'across',
    'Place across',
    'fun',
    'Place all six numbers in proper units after a point.',
    (s, spec) => {
      const five = place5(s.rules, spec);
      const six = place6(s.rules, spec);
      return placeNumbers(s, [
        ['place-4', five],
        ['place-5', five],
        ['place-6', six],
        ['place-8', six],
        ['place-9', five],
        ['place-10', five],
      ]);
    },
  ),
  make(
    'field-every-roll',
    'Field every roll',
    'fun',
    'A field bet on every roll. A demonstration of a bad bet.',
    (s, spec) => {
      const b = new Builder(s);
      if (!find(s, 'field')) b.place('field', flatAmount(s.rules, spec.unit));
      return b.plan();
    },
  ),
  make(
    'any-7-every-roll',
    'Any 7 every roll',
    'fun',
    'Bet on a seven every roll. A demonstration of a very bad bet.',
    (s, spec) => {
      const b = new Builder(s);
      if (!find(s, 'any-7')) b.place('any-7', propAmount(s.rules, spec.unit));
      return b.plan();
    },
  ),
  make(
    'hardways-all',
    'All the hardways',
    'fun',
    'Hard 4, 6, 8 and 10, re-placed whenever they come down.',
    (s, spec) => {
      const b = new Builder(s);
      const amt = propAmount(s.rules, spec.unit);
      b.placeAll(
        (['hard-4', 'hard-6', 'hard-8', 'hard-10'] as const)
          .filter((t) => !find(s, t))
          .map((t): [BetTypeId, Cents] => [t, amt]),
      );
      if (b.blocked && s.bets.length > 0) b.blocked = false;
      return b.plan();
    },
  ),
  make(
    'no-bet',
    'Just roll the dice',
    'lowest-edge',
    'No bets at all: roll and watch the totals pile up.',
    () => ({ actions: [], blocked: false }),
  ),
  make(
    'my-layout',
    'My layout',
    'practical',
    'Re-bets the layout you built, every roll, as bets come down.',
    repeatLayout,
  ),
  make(
    'martingale-pass',
    'Martingale on the pass line',
    'fun',
    'Double the pass line bet after each loss, back to one unit after a win (capped at the table max and your bankroll).',
    martingale,
  ),
];

const BY_ID = new Map<StrategyId, Impl>(STRATEGIES.map((s) => [s.id, s]));

export function getStrategy(id: StrategyId): Strategy {
  return getImpl(id);
}
export function getImpl(id: StrategyId): Impl {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown strategy: ${id}`);
  return s;
}
export function listStrategies(): Strategy[] {
  return STRATEGIES.slice();
}
