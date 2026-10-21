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
  | 'pass-hedge-any-craps'
  | 'custom';

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
  /** Required by `custom`: the player's own system (I013). */
  custom?: CustomSystem;
}

/** Odds behind a line or come bet: a multiple of the flat bet (0 = none) or the table maximum. */
export type OddsSetting = number | 'max';

/**
 * A player's own betting system (I013), built from declarative blocks. Amounts are in units of
 * `StrategySpec.unit` (the flat bet). Every block is optional; at least one bet block is needed.
 */
export interface CustomSystem {
  /** A pass (or don't pass) bet every come-out, with odds once a point is set. */
  line?: { side: 'pass' | 'dont'; odds: OddsSetting };
  /** Up to `count` come (don't come, matching the line side) bets after the point, each with odds. Needs `line`. */
  come?: { count: number; odds: OddsSetting };
  /**
   * Place, buy or lay bets after a point. Each number's amount is `units` x the flat bet, rounded up to
   * the bet's proper unit ($6 on 6/8 and $5 elsewhere for place; buy/lay use the engine's suggested size).
   */
  numbers?: { kind: 'place' | 'buy' | 'lay'; bets: { n: PointNumber; units: number }[] };
  /** A field bet of `units` x the flat bet on every point-phase roll, alongside the numbers. */
  field?: { units: number };
  /** After a number wins: press it by `units` (up to `capTimes` its starting size), or take down all but `keep`. */
  onWin?:
    { kind: 'press'; units: number; capTimes: number } | { kind: 'regress'; keep: PointNumber[] };
  /** After a line loss: double the line bet (Martingale), at most `maxDoublings` times in a row. */
  onLoss?: { kind: 'martingale'; maxDoublings: number };
  /** Walk away when this far ahead / behind (cents); used when the run sets no stop of its own. */
  stopWin?: Cents;
  stopLoss?: Cents;
}
export interface Strategy {
  id: StrategyId;
  name: string;
  lens: StrategyLens;
  description: string;
  /** Bet size grows with losses (martingale): per-dollar statistics that assume steady bets, like the edge chart's funnel, do not apply. */
  escalating?: boolean;
  /** Actions to take before the next roll so the layout matches the strategy. Must return only legal actions. */
  decide(state: GameState, spec: StrategySpec): Action[];
}

/** One recorded roll: the actions the strategy took before it, and the dice that came up. */
export interface SessionLogEntry {
  actions: Action[];
  dice: readonly [number, number];
}

export interface SessionConfig {
  /** Record every roll's actions and dice in `SessionResult.log` (for watch/replay). Off by default. */
  record?: boolean;
  strategy: StrategySpec;
  rolls: number;
  seed: number;
  bankroll: Cents;
  rules?: Partial<TableRules> | RulePresetId;
  stopAtBust?: boolean; // default true
  /**
   * Stop when equity is at least this far above the starting bankroll (cents). Checked after each roll;
   * equity counts bets at face value; bets left up stay on the table. A stop that is reached before a
   * bust ends the session as stop-win; a later bust never happens.
   */
  stopWin?: Cents;
  /** Stop when equity is at least this far below the starting bankroll (cents). Same rules as stopWin. */
  stopLoss?: Cents;
}
export interface SessionResult {
  /** One entry per roll played, only when `SessionConfig.record` was set. */
  log?: SessionLogEntry[];
  rollsPlayed: number;
  equity: Int32Array; // after each roll; [0] = start
  expected: Float64Array; // start - cumulative stats.expectedLoss
  /** Cumulative total wagered (cents) after each roll; [0] = 0. Same length as `equity`. */
  wagered: Float64Array;
  finalEquity: Cents;
  totalWagered: Cents;
  expectedLoss: number;
  /** sum of per-resolution variances, cents^2 (see SessionStats.variance) */
  variance: number;
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
  /** Bonus side-bet payouts (I037): one entry per bet type and paytable level, in first-hit order. */
  bonusHits?: { type: BetTypeId; pays: number; count: number }[];
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
  /** Share of sessions that ended by reaching SessionConfig.stopWin / stopLoss. */
  stopWinRate: number;
  stopLossRate: number;
  /** Mean rolls actually played per session (fewer than the requested rolls when a stop or bust ends it). */
  meanRollsPlayed: number;
  /** Mean analytic expected loss per session (cents), summed over the rolls actually played. */
  meanExpectedLoss: number;
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
  /** Dollars on the table on average in the steady layout (flat bets and odds). */
  avgAction: number;
  /** True when the strategy changes its layout over time (press, regress); the numbers describe its starting layout only. */
  approximate?: boolean;
}

/** One entry of an odds sweep: a number is a multiple of the flat bet, 'max' is the table maximum. */
export type SweepMultiple = number | 'max';
export interface SweepConfig {
  strategy: StrategyId;
  unit: Cents;
  oddsMultiples: SweepMultiple[];
  rolls: number;
  seed: number;
  bankroll: Cents;
  rules?: Partial<TableRules> | RulePresetId;
}
export interface SweepRow {
  multiple: SweepMultiple;
  /** Analytic edge on total action, as a fraction (0.0141 = 1.41%). */
  edgeOnAction: number;
  /** Analytic expected loss over `rolls` rolls, in cents. */
  expectedLossCents: number;
  /** Standard deviation of the final result (cents) over the sessions. */
  sdFinal: number;
  probAhead: number;
  bustRate: number;
  meanFinal: number;
}
