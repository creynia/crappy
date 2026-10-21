import {
  BET_TYPES,
  isBetTypeId,
  isDicePair,
  isToggleable,
  normalizeHop,
  sameHop,
  nominalVig,
  payRatio,
  payout,
  upfrontVig,
} from './bets';
import { isHandStart } from './hand';
import { formatMoney } from './money';
import { isWorking } from './working';
import type {
  Action,
  Bet,
  BetTypeDef,
  BetTypeId,
  Cents,
  Dice,
  GameState,
  PointNumber,
  Validation,
  ValidationCode,
  Warning,
} from './types';

type Fail = Extract<Validation, { ok: false }>;
const fail = (code: ValidationCode, message: string): Fail => ({ ok: false, code, message });

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

// ---------------------------------------------------------------------------
// Lookups shared with game.ts
// ---------------------------------------------------------------------------

function flatTypeFor(odds: BetTypeId): BetTypeId | null {
  switch (odds) {
    case 'pass-odds':
      return 'pass-line';
    case 'dont-pass-odds':
      return 'dont-pass';
    case 'come-odds':
      return 'come';
    case 'dont-come-odds':
      return 'dont-come';
    default:
      return null;
  }
}

/** Parent bet an odds bet would attach to (auto-resolved for pass/dp odds). */
export function findParent(
  state: GameState,
  betType: BetTypeId,
  parentId?: string,
): Bet | undefined {
  const flatType = flatTypeFor(betType);
  if (!flatType) return undefined;
  if (parentId !== undefined) {
    const p = state.bets.find((b) => b.id === parentId);
    return p && p.type === flatType ? p : undefined;
  }
  if (betType === 'pass-odds' || betType === 'dont-pass-odds')
    return state.bets.find((b) => b.type === flatType);
  return undefined;
}

/** The existing instance a new placement of this type merges into, if any (hop: the same pair). */
export function findMergeTarget(
  state: GameState,
  betType: BetTypeId,
  parent?: Bet,
  hop?: Dice,
): Bet | undefined {
  if (betType === 'hop')
    return hop ? state.bets.find((b) => b.type === 'hop' && sameHop(b.hop, hop)) : undefined;
  if (BET_TYPES[betType].category === 'odds')
    return parent
      ? state.bets.find((b) => b.type === betType && b.parentId === parent.id)
      : undefined;
  if (betType === 'come' || betType === 'dont-come')
    return state.bets.find((b) => b.type === betType && b.point === null);
  return state.bets.find((b) => b.type === betType);
}

/** Odds point for a bet attaching to `parent`. */
export function oddsPoint(state: GameState, parent: Bet): PointNumber | null {
  return parent.type === 'pass-line' || parent.type === 'dont-pass' ? state.point : parent.point;
}

function oddsCap(state: GameState, oddsType: BetTypeId, parent: Bet): Cents {
  const p = oddsPoint(state, parent);
  if (p === null) return 0;
  const lay = oddsType === 'dont-pass-odds' || oddsType === 'dont-come-odds';
  return parent.amount * (lay ? state.rules.maxLayOdds[p] : state.rules.maxOdds[p]);
}

/** Maximum TOTAL odds (cents) the parent flat bet may carry right now (ignores bankroll). */
export function maxOddsAmount(state: GameState, parentId: string): Cents {
  const parent = state.bets.find((b) => b.id === parentId);
  if (!parent) return 0;
  const t: BetTypeId | null =
    parent.type === 'pass-line'
      ? 'pass-odds'
      : parent.type === 'dont-pass'
        ? 'dont-pass-odds'
        : parent.type === 'come'
          ? 'come-odds'
          : parent.type === 'dont-come'
            ? 'dont-come-odds'
            : null;
  return t ? oddsCap(state, t, parent) : 0;
}

// ---------------------------------------------------------------------------
// Amount rules
// ---------------------------------------------------------------------------

function minFor(state: GameState, def: BetTypeDef): Cents {
  if (def.category === 'odds') return 100;
  if (def.category === 'prop' || def.category === 'hardway' || def.category === 'bonus')
    return state.rules.propMin;
  return state.rules.tableMin;
}

function bonusTiming(state: GameState, def: BetTypeDef, verb: string): Fail | null {
  if (def.category !== 'bonus' || isHandStart(state)) return null;
  return fail('wrong-phase', `${def.label} can only be ${verb} before a new shooter's first roll.`);
}

function shape(def: BetTypeDef, amount: Cents): Fail | null {
  if (!Number.isInteger(amount) || amount <= 0 || amount % 100 !== 0)
    return fail('bad-amount', 'Bets are placed in whole dollars.');
  if (def.unitMultiple > 1 && amount % (100 * def.unitMultiple) !== 0)
    return fail('unit-multiple', `${def.label} must be a multiple of $${def.unitMultiple}.`);
  return null;
}

function minMax(state: GameState, def: BetTypeDef, total: Cents): Fail | null {
  const min = minFor(state, def);
  if (total < min) return fail('below-min', `The minimum for ${def.label} is ${formatMoney(min)}.`);
  if (def.category !== 'odds' && total > state.rules.tableMax)
    return fail('above-max', `The table maximum is ${formatMoney(state.rules.tableMax)}.`);
  return null;
}

/** Full-pay unit in dollars for a bet with a payout ratio (1 when none). */
function payUnitDollars(type: BetTypeId, point: PointNumber | null): number {
  const r = payRatio(type, point);
  return r ? r[1] / gcd(r[0], r[1]) : 1;
}

function vigTooHigh(type: BetTypeId, amount: Cents, state: GameState): boolean {
  const cat = BET_TYPES[type].category;
  if (cat !== 'buy' && cat !== 'lay') return false;
  const vig = nominalVig(type, amount, state.rules);
  const r = payRatio(type, null);
  if (!r) return false;
  const base = cat === 'buy' ? amount : payout(amount, r[0], r[1], state.rules.payoutUnit);
  return vig * 1e6 > base * Math.round(state.rules.vig.rate * 1e6);
}

/**
 * Smallest clean amount >= `amount`: full-pay, no vig penalty, and at least the table/prop minimum.
 * `opts.point` (or the parent's number via `opts.parentId`) selects the odds unit for odds bets;
 * otherwise the bet's own number, then the table point, is used.
 */
export function suggestAmount(
  betType: BetTypeId,
  amount: Cents,
  state: GameState,
  opts?: { point?: PointNumber | null; parentId?: string },
): Cents {
  const def = BET_TYPES[betType];
  let point: PointNumber | null = def.number;
  if (def.category === 'odds') {
    point = opts?.point ?? null;
    if (point === null) {
      const parent = findParent(state, betType, opts?.parentId);
      point = parent ? oddsPoint(state, parent) : state.point;
    }
  }
  const step = payUnitDollars(betType, point) * def.unitMultiple * 100;
  const floor = Math.max(amount, minFor(state, def));
  let a = Math.max(step, Math.ceil(floor / step) * step);
  for (let i = 0; i < 500; i++, a += step) {
    if (!vigTooHigh(betType, a, state)) return a;
  }
  return amount;
}

function warnings(
  state: GameState,
  def: BetTypeDef,
  total: Cents,
  point: PointNumber | null,
): Warning[] {
  const out: Warning[] = [];
  const r = payRatio(def.id, point);
  if (r && ((total / 100) * r[0]) % r[1] !== 0) {
    const unit = r[1] / gcd(r[0], r[1]);
    const actual = payout(total, r[0], r[1], state.rules.payoutUnit);
    const casino = payout(total, r[0], r[1], 100);
    const sug = Math.ceil(total / (unit * 100)) * unit * 100;
    out.push({
      code: 'short-pay',
      message: `${formatMoney(total)} on ${def.category === 'odds' ? 'these odds' : `the ${point ?? ''}`} pays ${formatMoney(actual)} here; most casinos pay ${formatMoney(casino)}. Bet in ${formatMoney(unit * 100)} units.`,
      suggestedAmount: sug,
    });
  }
  if (vigTooHigh(def.id, total, state)) {
    out.push({
      code: 'vig-rounding',
      message: `The ${formatMoney(nominalVig(def.id, total, state.rules))} vig is more than 5% at this size. Bet more to make the vig worth it.`,
      suggestedAmount: suggestAmount(def.id, total, state, { point }),
    });
  }
  if (state.phase === 'come-out') {
    const probe: Bet = {
      id: '',
      type: def.id,
      amount: total,
      point,
      parentId: null,
      working: 'auto',
      placedOnRoll: 0,
      vigPaid: 0,
    };
    if (isToggleable(def.id) && !isWorking(probe, state)) {
      out.push({
        code: 'off-on-come-out',
        message: `${def.label} will not work until a point is set.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function fundsCheck(state: GameState, cost: Cents): Fail | null {
  return cost > state.bankroll
    ? fail('insufficient-funds', `You only have ${formatMoney(state.bankroll)} in the rack.`)
    : null;
}

function validatePlace(
  state: GameState,
  action: Extract<Action, { type: 'place-bet' }>,
): Validation {
  const { betType, amount, parentId } = action;
  if (!isBetTypeId(betType)) return fail('unknown-bet', `Unknown bet "${String(betType)}".`);
  const def = BET_TYPES[betType];
  if (betType === 'hop') {
    if (!isDicePair(action.hop))
      return fail('bad-dice', 'A hop bet needs a pair of dice, each showing 1 to 6, such as 2-4.');
  } else if (action.hop !== undefined) {
    return fail('bad-dice', `${def.label} does not take a dice pair; only hop bets do.`);
  }
  const shapeErr = shape(def, amount);
  if (shapeErr) return shapeErr;
  const { rules } = state;

  const isOdds = def.category === 'odds';
  const parent = isOdds ? findParent(state, betType, parentId) : undefined;
  const existing = findMergeTarget(
    state,
    betType,
    parent,
    action.hop ? normalizeHop(action.hop) : undefined,
  );
  const total = (existing?.amount ?? 0) + amount;

  // 3. min / max
  const mm = minMax(state, def, total);
  if (mm) return mm;
  // 4. funds
  const vigCost =
    upfrontVig(betType, total, rules) -
    (existing ? upfrontVig(betType, existing.amount, rules) : 0);
  const fe = fundsCheck(state, amount + vigCost);
  if (fe) return fe;
  // 5. phase
  switch (betType) {
    case 'pass-line':
      if (state.phase !== 'come-out' && !rules.allowPutBets)
        return fail('wrong-phase', 'The Pass Line can only be bet before the point is set.');
      break;
    case 'dont-pass':
      if (state.phase !== 'come-out')
        return fail('wrong-phase', "Don't Pass can only be bet before the point is set.");
      break;
    case 'come':
    case 'dont-come':
      if (state.phase === 'come-out')
        return fail('wrong-phase', `${def.label} bets can only be made after a point is set.`);
      break;
    default: {
      const bt = bonusTiming(state, def, 'placed');
      if (bt) return bt;
    }
  }
  // 6. odds
  let point: PointNumber | null = def.number;
  if (isOdds) {
    const flatType = flatTypeFor(betType);
    const flatDef = flatType ? BET_TYPES[flatType] : null;
    if (betType === 'pass-odds' || betType === 'dont-pass-odds') {
      if (state.phase !== 'point' || !parent)
        return fail(
          'needs-parent',
          `${def.label} need a ${flatDef?.label ?? 'flat'} bet and a point.`,
        );
    } else if (!parent || parent.point === null) {
      return fail(
        'needs-parent',
        `${def.label} need a ${flatDef?.label ?? 'flat'} bet that has travelled to a number.`,
      );
    }
    point = oddsPoint(state, parent);
    if (total > oddsCap(state, betType, parent))
      return fail(
        'odds-limit',
        `That is over the odds limit of ${formatMoney(oddsCap(state, betType, parent))}.`,
      );
  }
  return { ok: true, warnings: warnings(state, def, total, point) };
}

function validateSetAmount(
  state: GameState,
  action: Extract<Action, { type: 'set-amount' }>,
): Validation {
  const bet = state.bets.find((b) => b.id === action.betId);
  if (!bet) return fail('unknown-bet', 'That bet is not on the table.');
  const def = BET_TYPES[bet.type];
  const { amount } = action;
  const sh = shape(def, amount);
  if (sh) return sh;
  const { rules } = state;
  const extra: Warning[] = [];
  const onPoint = state.phase === 'point';

  if (amount !== bet.amount) {
    const inc = amount > bet.amount;
    switch (bet.type) {
      case 'pass-line':
        if (onPoint) {
          if (!inc)
            return fail('contract-bet', 'The Pass Line cannot be reduced once a point is set.');
          if (!rules.allowPutBets)
            return fail(
              'cannot-increase',
              'The Pass Line cannot be increased once a point is set.',
            );
        }
        break;
      case 'come':
        if (bet.point !== null)
          return fail('contract-bet', 'A Come bet on a number cannot be changed.');
        break;
      case 'dont-pass':
        if (onPoint && inc)
          return fail('cannot-increase', "Don't Pass cannot be increased once a point is set.");
        if (onPoint)
          extra.push({
            code: 'gives-up-ev',
            message:
              "You have the edge on a Don't Pass bet once a point is set; reducing it gives that up.",
          });
        break;
      case 'dont-come':
        if (bet.point !== null) {
          if (inc)
            return fail('cannot-increase', "A Don't Come bet on a number cannot be increased.");
          extra.push({
            code: 'gives-up-ev',
            message:
              "You have the edge on a Don't Come bet on a number; reducing it gives that up.",
          });
        }
        break;
      default: {
        const bt = bonusTiming(state, def, 'changed');
        if (bt) return bt;
      }
    }
  }
  const mm = minMax(state, def, amount);
  if (mm) return mm;
  const delta = amount - bet.amount;
  if (delta > 0) {
    const fe = fundsCheck(
      state,
      delta + upfrontVig(bet.type, amount, rules) - upfrontVig(bet.type, bet.amount, rules),
    );
    if (fe) return fe;
  }
  let point: PointNumber | null = bet.point ?? def.number;
  if (def.category === 'odds') {
    const parent = state.bets.find((b) => b.id === bet.parentId);
    if (!parent) return fail('needs-parent', 'The flat bet for these odds is gone.');
    point = oddsPoint(state, parent);
    if (amount > oddsCap(state, bet.type, parent))
      return fail(
        'odds-limit',
        `That is over the odds limit of ${formatMoney(oddsCap(state, bet.type, parent))}.`,
      );
  }
  if ((bet.type === 'dont-pass' || bet.type === 'dont-come') && delta < 0) {
    for (const o of state.bets) {
      if (o.parentId === bet.id) {
        const cap = amount * (rules.maxLayOdds[(bet.point ?? state.point) as PointNumber] ?? 0);
        if (o.amount > cap)
          return fail(
            'odds-limit',
            'Your lay odds would be over the limit; take down some odds first.',
          );
      }
    }
  }
  return { ok: true, warnings: [...extra, ...warnings(state, def, amount, point)] };
}

function validateRemove(
  state: GameState,
  action: Extract<Action, { type: 'remove-bet' }>,
): Validation {
  const bet = state.bets.find((b) => b.id === action.betId);
  if (!bet) return fail('unknown-bet', 'That bet is not on the table.');
  if (bet.type === 'pass-line' && state.phase === 'point')
    return fail('contract-bet', 'The Pass Line cannot be taken down once a point is set.');
  if (bet.type === 'come' && bet.point !== null)
    return fail('contract-bet', 'A Come bet on a number cannot be taken down.');
  if (BET_TYPES[bet.type].category === 'bonus')
    return fail(
      'not-removable',
      `${BET_TYPES[bet.type].label} stays up until the hand decides it.`,
    );
  const w: Warning[] = [];
  if (
    (bet.type === 'dont-pass' && state.phase === 'point') ||
    (bet.type === 'dont-come' && bet.point !== null)
  )
    w.push({
      code: 'gives-up-ev',
      message: `Taking down ${BET_TYPES[bet.type].label} gives up your edge on the bet.`,
    });
  return { ok: true, warnings: w };
}

function validateWorking(
  state: GameState,
  action: Extract<Action, { type: 'set-working' }>,
): Validation {
  const bet = state.bets.find((b) => b.id === action.betId);
  if (!bet) return fail('unknown-bet', 'That bet is not on the table.');
  if (!isToggleable(bet.type)) return fail('not-removable', 'This bet is always working.');
  if (action.working !== 'auto' && action.working !== 'on' && action.working !== 'off')
    return fail('not-removable', 'Working must be auto, on or off.');
  return { ok: true, warnings: [] };
}

export function validateAction(state: GameState, action: Action): Validation {
  switch (action.type) {
    case 'place-bet':
      return validatePlace(state, action);
    case 'set-amount':
      return validateSetAmount(state, action);
    case 'remove-bet':
      return validateRemove(state, action);
    case 'set-working':
      return validateWorking(state, action);
    case 'roll':
      if (action.dice) {
        const d = action.dice as readonly number[];
        const ok =
          Array.isArray(d) &&
          d.length === 2 &&
          d.every((x) => Number.isInteger(x) && x >= 1 && x <= 6);
        if (!ok) return fail('bad-amount', 'A roll needs exactly two dice, each showing 1 to 6.');
      }
      return { ok: true, warnings: [] };
    default:
      return fail('unknown-bet', 'Unknown action.');
  }
}

/** Bet types that could be placed right now (ignores bankroll). */
export function legalBetTypes(state: GameState): BetTypeId[] {
  const rich: GameState = { ...state, bankroll: 1e12 };
  const out: BetTypeId[] = [];
  for (const [id, def] of Object.entries(BET_TYPES) as [BetTypeId, BetTypeDef][]) {
    const amount = Math.max(minFor(state, def), 100);
    const unit = 100 * def.unitMultiple;
    const probe = Math.ceil(amount / unit) * unit;
    const viaParent = id === 'come-odds' || id === 'dont-come-odds';
    const ok = viaParent
      ? state.bets.some(
          (b) =>
            validateAction(rich, { type: 'place-bet', betType: id, amount: probe, parentId: b.id })
              .ok,
        )
      : validateAction(rich, {
          type: 'place-bet',
          betType: id,
          amount: probe,
          ...(id === 'hop' ? { hop: [1, 2] as Dice } : {}),
        }).ok;
    if (ok) out.push(id);
  }
  return out;
}
