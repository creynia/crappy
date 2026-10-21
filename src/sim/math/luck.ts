import { applyAction } from '../engine/game';
import type { GameEvent, GameState, SessionStats } from '../engine/types';
import { ALL_DICE } from './dice';
import { isBonusType } from '../engine/bets';
import { betEV } from './ev';
import { toNumber } from './fraction';
import { isLineLike } from './outcomes';

/**
 * Analytic EV (cents) of the decisions still standing on the table: line and come bets, from their
 * current state (a pass line at point 6 is worth less than a fresh one). Everything else stays up
 * roll after roll, so only its per-roll result matters and its standing value is taken as 0.
 */
function standingEV(s: GameState): number {
  let v = 0;
  for (const b of s.bets) {
    if (!isLineLike(b.type)) continue;
    v += toNumber(
      betEV(
        { type: b.type, amount: b.amount, point: b.point },
        { phase: s.phase, point: s.point, rules: s.rules },
      ),
    );
  }
  return v;
}

function layoutKey(s: GameState): string {
  let key = s.phase === 'point' ? `p${s.point}` : 'c';
  for (const b of s.bets)
    key += `|${b.type}:${b.amount}:${b.point ?? ''}:${b.working}:${b.parentId ?? ''}:${b.progress?.join('.') ?? ''}`;
  return key;
}

/**
 * Variance (cents^2) of what the next roll adds to the session, as an `applyAction` `varianceFn`.
 * Over the 36 equally likely dice, X = cash net of the roll + the change in the standing EV of the
 * bets still up. E[X] is the (amortised) expected loss already tracked, so the variances of
 * successive rolls add up to the variance of the whole session result, covariance between bets
 * included. Cached per layout and rules.
 */
export function makeVarianceFn(): (s: GameState) => number {
  const cache = new Map<string, number>();
  let rulesRef: GameState['rules'] | null = null;
  return (s) => {
    if (s.bets.length === 0) return 0;
    // Fire and All/Tall/Small run for many rolls with a payout far from the usual: no standing-value
    // model here, so luck is reported as unavailable (NaN is sticky) once one is on the table.
    if (s.bets.some((b) => isBonusType(b.type))) return NaN;
    if (rulesRef !== s.rules) {
      cache.clear();
      rulesRef = s.rules;
    }
    if (cache.size > 5000) cache.clear();
    const key = layoutKey(s);
    let v = cache.get(key);
    if (v === undefined) {
      const before = standingEV(s);
      const xs: number[] = [];
      for (const dice of ALL_DICE) {
        const r = applyAction(s, { type: 'roll', dice });
        if (!r.ok) continue;
        const roll = r.events.find(
          (e): e is Extract<GameEvent, { type: 'dice-rolled' }> => e.type === 'dice-rolled',
        );
        xs.push((roll?.roll.net ?? 0) + standingEV(r.state) - before);
      }
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      v = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
      cache.set(key, v);
    }
    return v;
  };
}

export type LuckVerdict = 'normal' | 'lucky' | 'unlucky';

export interface Luck {
  /** actual minus expected, cents */
  cents: number;
  /** luck in typical swings (standard deviations); null when it cannot be told */
  z: number | null;
  verdict: LuckVerdict;
  /** the session started before luck was tracked, so it can never be shown */
  unknown: boolean;
}

/** Luck of a session: how far the result is from expectation, in standard deviations. */
export function luckOf(
  stats: Pick<SessionStats, 'totalWon' | 'totalLost' | 'expectedLoss' | 'variance'>,
): Luck {
  return luckFrom(stats.totalWon - stats.totalLost, stats.expectedLoss, stats.variance);
}

export function luckFrom(actual: number, expectedLoss: number, variance: number | undefined): Luck {
  const cents = actual + expectedLoss;
  if (variance !== undefined && Number.isNaN(variance))
    return { cents, z: null, verdict: 'normal', unknown: true };
  if (!variance || variance <= 0) return { cents, z: null, verdict: 'normal', unknown: false };
  const z = cents / Math.sqrt(variance);
  // the verdict follows the z that is shown (1 decimal), so "2.0" never reads as normal
  const shown = Math.round(Math.abs(z) * 10) / 10;
  const verdict = shown >= 2 ? (z > 0 ? 'lucky' : 'unlucky') : 'normal';
  return { cents, z, verdict, unknown: false };
}

/** P(Z <= z) for a standard normal (Abramowitz-Stegun 7.1.26). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

/** "within the normal range (about 0.8 typical swings above expected, about 1 in 5 sessions do better)" */
export function luckText(l: Luck): string {
  if (l.unknown)
    return 'not available for this session (bonus bets, or a save from before luck was tracked); reset to see it';
  if (l.z === null) return 'too early to say';
  const n = Math.abs(l.z).toFixed(1);
  const dir = l.z >= 0 ? 'above' : 'below';
  const tail = 1 - normalCdf(Math.abs(l.z));
  const freq =
    Math.abs(l.z) < 0.5
      ? ''
      : `, about 1 in ${Math.max(2, Math.round(1 / tail))} sessions do ${l.z >= 0 ? 'better' : 'worse'}`;
  if (l.verdict === 'lucky') return `unusually lucky (${n} typical swings ${dir} expected${freq})`;
  if (l.verdict === 'unlucky')
    return `unusually unlucky (${n} typical swings ${dir} expected${freq})`;
  if (Math.abs(l.z) < 0.5) return `within the normal range (close to expected)`;
  return `within the normal range (about ${n} typical swings ${dir} expected${freq})`;
}
