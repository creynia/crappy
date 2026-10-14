import type { TableRules } from '../engine/types';
import type {
  ManyOptions,
  ManyResult,
  SessionConfig,
  SessionResult,
  Strategy,
  StrategyId,
  StrategyMetrics,
  StrategySpec,
} from './types';

export * from './types';

export function getStrategy(_id: StrategyId): Strategy {
  throw new Error('TODO(strategy)');
}
export function listStrategies(): Strategy[] {
  throw new Error('TODO(strategy)');
}
export function simulateSession(_cfg: SessionConfig): SessionResult {
  throw new Error('TODO(strategy)');
}
export function simulateMany(
  _cfg: SessionConfig,
  _sessions: number,
  _opts?: ManyOptions,
): Promise<ManyResult> {
  return Promise.reject(new Error('TODO(strategy)'));
}
export function strategyMetrics(_spec: StrategySpec, _rules: TableRules): StrategyMetrics {
  throw new Error('TODO(strategy)');
}
