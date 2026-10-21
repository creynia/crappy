import type {
  Action,
  BetTypeId,
  Cents,
  GameState,
  PointNumber,
  RulePresetId,
  TableRules,
} from '../engine/types';

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
  | 'hardways-all'
  | 'no-bet'
  | 'my-layout'
  | 'martingale-pass'
  | 'dont-come-molly'
  | 'buy-4-10'
  | 'lay-4-10'
  | 'place-6-8-press'
  | 'inside-regress'
  | 'pass-hedge-any-craps';

/** One bet of a player layout snapshot (used by `my-layout`). */
export interface LayoutBet {
  type: BetTypeId;
  amount: Cents;
  /** come/dont-come and their odds: the number the bet sits on (null/absent = in the box) */
  point?: PointNumber | null;
}
export interface StrategySpec {
  id: StrategyId;
  unit: Cents;
  /** Odds as a multiple of the flat bet; 0 = flat bets only; default depends on the strategy (table max for max-odds ones). */
  oddsMultiple?: number;
  /** Required by `my-layout`: the bets to re-place each roll. */
  layout?: LayoutBet[];
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
  /** Count of each dice total, index 2..12 (0 and 1 unused). Used by the totals histogram. */
  totals: Int32Array;
  endedBy: 'rolls' | 'bust' | 'stop-win' | 'stop-loss';
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
  /** Share of sessions still solvent (not busted) after each roll. [0] is the share able to bet at all (1 unless the bankroll is below the table minimum). */
  survival: Float64Array;
  /** Final equity of every session (cents), in seed order. */
  finals: Int32Array;
  meanFinal: number;
  probAhead: number;
}
export interface ManyOptions {
  onProgress?(p: number): void;
  signal?: AbortSignal;
  schedule?(fn: () => void): void;
  /** Time budget per chunk before yielding (default 16ms). */
  sliceMs?: number;
}
/** Proposed shape (simulator.md §2.4 names the fields but not the type); strategy agent may refine. */
export interface StrategyMetrics {
  edgeOnAction: number;
  expectedLossPerRoll: number; // dollars
  rollsPerDollar: number;
  /** True when the strategy changes its layout over time (press, regress); the numbers describe its starting layout only. */
  approximate?: boolean;
}
