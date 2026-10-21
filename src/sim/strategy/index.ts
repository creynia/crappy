import { resolveRules } from '../engine';
import type { TableRules } from '../engine';
import {
  exposureOf,
  maxExposure,
  oddsMultiplePerDecision,
  strategyMetrics as metrics,
} from './metrics';
import type { StrategyMetrics, StrategySpec } from './types';

export * from './types';
export { exposureOf, maxExposure, oddsMultiplePerDecision };
export { getStrategy, listStrategies } from './presets';
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
