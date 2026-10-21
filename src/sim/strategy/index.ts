import { resolveRules } from '../engine';
import type { TableRules } from '../engine';
import {
  exposureIsApproximate,
  exposureOf,
  maxExposure,
  oddsMultiplePerDecision,
  strategyMetrics as metrics,
} from './metrics';
import type { StrategyMetrics, StrategySpec } from './types';

export * from './types';
export { exposureIsApproximate, exposureOf, maxExposure, oddsMultiplePerDecision };
export { replayRoll, replayStart, replayTo } from './replay';
export { getStrategy, listStrategies } from './presets';
export { edgeFunnelSigma, peekEdgeFunnelSigma } from './funnel';
export {
  simulateSession,
  simulateMany,
  simulateCompare,
  simulateManyCompare,
  simulateSweep,
} from './simulate';

export function strategyMetrics(spec: StrategySpec, rules?: TableRules): StrategyMetrics {
  return metrics(spec, rules ?? resolveRules());
}

export * from './plan';
