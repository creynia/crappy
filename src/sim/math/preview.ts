import { BET_TYPES } from '../engine/bets';
import { isWorking } from '../engine/working';
import { maxOddsAmount, suggestAmount, validateAction } from '../engine/validate';
import type { Action, Bet, BetTypeId, Cents, GameState, Validation } from '../engine/types';
import {
  betEV,
  edgeOfBet,
  lossPerRoll,
  offOnComeOut,
  POINT_PHASE_SHARE,
  tableExpectedLossPerRoll,
} from './ev';
import { explainBet } from './explain';
import { money, pct } from './format';
import { cmp, frac, mul, neg, sub, ZERO, type Fraction } from './fraction';
import { edgeTier } from './tiers';
import type {
  ActionPreview,
  Alternative,
  BetCtx,
  BetLike,
  EdgeInfo,
  EdgeTier,
  Explanation,
  PreviewOptions,
} from './types';

type PlaceAction = Extract<Action, { type: 'place-bet' }>;

const ctxOf = (state: GameState): BetCtx => ({
  phase: state.phase,
  point: state.point,
  rules: state.rules,
});

/** The point an odds bet would sit on, from its parent. */
function oddsPoint(state: GameState, type: BetTypeId, parentId?: string) {
  if (type === 'pass-odds' || type === 'dont-pass-odds') return state.point;
  const parent = state.bets.find((b) => b.id === parentId);
  return parent?.point ?? null;
}

function newBet(state: GameState, a: PlaceAction): BetLike {
  const isOdds = BET_TYPES[a.betType].category === 'odds';
  return {
    type: a.betType,
    amount: a.amount,
    point: isOdds ? oddsPoint(state, a.betType, a.parentId) : null,
  };
}

function edgeText(edge: EdgeInfo, ev: Fraction): string {
  if (edge.perResolved.n === 0n) return 'no house edge, the best bet in the casino';
  if (edge.perResolved.n < 0n) return `player edge ${pct(neg(edge.perResolved))}`;
  void ev;
  return `house edge ${pct(edge.perResolved)}`;
}

const emptyExplanation: Explanation = { rows: [], evFormula: '' };

function perHour(cost: Fraction, bet: BetLike | null, state: GameState, rph: number): Fraction {
  let h = mul(cost, frac(rph));
  if (bet && offOnComeOut(bet.type, state.rules)) h = mul(h, POINT_PHASE_SHARE);
  return h;
}

export function previewAction(
  state: GameState,
  action: Action,
  opts: PreviewOptions = {},
): ActionPreview {
  const rph = opts.rollsPerHour ?? 100;
  const validation: Validation = validateAction(state, action);
  const ctx = ctxOf(state);
  const base = {
    action,
    validation,
    edge: null as EdgeInfo | null,
    tier: 'free' as EdgeTier,
    alternative: null as Alternative | null,
    explanation: emptyExplanation,
    rollsPerHour: rph,
  };
  const perRollText = (cost: Fraction): string =>
    `About ${money(neg(cost))} per roll while it's working`;
  const hourText = (h: Fraction): string => `about ${money(neg(h))} per hour at ${rph} rolls/hour`;

  try {
    switch (action.type) {
      case 'place-bet': {
        const bet = newBet(state, action);
        const ev = betEV(bet, ctx);
        const edge = edgeOfBet(bet, ctx);
        const cost = lossPerRoll(bet, ctx);
        const h = perHour(cost, bet, state, rph);
        const def = BET_TYPES[bet.type];
        const extra = def.oneRoll ? ' One-roll bet: its edge is paid on every roll.' : '';
        const alt = validation.ok ? suggestAlternative(state, action, opts) : null;
        return {
          ...base,
          evCents: ev,
          edge,
          tier: edgeTier(edge.perResolved),
          perRollCents: cost,
          perHourCents: h,
          headline: `Expected value: ${money(ev)} (${edgeText(edge, ev)})`,
          detail: `${perRollText(cost)} (${pct(edge.perRoll)}/roll), ${hourText(h)}.${extra}`,
          alternative: alt,
          explanation: explainBet(bet, ctx),
        };
      }
      case 'set-amount': {
        const old = state.bets.find((b) => b.id === action.betId);
        if (!old) return unknown(base, validation);
        const next: BetLike = { type: old.type, amount: action.amount, point: old.point };
        const ev = sub(betEV(next, ctx), betEV(old, ctx));
        const edge = edgeOfBet(next, ctx);
        const cost = sub(lossPerRoll(next, ctx), lossPerRoll(old, ctx));
        const h = perHour(cost, old, state, rph);
        return {
          ...base,
          evCents: ev,
          edge,
          tier: edgeTier(edge.perResolved),
          perRollCents: cost,
          perHourCents: h,
          headline: `Expected value of the change: ${money(ev)} (${edgeText(edge, ev)})`,
          detail: `${perRollText(cost)} (${pct(edge.perRoll)}/roll), ${hourText(h)}.`,
          explanation: explainBet(next, ctx),
        };
      }
      case 'remove-bet': {
        const old = state.bets.find((b) => b.id === action.betId);
        if (!old) return unknown(base, validation);
        const ev = neg(betEV(old, ctx));
        const cost = neg(lossPerRoll(old, ctx));
        const h = perHour(cost, old, state, rph);
        const gives = ev.n < 0n;
        const favourite = old.type === 'dont-pass' || old.type === 'dont-come';
        return {
          ...base,
          evCents: ev,
          tier: gives ? 'avoid' : 'free',
          perRollCents: cost,
          perHourCents: h,
          headline: gives
            ? `Taking this down gives up ${money(neg(ev), true)} of expected value.`
            : ev.n > 0n
              ? `Taking this down saves about ${money(ev)} of expected value.`
              : 'Taking this down does not change your expected value.',
          detail:
            gives && favourite
              ? 'This bet is now the favourite. Taking it down gives up your edge.'
              : `Your expected cost drops by ${money(neg(cost))} per roll.`,
          explanation: explainBet(old, ctx),
        };
      }
      case 'set-working': {
        const old = state.bets.find((b) => b.id === action.betId);
        if (!old) return unknown(base, validation);
        const nowOn = isWorking(old, state);
        const willOn = isWorking({ ...old, working: action.working }, state);
        const loss = lossPerRoll(old, ctx);
        const cost = nowOn === willOn ? ZERO : willOn ? loss : neg(loss);
        const ev = neg(cost);
        const h = perHour(cost, old, state, rph);
        return {
          ...base,
          evCents: ev,
          perRollCents: cost,
          perHourCents: h,
          headline: `Expected value over the next roll: ${money(ev, true)}`,
          detail: willOn
            ? 'The bet will work on the next roll.'
            : 'The bet will not work on the next roll.',
          explanation: explainBet(old, ctx),
        };
      }
      case 'roll': {
        const loss = tableExpectedLossPerRoll(state);
        return {
          ...base,
          evCents: neg(loss),
          perRollCents: loss,
          perHourCents: mul(loss, frac(rph)),
          headline: `Expected cost of this roll: ${money(loss)}`,
          detail: `Across your working bets, ${hourText(mul(loss, frac(rph)))}.`,
        };
      }
    }
  } catch {
    return unknown(base, validation);
  }
}

function unknown(
  base: Omit<ActionPreview, 'evCents' | 'perRollCents' | 'perHourCents' | 'headline' | 'detail'>,
  validation: Validation,
): ActionPreview {
  return {
    ...base,
    evCents: ZERO,
    perRollCents: ZERO,
    perHourCents: ZERO,
    headline: validation.ok ? 'Expected value: $0.00' : validation.message,
    detail: '',
  };
}

// ---------- alternatives ----------

/** curriculum.md §6.3 (plus decisions.md additions). Order = preference. */
const ALTERNATIVES: Partial<Record<BetTypeId, BetTypeId[]>> = {
  'place-4': ['buy-4'],
  'place-10': ['buy-10'],
  'buy-6': ['place-6'],
  'buy-8': ['place-8'],
  'big-6': ['place-6'],
  'big-8': ['place-8'],
  'hard-6': ['place-6'],
  'hard-8': ['place-8'],
  'hard-4': ['buy-4'],
  'hard-10': ['buy-10'],
  'place-5': ['come', 'buy-5'],
  'place-9': ['come', 'buy-9'],
  field: ['pass-line', 'come'],
  'any-7': ['dont-pass', 'dont-come', 'lay-4'],
  'any-craps': ['pass-line', 'come'],
  'c-e': ['pass-line', 'come'],
  'aces-2': ['pass-line', 'come'],
  'ace-deuce-3': ['pass-line', 'come'],
  'yo-11': ['pass-line', 'come'],
  'boxcars-12': ['pass-line', 'come'],
  horn: ['pass-line', 'come'],
  world: ['pass-line', 'come'],
  'lay-5': ['dont-come', 'dont-pass'],
  'lay-6': ['dont-come', 'dont-pass'],
  'lay-8': ['dont-come', 'dont-pass'],
  'lay-9': ['dont-come', 'dont-pass'],
};

const MIN_IMPROVEMENT = frac(1, 400); // 0.25 percentage points

const ODDS_FOR: Partial<Record<BetTypeId, BetTypeId>> = {
  'pass-line': 'pass-odds',
  'dont-pass': 'dont-pass-odds',
  come: 'come-odds',
  'dont-come': 'dont-come-odds',
};

function makeAlternative(
  state: GameState,
  chosen: PlaceAction,
  chosenEdge: EdgeInfo,
  alt: PlaceAction,
  verb: string,
): Alternative | null {
  if (!validateAction(state, alt).ok) return null;
  const ctx = ctxOf(state);
  const edge = edgeOfBet(newBet(state, alt), ctx);
  const savings = mul(sub(chosenEdge.perResolved, edge.perResolved), frac(chosen.amount));
  const label = BET_TYPES[alt.betType].label;
  return {
    action: alt,
    label,
    edge,
    savingsCents: savings,
    message:
      edge.perResolved.n === 0n
        ? `${verb}${label}: no house edge (saves about ${money(savings)} per bet on average)`
        : `${verb}${label} instead: edge ${pct(edge.perResolved)} (saves about ${money(savings)} per bet on average)`,
  };
}

export function suggestAlternative(
  state: GameState,
  action: PlaceAction,
  _opts: PreviewOptions = {},
): Alternative | null {
  const ctx = ctxOf(state);
  let chosenEdge: EdgeInfo;
  try {
    chosenEdge = edgeOfBet(newBet(state, action), ctx);
  } catch {
    return null;
  }
  if (cmp(chosenEdge.perResolved, ZERO) <= 0) return null;

  // 1. Add odds to a flat bet with room left.
  if (BET_TYPES[action.betType].category !== 'odds') {
    for (const flat of state.bets) {
      const oddsType = ODDS_FOR[flat.type];
      if (!oddsType) continue;
      if ((flat.type === 'pass-line' || flat.type === 'dont-pass') && state.phase !== 'point')
        continue;
      if ((flat.type === 'come' || flat.type === 'dont-come') && flat.point === null) continue;
      let room: Cents;
      try {
        room = maxOddsAmount(state, flat.id);
      } catch {
        continue;
      }
      if (room <= 0) continue;
      const amt = suggestAmount(oddsType, Math.min(action.amount, room), state);
      const odds: PlaceAction = {
        type: 'place-bet',
        betType: oddsType,
        amount: amt,
        parentId: flat.id,
      };
      const made = makeAlternative(state, action, chosenEdge, odds, 'Add ');
      if (made) return made;
    }
  }

  // 2. Curated list; first legal candidate that is clearly cheaper.
  for (const cand of ALTERNATIVES[action.betType] ?? []) {
    const amt = suggestAmount(cand, action.amount, state);
    const alt: PlaceAction = { type: 'place-bet', betType: cand, amount: amt };
    if (!validateAction(state, alt).ok) continue;
    const edge = edgeOfBet(newBet(state, alt), ctx);
    if (cmp(sub(chosenEdge.perResolved, edge.perResolved), MIN_IMPROVEMENT) < 0) continue;
    const made = makeAlternative(state, action, chosenEdge, alt, '');
    if (made) return made;
  }
  return null;
}
