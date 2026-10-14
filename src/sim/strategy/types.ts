import type { Action, Cents, GameState, TableRules, RulePresetId } from '../engine/types';

export type StrategyLens = 'lowest-edge' | 'practical' | 'fun';
export type StrategyId =
  | 'pass-max-odds'
  | 'dont-pass-max-lay'
  | 'pass-2x-odds'
  | 'three-point-molly'
  | 'place-6-8'
  | 'iron-cross'
  | 'across'
  | 'field-every-roll'
  | 'any-7-every-roll'
  | 'hardways-all';

export interface StrategySpec {
  id: StrategyId;
  unit: Cents;
  oddsMultiple?: number; // default: table max
}
export interface Strategy {
  id: StrategyId;
  name: string;
  lens: StrategyLens;
  description: string;
  /** Actions to take before the next roll so the layout matches the strategy. Must return only legal actions. */
  decide(state: GameState, spec: StrategySpec): Action[];
}

export interface SessionConfig {
  strategy: StrategySpec;
  rolls: number;
  seed: number;
  bankroll: Cents;
  rules?: Partial<TableRules> | RulePresetId;
  stopAtBust?: boolean; // default true
  stopWin?: Cents;
  stopLoss?: Cents;
}
export interface SessionResult {
  rollsPlayed: number;
  equity: Int32Array; // after each roll; [0] = start
  expected: Float64Array; // start - cumulative stats.expectedLoss
  finalEquity: Cents;
  totalWagered: Cents;
  expectedLoss: number;
  actualLoss: Cents;
  maxDrawdown: Cents;
  peakEquity: Cents;
  bustedAtRoll: number | null;
  pointsMade: number;
  sevenOuts: number;
  longestHand: number;
}
export interface ManyResult {
  sessions: number;
  p10: Float64Array;
  p50: Float64Array;
  p90: Float64Array;
  expected: Float64Array;
  bustRate: number;
  meanFinal: number;
  probAhead: number;
}
export interface ManyOptions {
  onProgress?(p: number): void;
  signal?: AbortSignal;
  schedule?(fn: () => void): void;
}
/** Proposed shape (simulator.md §2.4 names the fields but not the type); strategy agent may refine. */
export interface StrategyMetrics {
  edgeOnAction: number;
  expectedLossPerRoll: number; // dollars
  rollsPerDollar: number;
}
