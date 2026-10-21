import { resolveRules } from '../engine';
import type { TableRules } from '../engine';
import { oddsMultiplePerDecision, strategyMetrics as metrics } from './metrics';
import type { StrategyMetrics, StrategySpec } from './types';

export * from './types';
export { oddsMultiplePerDecision };
export { getStrategy, listStrategies } from './presets';
export { edgeFunnelSigma } from './funnel';
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
