import type {
  Bet,
  BetCategory,
  BetTypeDef,
  BetTypeId,
  Cents,
  PointNumber,
  Resolution,
  RollContext,
  TableRules,
} from './types';

/** Every canonical bet id (decisions.md: includes buy/lay 5/6/8/9 and `world`). */
export const BET_TYPE_IDS: readonly BetTypeId[] = [
  'pass-line',
  'dont-pass',
  'come',
  'dont-come',
  'pass-odds',
  'dont-pass-odds',
  'come-odds',
  'dont-come-odds',
  'place-4',
  'place-5',
  'place-6',
  'place-8',
  'place-9',
  'place-10',
  'buy-4',
  'buy-5',
  'buy-6',
  'buy-8',
  'buy-9',
  'buy-10',
  'lay-4',
  'lay-5',
  'lay-6',
  'lay-8',
  'lay-9',
  'lay-10',
  'field',
  'big-6',
  'big-8',
  'hard-4',
  'hard-6',
  'hard-8',
  'hard-10',
  'any-7',
  'any-craps',
  'yo-11',
  'aces-2',
  'boxcars-12',
  'ace-deuce-3',
  'horn',
  'c-e',
  'world',
];

/** Bets that exist only on a crapless table (rules.variant 'crapless'); not in the standard catalogue. */
export const CRAPLESS_BET_TYPE_IDS: readonly BetTypeId[] = [
  'place-2',
  'place-3',
  'place-11',
  'place-12',
];

/** Don't-side bets: unavailable in crapless craps. */
const DONT_SIDE = new Set<BetTypeId>([
  'dont-pass',
  'dont-come',
  'dont-pass-odds',
  'dont-come-odds',
]);

/** Whether a bet type exists under these rules (crapless: no don't side; place 2/3/11/12 only there). */
export function betTypeAvailable(type: BetTypeId, rules: Pick<TableRules, 'variant'>): boolean {
  if (rules.variant === 'crapless') return !DONT_SIDE.has(type);
  return !CRAPLESS_BET_TYPE_IDS.includes(type);
}

// ---------------------------------------------------------------------------
// Payout helpers
// ---------------------------------------------------------------------------

/** floor(amount * x / y) rounded down to `unit` (integer math). */
export function payout(amount: Cents, x: number, y: number, unit: Cents = 1): Cents {
  return Math.floor((amount * x) / (y * unit)) * unit;
}

/** Vig on `base` cents (buy: the bet; lay: the potential win). */
export function computeVig(base: Cents, rules: TableRules): Cents {
  const ppm = Math.round(rules.vig.rate * 1e6);
  if (rules.vig.rounding === 'exact-cents') return Math.round((base * ppm) / 1e6);
  return Math.max(100, Math.floor((base * ppm) / 1e8) * 100);
}

type Ratio = readonly [number, number];
const R = (x: number, y: number): Ratio => [x, y];

const PLACE: Record<PointNumber, Ratio> = {
  2: R(11, 2),
  3: R(11, 4),
  4: R(9, 5),
  5: R(7, 5),
  6: R(7, 6),
  8: R(7, 6),
  9: R(7, 5),
  10: R(9, 5),
  11: R(11, 4),
  12: R(11, 2),
};
/** True odds: buy / pass-odds / come-odds. */
const TRUE_ODDS: Record<PointNumber, Ratio> = {
  2: R(6, 1),
  3: R(3, 1),
  4: R(2, 1),
  5: R(3, 2),
  6: R(6, 5),
  8: R(6, 5),
  9: R(3, 2),
  10: R(2, 1),
  11: R(3, 1),
  12: R(6, 1),
};
/** True odds against: lay / dont odds. */
const LAY_ODDS: Record<PointNumber, Ratio> = {
  2: R(1, 6),
  3: R(1, 3),
  4: R(1, 2),
  5: R(2, 3),
  6: R(5, 6),
  8: R(5, 6),
  9: R(2, 3),
  10: R(1, 2),
  11: R(1, 3),
  12: R(1, 6),
};

/** Ratio [profit, stake] for point-based bets; null for the rest. */
export function payRatio(type: BetTypeId, point: PointNumber | null): Ratio | null {
  const def = BET_TYPES[type];
  const n = def.number ?? point;
  switch (def.category) {
    case 'place':
      return n === null ? null : PLACE[n];
    case 'buy':
      return n === null ? null : TRUE_ODDS[n];
    case 'lay':
      return n === null ? null : LAY_ODDS[n];
    case 'odds':
      if (point === null) return null;
      return type === 'pass-odds' || type === 'come-odds' ? TRUE_ODDS[point] : LAY_ODDS[point];
    default:
      return null;
  }
}

/** Upfront vig (cents) charged at placement for a buy/lay of `amount`; 0 otherwise. */
export function upfrontVig(type: BetTypeId, amount: Cents, rules: TableRules): Cents {
  if (rules.vig.timing !== 'upfront') return 0;
  return nominalVig(type, amount, rules);
}

/** The vig this buy/lay would pay (regardless of timing); 0 for other bets. */
export function nominalVig(type: BetTypeId, amount: Cents, rules: TableRules): Cents {
  const def = BET_TYPES[type];
  if (def.category === 'buy') return computeVig(amount, rules);
  if (def.category === 'lay') {
    const r = payRatio(type, null);
    return r ? computeVig(payout(amount, r[0], r[1], rules.payoutUnit), rules) : 0;
  }
  return 0;
}

/**
 * Vig deducted from a win. With the upfront variant the vig paid at placement covers the bet's first
 * win; resolveRoll then clears bet.vigPaid, so every later win of a bet that stays up pays vig again.
 */
function vigOnWin(bet: Bet, base: Cents, rules: TableRules): Cents {
  return rules.vig.timing === 'upfront' && bet.vigPaid > 0 ? 0 : computeVig(base, rules);
}

/** True for bets whose `working` flag can be toggled. */
export function isToggleable(type: BetTypeId): boolean {
  const c = BET_TYPES[type].category;
  return (
    c === 'place' ||
    c === 'buy' ||
    c === 'lay' ||
    c === 'hardway' ||
    c === 'big' ||
    type === 'come-odds'
  );
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const NONE: Resolution = { kind: 'none' };
const LOSE: Resolution = { kind: 'lose' };
const PUSH: Resolution = { kind: 'push' };
const win = (profit: Cents, vig: Cents = 0): Resolution => ({ kind: 'win', profit, vig });
const ratioStr = (r: Ratio): string => `${r[0]} to ${r[1]}`;

type Resolver = BetTypeDef['resolve'];
interface Spec {
  id: BetTypeId;
  label: string;
  shortLabel: string;
  category: BetCategory;
  number?: PointNumber;
  oneRoll?: boolean;
  afterWin: 'stays-up' | 'comes-down';
  unitMultiple?: number;
  describePayout: BetTypeDef['describePayout'];
  resolve: Resolver;
}

function def(s: Spec): BetTypeDef {
  return {
    id: s.id,
    label: s.label,
    shortLabel: s.shortLabel,
    category: s.category,
    number: s.number ?? null,
    oneRoll: s.oneRoll ?? false,
    afterWin: s.afterWin,
    unitMultiple: s.unitMultiple ?? 1,
    describePayout: s.describePayout,
    resolve: s.resolve,
  };
}

const flat = (text: string) => () => text;

/** Come-out (or come box) result for pass/come; null = the total becomes the bet's point. */
function passLike(r: RollContext, rules: TableRules): Resolution | null {
  if (rules.variant === 'crapless') return r.total === 7 ? win(0) : null;
  if (r.total === 7 || r.total === 11) return win(0);
  if (r.total === 2 || r.total === 3 || r.total === 12) return LOSE;
  return null;
}
function dontLike(r: RollContext, rules: TableRules): Resolution | null {
  if (rules.variant === 'crapless') return r.total === 7 ? LOSE : null; // not offered; kept total
  if (r.total === 2 || r.total === 3) return win(0);
  if (r.total === 12) return PUSH;
  if (r.total === 7 || r.total === 11) return LOSE;
  return null;
}
const even = (bet: Bet, rules: TableRules): Cents => payout(bet.amount, 1, 1, rules.payoutUnit);

const specs: Spec[] = [];

specs.push({
  id: 'pass-line',
  label: 'Pass Line',
  shortLabel: 'PASS',
  category: 'line',
  afterWin: 'stays-up',
  describePayout: flat('1 to 1'),
  resolve(bet, r, rules) {
    if (r.phase === 'come-out') {
      const o = passLike(r, rules);
      if (!o) return NONE;
      return o.kind === 'win' ? win(even(bet, rules)) : o;
    }
    if (r.total === r.point) return win(even(bet, rules));
    return r.total === 7 ? LOSE : NONE;
  },
});
specs.push({
  id: 'dont-pass',
  label: "Don't Pass",
  shortLabel: 'DP',
  category: 'line',
  afterWin: 'stays-up',
  describePayout: flat('1 to 1'),
  resolve(bet, r, rules) {
    if (r.phase === 'come-out') {
      const o = dontLike(r, rules);
      if (!o) return NONE;
      return o.kind === 'win' ? win(even(bet, rules)) : o;
    }
    if (r.total === 7) return win(even(bet, rules));
    return r.total === r.point ? LOSE : NONE;
  },
});
specs.push({
  id: 'come',
  label: 'Come',
  shortLabel: 'COME',
  category: 'come',
  afterWin: 'comes-down',
  describePayout: flat('1 to 1'),
  resolve(bet, r, rules) {
    if (bet.point === null) {
      const o = passLike(r, rules);
      if (o) return o.kind === 'win' ? win(even(bet, rules)) : o;
      return { kind: 'travel', point: r.total as PointNumber };
    }
    if (r.total === bet.point) return win(even(bet, rules));
    return r.total === 7 ? LOSE : NONE;
  },
});
specs.push({
  id: 'dont-come',
  label: "Don't Come",
  shortLabel: 'DC',
  category: 'come',
  afterWin: 'comes-down',
  describePayout: flat('1 to 1'),
  resolve(bet, r, rules) {
    if (bet.point === null) {
      const o = dontLike(r, rules);
      if (o) return o.kind === 'win' ? win(even(bet, rules)) : o;
      return { kind: 'travel', point: r.total as PointNumber };
    }
    if (r.total === 7) return win(even(bet, rules));
    return r.total === bet.point ? LOSE : NONE;
  },
});

// Odds
function oddsSpec(
  id: BetTypeId,
  label: string,
  shortLabel: string,
  good: boolean,
  comeOdds: boolean,
): Spec {
  return {
    id,
    label,
    shortLabel,
    category: 'odds',
    afterWin: 'comes-down',
    describePayout(rules, point) {
      if (point === null)
        return good
          ? `2 to 1 on 4/10, 3 to 2 on 5/9, 6 to 5 on 6/8${rules.variant === 'crapless' ? ', 3 to 1 on 3/11, 6 to 1 on 2/12' : ''}`
          : '1 to 2 on 4/10, 2 to 3 on 5/9, 5 to 6 on 6/8';
      return ratioStr((good ? TRUE_ODDS : LAY_ODDS)[point]);
    },
    resolve(bet, r, rules, working) {
      const p = bet.point ?? r.point;
      if (p === null) return NONE;
      const decided = r.total === 7 || r.total === p;
      if (comeOdds && !working) return decided ? { kind: 'return', reason: 'odds-off' } : NONE;
      const ratio = (good ? TRUE_ODDS : LAY_ODDS)[p];
      const wins = good ? r.total === p : r.total === 7;
      const loses = good ? r.total === 7 : r.total === p;
      if (wins) return win(payout(bet.amount, ratio[0], ratio[1], rules.payoutUnit));
      return loses ? LOSE : NONE;
    },
  };
}
specs.push(oddsSpec('pass-odds', 'Pass Odds', 'ODDS', true, false));
specs.push(oddsSpec('dont-pass-odds', "Don't Pass Odds", 'DP ODDS', false, false));
specs.push(oddsSpec('come-odds', 'Come Odds', 'C ODDS', true, true));
specs.push(oddsSpec('dont-come-odds', "Don't Come Odds", 'DC ODDS', false, false));

function placeSpec(n: PointNumber): Spec {
  return {
    id: `place-${n}` as BetTypeId,
    label: `Place ${n}`,
    shortLabel: `P${n}`,
    category: 'place',
    number: n,
    afterWin: 'stays-up',
    describePayout: () => ratioStr(PLACE[n]),
    resolve(bet, r, rules, working) {
      if (!working) return NONE;
      if (r.total === n) return win(payout(bet.amount, PLACE[n][0], PLACE[n][1], rules.payoutUnit));
      return r.total === 7 ? LOSE : NONE;
    },
  };
}

const NUMS: readonly PointNumber[] = [4, 5, 6, 8, 9, 10];
for (const n of NUMS) {
  specs.push(placeSpec(n));
  specs.push({
    id: `buy-${n}` as BetTypeId,
    label: `Buy ${n}`,
    shortLabel: `B${n}`,
    category: 'buy',
    number: n,
    afterWin: 'stays-up',
    describePayout: (rules) =>
      `${ratioStr(TRUE_ODDS[n])}, ${Math.round(rules.vig.rate * 100)}% vig`,
    resolve(bet, r, rules, working) {
      if (!working) return NONE;
      if (r.total === n) {
        const profit = payout(bet.amount, TRUE_ODDS[n][0], TRUE_ODDS[n][1], rules.payoutUnit);
        return win(profit, vigOnWin(bet, bet.amount, rules));
      }
      return r.total === 7 ? LOSE : NONE;
    },
  });
  specs.push({
    id: `lay-${n}` as BetTypeId,
    label: `Lay ${n}`,
    shortLabel: `L${n}`,
    category: 'lay',
    number: n,
    afterWin: 'stays-up',
    describePayout: (rules) =>
      `${ratioStr(LAY_ODDS[n])}, ${Math.round(rules.vig.rate * 100)}% vig on the win`,
    resolve(bet, r, rules, working) {
      if (!working) return NONE;
      if (r.total === 7) {
        const profit = payout(bet.amount, LAY_ODDS[n][0], LAY_ODDS[n][1], rules.payoutUnit);
        return win(profit, vigOnWin(bet, profit, rules));
      }
      return r.total === n ? LOSE : NONE;
    },
  });
}

specs.push({
  id: 'field',
  label: 'Field',
  shortLabel: 'FIELD',
  category: 'field',
  oneRoll: true,
  afterWin: 'comes-down',
  describePayout: (rules) =>
    `1 to 1 (2 pays ${rules.fieldPays[2]} to 1, 12 pays ${rules.fieldPays[12]} to 1)`,
  resolve(bet, r, rules) {
    const t = r.total;
    if (t === 2) return win(payout(bet.amount, rules.fieldPays[2], 1, rules.payoutUnit));
    if (t === 12) return win(payout(bet.amount, rules.fieldPays[12], 1, rules.payoutUnit));
    if (t === 3 || t === 4 || t === 9 || t === 10 || t === 11) return win(even(bet, rules));
    return LOSE;
  },
});
for (const n of [6, 8] as const) {
  specs.push({
    id: `big-${n}` as BetTypeId,
    label: `Big ${n}`,
    shortLabel: `BIG${n}`,
    category: 'big',
    number: n,
    afterWin: 'stays-up',
    describePayout: flat('1 to 1'),
    resolve(bet, r, rules, working) {
      if (!working) return NONE;
      if (r.total === n) return win(even(bet, rules));
      return r.total === 7 ? LOSE : NONE;
    },
  });
}
for (const n of [4, 6, 8, 10] as const) {
  const x = n === 4 || n === 10 ? 7 : 9;
  specs.push({
    id: `hard-${n}` as BetTypeId,
    label: `Hard ${n}`,
    shortLabel: `H${n}`,
    category: 'hardway',
    number: n,
    afterWin: 'stays-up',
    describePayout: flat(`${x} to 1`),
    resolve(bet, r, rules, working) {
      if (!working) return NONE;
      if (r.total === n) return r.hard ? win(payout(bet.amount, x, 1, rules.payoutUnit)) : LOSE;
      return r.total === 7 ? LOSE : NONE;
    },
  });
}

function prop(
  id: BetTypeId,
  label: string,
  shortLabel: string,
  text: string,
  unitMultiple: number,
  fn: (amount: Cents, total: number, rules: TableRules) => Resolution,
): Spec {
  return {
    id,
    label,
    shortLabel,
    category: 'prop',
    oneRoll: true,
    afterWin: 'comes-down',
    unitMultiple,
    describePayout: flat(text),
    resolve: (bet, r, rules) => fn(bet.amount, r.total, rules),
  };
}
const single =
  (hit: (t: number) => boolean, x: number) => (a: Cents, t: number, rules: TableRules) =>
    hit(t) ? win(payout(a, x, 1, rules.payoutUnit)) : LOSE;

specs.push(
  prop(
    'any-7',
    'Any Seven',
    '7',
    '4 to 1',
    1,
    single((t) => t === 7, 4),
  ),
);
specs.push(
  prop(
    'any-craps',
    'Any Craps',
    'CRAPS',
    '7 to 1',
    1,
    single((t) => t === 2 || t === 3 || t === 12, 7),
  ),
);
specs.push(
  prop(
    'yo-11',
    'Yo (11)',
    'YO',
    '15 to 1',
    1,
    single((t) => t === 11, 15),
  ),
);
specs.push(
  prop(
    'aces-2',
    'Aces (2)',
    'ACES',
    '30 to 1',
    1,
    single((t) => t === 2, 30),
  ),
);
specs.push(
  prop(
    'boxcars-12',
    'Boxcars (12)',
    'BOX',
    '30 to 1',
    1,
    single((t) => t === 12, 30),
  ),
);
specs.push(
  prop(
    'ace-deuce-3',
    'Ace-Deuce (3)',
    'A-D',
    '15 to 1',
    1,
    single((t) => t === 3, 15),
  ),
);
specs.push(
  prop('horn', 'Horn', 'HORN', '27 to 4 on 2/12, 12 to 4 on 3/11', 4, (a, t, rules) => {
    const u = a / 4;
    if (t === 2 || t === 12) return win(payout(u, 27, 1, rules.payoutUnit));
    if (t === 3 || t === 11) return win(payout(u, 12, 1, rules.payoutUnit));
    return LOSE;
  }),
);
specs.push(
  prop('c-e', 'C & E', 'C&E', '6 to 2 on craps, 14 to 2 on 11', 2, (a, t, rules) => {
    const u = a / 2;
    if (t === 2 || t === 3 || t === 12) return win(payout(u, 6, 1, rules.payoutUnit));
    if (t === 11) return win(payout(u, 14, 1, rules.payoutUnit));
    return LOSE;
  }),
);
specs.push(
  prop(
    'world',
    'World (Whirl)',
    'WORLD',
    '26 to 5 on 2/12, 11 to 5 on 3/11, 7 pushes',
    5,
    (a, t, rules) => {
      const u = a / 5;
      if (t === 2 || t === 12) return win(payout(u, 26, 1, rules.payoutUnit));
      if (t === 3 || t === 11) return win(payout(u, 11, 1, rules.payoutUnit));
      return t === 7 ? PUSH : LOSE;
    },
  ),
);

for (const n of [2, 3, 11, 12] as const) specs.push(placeSpec(n));

export const BET_TYPES = Object.fromEntries(specs.map((s) => [s.id, def(s)])) as Record<
  BetTypeId,
  BetTypeDef
>;

export function isBetTypeId(x: unknown): x is BetTypeId {
  return (
    typeof x === 'string' &&
    ((BET_TYPE_IDS as readonly string[]).includes(x) ||
      (CRAPLESS_BET_TYPE_IDS as readonly string[]).includes(x))
  );
}
