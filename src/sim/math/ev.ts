import { BET_TYPES } from '../engine/bets';
import { isWorking } from '../engine/working';
import type { BetTypeId, Cents, GameState } from '../engine/types';
import { distributionFor, isLineLike, isOddsType, toOutcomes } from './outcomes';
import { add, div, frac, mul, neg, sub, toNumber, ZERO, ONE, type Fraction } from './fraction';
import type { BetCtx, BetLike, EdgeInfo, Outcome } from './types';

export function betOutcomes(bet: BetLike, ctx: BetCtx): Outcome[] {
  return toOutcomes(distributionFor(bet, ctx));
}

/** cents */
export function betEV(bet: BetLike, ctx: BetCtx): Fraction {
  const d = distributionFor(bet, ctx);
  return d.rows.reduce((acc, r) => add(acc, mul(r.probability, r.net)), ZERO);
}

/** EV and variance of rows {p, net}: Var = sum(p * net^2) - EV^2. */
function moments(rows: readonly { p: Fraction; net: Fraction }[]): {
  ev: Fraction;
  variance: Fraction;
} {
  let ev = ZERO;
  let m2 = ZERO;
  for (const r of rows) {
    ev = add(ev, mul(r.p, r.net));
    m2 = add(m2, mul(r.p, mul(r.net, r.net)));
  }
  return { ev, variance: sub(m2, mul(ev, ev)) };
}

/**
 * Variance of the bet's net result, cents^2 (conditioned on the bet resolving, exactly like betEV).
 * Var = sum(p * net^2) - EV^2 over the same distribution rows.
 */
export function betVariance(bet: BetLike, ctx: BetCtx): Fraction {
  const d = distributionFor(bet, ctx);
  return moments(d.rows.map((r) => ({ p: r.probability, net: r.net }))).variance;
}

/** Standard deviation of the bet's net result, cents (sqrt of betVariance). */
export function betStdDev(bet: BetLike, ctx: BetCtx): number {
  return Math.sqrt(toNumber(betVariance(bet, ctx)));
}

/**
 * Variance per ROLL, cents^2: every roll either resolves the bet (probability ways/36) or
 * leaves it alone (net 0). Unlike betVariance this includes the non-resolving rolls, so it is
 * the variance of what one roll does to the bet.
 * Defined whenever the bet's current state resolves (or not) on a single roll: one-roll bets and
 * standing bets (place, buy/lay, hardways, odds, line/come on a point). Throws when the rows chain
 * over several rolls (line/come bets before a point is set).
 */
export function perRollVariance(bet: BetLike, ctx: BetCtx): Fraction {
  const d = distributionFor(bet, ctx);
  const rows = d.rows.map((r) => {
    if (r.ways === undefined) {
      throw new Error(
        `perRollVariance needs a single-roll bet, but ${bet.type} spans several rolls`,
      );
    }
    return { p: frac(r.ways, 36), net: r.net };
  });
  return moments(rows).variance;
}

/** Edge of any bet in its situation (bet.point is honoured for odds / travelled come bets). */
export function edgeOfBet(bet: BetLike, ctx: BetCtx): EdgeInfo {
  const d = distributionFor(bet, ctx);
  const ev = d.rows.reduce((acc, r) => add(acc, mul(r.probability, r.net)), ZERO);
  const pPush = d.rows.filter((r) => r.push).reduce((acc, r) => add(acc, r.probability), ZERO);
  // Edge base is the amount at risk; with upfront vig the vig joins the base (bet + vig).
  const base = frac(bet.amount + d.vigPaid);
  if (base.n === 0n) {
    return {
      perResolved: ZERO,
      perResolvedExPush: ZERO,
      expectedRolls: d.expectedRolls,
      perRoll: ZERO,
    };
  }
  const perResolved = neg(div(ev, base));
  const perResolvedExPush = neg(div(ev, mul(base, sub(ONE, pPush))));
  return {
    perResolved,
    perResolvedExPush,
    expectedRolls: d.expectedRolls,
    perRoll: div(perResolved, d.expectedRolls),
  };
}

/** Edge of a NEW bet in ctx. */
export function betEdge(type: BetTypeId, amount: Cents, ctx: BetCtx): EdgeInfo {
  return edgeOfBet({ type, amount, point: null }, ctx);
}

const COME_OUT: Pick<BetCtx, 'phase' | 'point'> = { phase: 'come-out', point: null };

/** Expected cost per roll (cents, positive = costs money) of keeping this bet up. */
export function lossPerRoll(bet: BetLike, ctx: BetCtx): Fraction {
  if (isOddsType(bet.type) || bet.amount <= 0) return ZERO;
  if (isLineLike(bet.type)) {
    // Amortized over whole line decisions, whether or not a point is set.
    const e = edgeOfBet(
      { type: bet.type, amount: bet.amount, point: null },
      { ...ctx, ...COME_OUT },
    );
    return mul(frac(bet.amount), e.perRoll);
  }
  return mul(frac(bet.amount), edgeOfBet(bet, ctx).perRoll);
}

function lossByType(state: GameState): Map<BetTypeId, Fraction> {
  const ctx: BetCtx = { phase: state.phase, point: state.point, rules: state.rules };
  const out = new Map<BetTypeId, Fraction>();
  for (const bet of state.bets) {
    if (!isWorking(bet, state)) continue;
    out.set(bet.type, add(out.get(bet.type) ?? ZERO, lossPerRoll(bet, ctx)));
  }
  return out;
}

/** cents per roll; pass to engine applyAction as `expectedLossFn` after toNumber. */
export function tableExpectedLossPerRoll(state: GameState): Fraction {
  let total = ZERO;
  for (const f of lossByType(state).values()) total = add(total, f);
  return total;
}

/** Per-bet-type expected loss for the next roll, cents (float); engine `expectedLossByTypeFn`. */
export function expectedLossByTypePerRoll(state: GameState): Partial<Record<BetTypeId, number>> {
  const out: Partial<Record<BetTypeId, number>> = {};
  for (const [t, f] of lossByType(state)) out[t] = toNumber(f);
  return out;
}

/** Fraction of rolls a bet that is off on come-outs actually works (392/557). */
export const POINT_PHASE_SHARE: Fraction = frac(392, 557);

export function offOnComeOut(type: BetTypeId, rules: BetCtx['rules']): boolean {
  const cat = BET_TYPES[type].category;
  if (cat === 'place' || cat === 'buy') return !rules.placeBetsWorkOnComeOut;
  if (cat === 'hardway') return !rules.hardwaysWorkOnComeOut;
  if (type === 'come-odds') return !rules.comeOddsWorkOnComeOut;
  return false;
}
