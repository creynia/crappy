import { isHandStart } from '../engine/hand';
import type { Action, Bet, BetTypeId, Cents, TableRules, GameState } from '../engine/types';
import { suggestAmount } from '../engine';
import { customPlan } from './custom';
import {
  Builder,
  ceilTo,
  clamp,
  D,
  find,
  flatAmount,
  hitLastRoll,
  lineStrategy,
  martingale,
  molly,
  placeNumbers,
  propAmount,
  unitDollars,
  whole,
  type Plan,
} from './primitives';
import type { Strategy, StrategyId, StrategyLens, StrategySpec } from './types';

export type { Plan } from './primitives';
interface Impl extends Strategy {
  plan(state: GameState, spec: StrategySpec): Plan;
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

/** Buy or lay the 4 and 10 after a point is set. Bets stay up until they resolve, then are re-placed. */
function buyLay4And10(state: GameState, spec: StrategySpec, kind: 'buy' | 'lay'): Plan {
  // buy: $20 at a $5 unit (the smallest buy where the $1 vig is exactly 5%); lay: $40 (wins $20)
  const base = flatAmount(state.rules, spec.unit) * (kind === 'buy' ? 4 : 8);
  const items = ([4, 10] as const).map((n): [BetTypeId, Cents] => {
    const t: BetTypeId = `${kind}-${n}`;
    return [t, suggestAmount(t, base, state)];
  });
  return placeNumbers(state, items);
}

/** Place 6 and 8, then press each by one unit after every hit, up to PRESS_CAP times the starting bet. */
const PRESS_CAP = 5;
function placePress(state: GameState, spec: StrategySpec): Plan {
  const a = place6(state.rules, spec);
  const plan = placeNumbers(state, [
    ['place-6', a],
    ['place-8', a],
  ]);
  const b = new Builder(state);
  b.actions = plan.actions;
  b.blocked = plan.blocked;
  for (const a2 of plan.actions) if (a2.type === 'place-bet') b.cash -= a2.amount;
  for (const n of [6, 8] as const) {
    const bet = find(state, `place-${n}`);
    if (!bet || !hitLastRoll(state, n) || bet.amount >= a * PRESS_CAP) continue;
    const next = Math.min(bet.amount + a, a * PRESS_CAP);
    if (next - bet.amount <= b.cash) {
      b.cash -= next - bet.amount;
      b.actions.push({ type: 'set-amount', betId: bet.id, amount: next });
    }
  }
  return b.plan();
}

/** Place the inside numbers, then take the 5 and 9 down after the first hit and keep 6 and 8 working. */
function insideRegress(state: GameState, spec: StrategySpec): Plan {
  const five = place5(state.rules, spec);
  const six = place6(state.rules, spec);
  const actions: Action[] = [];
  const have = (t: BetTypeId): Bet | undefined => find(state, t);
  const started = have('place-6') !== undefined || have('place-8') !== undefined;
  const regressed = started && have('place-5') === undefined && have('place-9') === undefined;
  if (started && !regressed) {
    if ([5, 6, 8, 9].some((n) => hitLastRoll(state, n))) {
      for (const t of ['place-5', 'place-9'] as const) {
        const bet = have(t);
        if (bet) actions.push({ type: 'remove-bet', betId: bet.id });
      }
    }
    return { actions, blocked: false };
  }
  if (regressed) return { actions, blocked: false };
  return placeNumbers(state, [
    ['place-5', five],
    ['place-6', six],
    ['place-8', six],
    ['place-9', five],
  ]);
}

/** Pass line with a small Any Craps "hedge" on each come-out. */
function passHedge(state: GameState, spec: StrategySpec): Plan {
  const plan = lineStrategy(state, spec, false, 0);
  if (state.phase === 'come-out' && !find(state, 'any-craps')) {
    const spent = plan.actions.reduce((a, x) => a + (x.type === 'place-bet' ? x.amount : 0), 0);
    const hedge = propAmount(state.rules, ceilTo(spec.unit / 5, D));
    if (hedge <= state.bankroll - spent) {
      plan.actions.push({ type: 'place-bet', betType: 'any-craps', amount: hedge });
    }
  }
  return plan;
}

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
  make(
    'dont-come-molly',
    "Don't Molly",
    'lowest-edge',
    "Don't pass plus up to two don't come bets, each with maximum lay odds: three numbers, all on the 7.",
    (s, spec) => molly(s, spec, true),
  ),
  make(
    'buy-4-10',
    'Buy the 4 and 10',
    'practical',
    'Buy the 4 and 10 after a point ($20 at a $5 unit), paying the vig (5% under the standard rules) only when they win.',
    (s, spec) => buyLay4And10(s, spec, 'buy'),
  ),
  make(
    'lay-4-10',
    'Lay the 4 and 10',
    'practical',
    'Lay against the 4 and 10 after a point ($40 at a $5 unit): wins often, pays small, vig per the table rules.',
    (s, spec) => buyLay4And10(s, spec, 'lay'),
  ),
  make(
    'place-6-8-press',
    'Place 6 and 8, press on hits',
    'fun',
    'Place the 6 and 8, then press each by one unit after every hit, up to five times the starting bet.',
    placePress,
  ),
  make(
    'inside-regress',
    'Inside numbers, then regress',
    'fun',
    'Place 5, 6, 8 and 9 ($22 at a $5 unit); after the first hit take down the 5 and 9 and leave $12 on the 6 and 8.',
    insideRegress,
  ),
  make(
    'pass-hedge-any-craps',
    'Pass line with an Any Craps hedge',
    'fun',
    'Pass line, plus a small Any Craps on each come-out to "cover" a loss. About 3.0% vs 1.41% for pass alone: an expensive bet, not safety.',
    passHedge,
  ),
  make(
    'custom',
    'My system',
    'practical',
    'Your own system, built from blocks: a line bet with odds, come bets, numbers, the field, press or regress on a win, Martingale on a loss.',
    customPlan,
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
