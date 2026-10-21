/**
 * Exact math for the bonus side bets (I037): Fire Bet and All/Tall/Small.
 *
 * Both are Markov chains over subsets of the numbers still to collect, solved with exact rationals.
 * Fire: state = distinct points made this hand. Each point cycle establishes point p with
 * probability w_p/24, then makes it with w_p/(w_p+6) or sevens out with 6/(w_p+6). Making a point
 * already in the set loops. All/Tall/Small: state = numbers rolled; any 7 loses, a number outside the
 * set (or already collected) is ignored.
 */
import { ATS_PAYS, FIRE_PAYS, bonusTargets, type BonusBetTypeId } from '../engine/bets';
import type { Cents } from '../engine/types';
import { ways } from './dice';
import { add, div, frac, mul, sub, ONE, ZERO, type Fraction } from './fraction';
import type { RawOutcome } from './outcomes';

export type FirePaytable = Readonly<Record<4 | 5 | 6, number>>;

const POINTS: readonly number[] = [4, 5, 6, 8, 9, 10];
const key = (s: readonly number[]) => s.join(',');

/** Normalized progress: sorted, unique, only numbers the bet can collect. */
export function normalizeProgress(type: BonusBetTypeId, progress: readonly number[] | undefined) {
  const targets = bonusTargets(type);
  return [...new Set((progress ?? []).filter((n) => targets.includes(n)))].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Fire Bet
// ---------------------------------------------------------------------------

interface FireState {
  /** P(the hand ends with exactly k distinct points) for k = 0..6, from this state */
  final: Fraction[];
  /** E[rolls until the bet resolves] from this state (a hand start: next roll is a come-out) */
  rolls: Fraction;
}

const fireCache = new Map<string, FireState>();

/** P(point p is made in one cycle, given a point gets established this cycle) = w/24 * w/(w+6). */
const qMade = (p: number): Fraction => {
  const w = ways(p);
  return mul(frac(w, 24), frac(w, w + 6));
};
/** P(a cycle ends in a seven-out) = sum_p w/24 * 6/(w+6). */
const SEVEN_OUT: Fraction = POINTS.reduce(
  (acc, p) => add(acc, mul(frac(ways(p), 24), frac(6, ways(p) + 6))),
  ZERO,
);
/** Expected rolls of one point cycle: 36/24 come-out rolls + sum_p w/24 * 36/(w+6). */
const CYCLE_ROLLS: Fraction = POINTS.reduce(
  (acc, p) => add(acc, mul(frac(ways(p), 24), frac(36, ways(p) + 6))),
  frac(36, 24),
);

function fireState(made: readonly number[]): FireState {
  const k = key(made);
  const hit = fireCache.get(k);
  if (hit) return hit;
  let out: FireState;
  if (made.length === 6) {
    const final = [ZERO, ZERO, ZERO, ZERO, ZERO, ZERO, ONE];
    out = { final, rolls: ZERO };
  } else {
    // Loops (making a point already made) leave the state: condition on cycles that change it.
    let loop = ZERO;
    for (const p of made) loop = add(loop, qMade(p));
    const leave = sub(ONE, loop); // = SEVEN_OUT + sum over new points
    const final: Fraction[] = [ZERO, ZERO, ZERO, ZERO, ZERO, ZERO, ZERO];
    final[made.length] = div(SEVEN_OUT, leave);
    let rolls = div(CYCLE_ROLLS, leave);
    for (const p of POINTS) {
      if (made.includes(p)) continue;
      const pr = div(qMade(p), leave);
      const next = fireState([...made, p].sort((a, b) => a - b));
      for (let i = 0; i <= 6; i++) final[i] = add(final[i]!, mul(pr, next.final[i]!));
      rolls = add(rolls, mul(pr, next.rolls));
    }
    out = { final, rolls };
  }
  fireCache.set(k, out);
  return out;
}

/** P(hand ends with exactly k distinct points | `made` so far), k = 0..6. */
export function firePointsDistribution(made: readonly number[] = []): Fraction[] {
  return fireState(normalizeProgress('fire', made)).final;
}

/** Expected rolls until a Fire Bet resolves, from a hand start (or a given progress). */
export function fireExpectedRolls(made: readonly number[] = []): Fraction {
  return fireState(normalizeProgress('fire', made)).rolls;
}

/** EV per unit bet of the Fire Bet (negative = house edge), from `made` points. */
export function fireEV(made: readonly number[] = [], pays: FirePaytable = FIRE_PAYS): Fraction {
  const d = firePointsDistribution(made);
  let ev = ZERO;
  let pWin = ZERO;
  for (const k of [4, 5, 6] as const) {
    ev = add(ev, mul(d[k]!, frac(pays[k])));
    pWin = add(pWin, d[k]!);
  }
  return sub(ev, sub(ONE, pWin));
}

// ---------------------------------------------------------------------------
// All / Tall / Small
// ---------------------------------------------------------------------------

interface AtsState {
  pWin: Fraction;
  rolls: Fraction;
}
const atsCache = new Map<string, AtsState>();

function atsState(type: 'all' | 'tall' | 'small', have: readonly number[]): AtsState {
  const k = `${type}|${key(have)}`;
  const hit = atsCache.get(k);
  if (hit) return hit;
  const targets = bonusTargets(type);
  const missing = targets.filter((n) => !have.includes(n));
  let out: AtsState;
  if (missing.length === 0) out = { pWin: ONE, rolls: ZERO };
  else {
    // Per roll: 6 ways lose, w_n ways collect n (n missing), the rest leave the state unchanged.
    const wMissing = missing.reduce((t, n) => t + ways(n), 0);
    const leave = 6 + wMissing;
    let pWin = ZERO;
    let rolls = frac(36, leave);
    for (const n of missing) {
      const pr = frac(ways(n), leave);
      const next = atsState(
        type,
        [...have, n].sort((a, b) => a - b),
      );
      pWin = add(pWin, mul(pr, next.pWin));
      rolls = add(rolls, mul(pr, next.rolls));
    }
    out = { pWin, rolls };
  }
  atsCache.set(k, out);
  return out;
}

/** P(every number of the set rolls before a 7 | `have` already rolled). */
export function atsWinProb(type: 'all' | 'tall' | 'small', have: readonly number[] = []): Fraction {
  return atsState(type, normalizeProgress(type, have)).pWin;
}

export function atsExpectedRolls(
  type: 'all' | 'tall' | 'small',
  have: readonly number[] = [],
): Fraction {
  return atsState(type, normalizeProgress(type, have)).rolls;
}

/** EV per unit bet (negative = house edge). */
export function atsEV(
  type: 'all' | 'tall' | 'small',
  have: readonly number[] = [],
  pays: number = ATS_PAYS[type],
): Fraction {
  const p = atsWinProb(type, have);
  return sub(mul(p, frac(pays)), sub(ONE, p));
}

// ---------------------------------------------------------------------------
// Outcome rows for the generic EV / explanation machinery
// ---------------------------------------------------------------------------

export interface BonusDistribution {
  rows: RawOutcome[];
  expectedRolls: Fraction;
  vigPaid: Cents;
}

const NUMBER_RANGE: Record<'all' | 'tall' | 'small', string> = {
  all: 'every number 2 to 12 (except 7)',
  tall: '8, 9, 10, 11 and 12',
  small: '2, 3, 4, 5 and 6',
};

export function bonusDistribution(
  type: BonusBetTypeId,
  amount: Cents,
  progress: readonly number[] | undefined,
): BonusDistribution {
  const have = normalizeProgress(type, progress);
  const rows: RawOutcome[] = [];
  if (type === 'fire') {
    const d = firePointsDistribution(have);
    const pay = (k: 4 | 5 | 6) => frac(amount * FIRE_PAYS[k]);
    const made = have.length;
    for (const k of [4, 5, 6] as const) {
      if (d[k]!.n === 0n) continue;
      rows.push({
        label:
          k === 6
            ? 'Shooter makes all 6 points'
            : `Shooter makes ${k} different points, then sevens out`,
        probability: d[k]!,
        net: pay(k),
        push: false,
      });
    }
    let pLose = ZERO;
    for (let k = 0; k < 4; k++) pLose = add(pLose, d[k]!);
    rows.push({
      label: made >= 4 ? 'Never happens' : 'Shooter sevens out with fewer than 4 points',
      probability: pLose,
      net: frac(-amount),
      push: false,
    });
    return { rows, expectedRolls: fireExpectedRolls(have), vigPaid: 0 };
  }
  const p = atsWinProb(type, have);
  rows.push({
    label: `${NUMBER_RANGE[type]} all roll before a 7`,
    probability: p,
    net: frac(amount * ATS_PAYS[type]),
    push: false,
  });
  rows.push({
    label: 'A 7 rolls first',
    probability: sub(ONE, p),
    net: frac(-amount),
    push: false,
  });
  return {
    rows: rows.filter((r) => r.probability.n !== 0n),
    expectedRolls: atsExpectedRolls(type, have),
    vigPaid: 0,
  };
}
