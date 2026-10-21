import { resolveRules } from '../engine';
import type { TableRules } from '../engine';
import {
  oddsMultiplePerDecision,
  strategyMetrics as metrics,
  strategyRatioSigma as ratioSigma,
} from './metrics';
import type { StrategyMetrics, StrategySpec } from './types';

export * from './types';
export { oddsMultiplePerDecision };
export { getStrategy, listStrategies } from './presets';
export { simulateSession, simulateMany, simulateCompare, simulateManyCompare } from './simulate';

export function strategyMetrics(spec: StrategySpec, rules?: TableRules): StrategyMetrics {
  return metrics(spec, rules ?? resolveRules());
}

/** Spread of result-per-dollar-wagered: after n rolls it is about `sigma / sqrt(n)` (see metrics.ts). */
export function strategyRatioSigma(spec: StrategySpec, rules?: TableRules): number {
  return ratioSigma(spec, rules ?? resolveRules());
}
