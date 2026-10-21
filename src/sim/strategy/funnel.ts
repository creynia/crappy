import type { RulePresetId, TableRules } from '../engine/types';
import { simulateSession } from './simulate';
import type { StrategySpec } from './types';

const SESSIONS = 160;
const ROLLS = 300;
const BIG_BANKROLL = 1_000_000_000;

/**
 * Spread of "result per dollar wagered" for a strategy. After n rolls the ratio
 * (actual result / total wagered) has a standard deviation of about `sigma / sqrt(n)` around the
 * house edge, which is what the shrinking funnel on the edge chart draws.
 *
 * It is estimated from a fixed batch of short simulated sessions (deterministic: same seeds every
 * time) rather than derived in closed form, because the dice make a strategy's bets move together
 * (a seven hits every bet at once) and the amount wagered is random too. A few percent of noise.
 */
export function edgeFunnelSigma(
  spec: StrategySpec,
  rules?: Partial<TableRules> | RulePresetId,
): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let seed = 1; seed <= SESSIONS; seed++) {
    const r = simulateSession({
      strategy: spec,
      rolls: ROLLS,
      seed: 7000 + seed,
      bankroll: BIG_BANKROLL,
      ...(rules !== undefined ? { rules } : {}),
    });
    if (r.totalWagered <= 0) continue;
    const ratio = (r.finalEquity - BIG_BANKROLL) / r.totalWagered;
    sum += ratio;
    sumSq += ratio * ratio;
    count++;
  }
  if (count < 2) return 0;
  const mean = sum / count;
  const variance = Math.max(0, sumSq / count - mean * mean);
  // sd of the ratio over `ROLLS` rolls, scaled to one roll
  return Math.sqrt(variance * ROLLS);
}
