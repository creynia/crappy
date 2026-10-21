import type { Bet, GameState, SessionStats } from '../engine/types';
import { betVariance } from './ev';
import { isLineLike } from './outcomes';
import { toNumber } from './fraction';
import type { BetCtx } from './types';

/**
 * Variance (cents^2) of one resolution of `bet`, as an `applyAction` `varianceFn`.
 * Line and come bets use the fresh come-out situation (the whole decision, not just the point
 * phase); everything else uses the bet's own situation. Cached per rules object.
 */
export function makeVarianceFn(): (bet: Bet, state: GameState) => number {
  const cache = new Map<string, number>();
  let rulesRef: GameState['rules'] | null = null;
  return (bet, state) => {
    if (rulesRef !== state.rules) {
      cache.clear();
      rulesRef = state.rules;
    }
    const line = isLineLike(bet.type);
    const ctx: BetCtx = line
      ? { phase: 'come-out', point: null, rules: state.rules }
      : { phase: state.phase, point: state.point, rules: state.rules };
    const point = line ? null : bet.point;
    const key = `${bet.type}:${bet.amount}:${point ?? ''}:${ctx.phase}:${ctx.point ?? ''}`;
    let v = cache.get(key);
    if (v === undefined) {
      v = toNumber(betVariance({ type: bet.type, amount: bet.amount, point }, ctx));
      cache.set(key, v);
    }
    return v;
  };
}

export type LuckVerdict = 'normal' | 'lucky' | 'unlucky';

export interface Luck {
  /** actual minus expected, cents */
  cents: number;
  /** luck in typical swings (standard deviations); null before any bet has resolved */
  z: number | null;
  verdict: LuckVerdict;
}

/** Luck of a session: how far the result is from expectation, in standard deviations. */
export function luckOf(
  stats: Pick<SessionStats, 'totalWon' | 'totalLost' | 'expectedLoss' | 'variance'>,
): Luck {
  return luckFrom(stats.totalWon - stats.totalLost, stats.expectedLoss, stats.variance);
}

export function luckFrom(actual: number, expectedLoss: number, variance: number | undefined): Luck {
  const cents = actual + expectedLoss;
  if (!variance || variance <= 0) return { cents, z: null, verdict: 'normal' };
  const z = cents / Math.sqrt(variance);
  return { cents, z, verdict: z >= 2 ? 'lucky' : z <= -2 ? 'unlucky' : 'normal' };
}

/** "within the normal range (about 0.8 typical swings)" */
export function luckText(l: Luck): string {
  if (l.z === null) return 'too early to say';
  const n = Math.abs(l.z).toFixed(1);
  if (l.verdict === 'lucky') return `unusually lucky (${n} typical swings above expected)`;
  if (l.verdict === 'unlucky') return `unusually unlucky (${n} typical swings below expected)`;
  return `within the normal range (about ${n} typical ${n === '1.0' ? 'swing' : 'swings'})`;
}
