import type {
  Action,
  ActionType,
  BetTypeId,
  Cents,
  Dice,
  GameEvent,
  Phase,
  PointNumber,
  RulePresetId,
  TableRules,
} from '../engine/types';
import type { BetInit } from '../engine/game';
import type { StrategyId, StrategySpec } from '../strategy/types';

export interface SceneConfig {
  id: string;
  version: 1;
  title?: string;
  rules?: Partial<TableRules> | RulePresetId; // default 'standard-vegas'
  bankroll?: Cents; // default 50_000
  phase?: Phase;
  point?: PointNumber | null;
  bets?: BetInit[];
  seed?: number;
  forcedDice?: Dice[];
  onForcedExhausted?: 'random' | 'block';
  allowedBets?: BetTypeId[] | 'all';
  allowedActions?: ActionType[];
  highlightedBets?: BetTypeId[];
  showEV?: boolean;
  evDetail?: 'basic' | 'full';
  whyOpen?: boolean;
  ui?: {
    orientation?: 'auto' | 'portrait' | 'landscape';
    view?: 'table' | 'center';
    chips?: Cents[];
    defaultChip?: Cents;
    showChipRack?: boolean;
    showHistory?: boolean;
    showBankroll?: boolean;
    showRoll?: boolean;
    showSettings?: boolean;
    speed?: 'normal' | 'fast' | 'instant';
    compact?: boolean;
    /** show the one-time "odds are available, 0% edge" nudge after a point is set */
    hints?: boolean;
    /** hide the step panel's Restart (default shown); a challenge keeps its seed */
    showRestart?: boolean;
    /** accessible name of the step panel (default "Lesson step") */
    stepPanelLabel?: string;
  };
  autoRoll?: {
    enabled: boolean;
    strategies?: StrategyId[];
    defaultStrategy?: StrategySpec;
    rollOptions?: number[];
    sessions?: number[];
    compareMode?: boolean;
    /** chart a single session opens with: bankroll (default) or result per dollar wagered */
    chart?: 'bankroll' | 'edge';
    /** per-strategy specs to compare side by side (implies compareMode) */
    compare?: StrategySpec[];
    /** open on the sortable all-presets comparison table */
    table?: boolean;
    /** default "stop when ahead by" amount, in cents; the learner can change it in the panel */
    stopWin?: Cents;
    /** default "stop when behind by" amount, in cents */
    stopLoss?: Cents;
    /** starting bankroll for the auto-roll runs, in cents; default is the scene bankroll */
    bankroll?: Cents;
    /** odds-multiple sweep table instead of the normal form: numbers are x the flat bet, 'max' the table maximum */
    sweep?: { strategy: StrategyId; oddsMultiples: (number | 'max')[] };
  };
  steps?: SceneStep[];
  /** Challenge mode (I030): a scored session of `rolls` rolls; see scene/challenge.ts */
  challenge?: { rolls: number; scoring: { minResolved: Cents } };
}

/** One scripted action of a demo step, played by the runner with an optional caption. */
export interface PlayFrame {
  action: Action;
  /** caption shown as a toast while this action plays */
  say?: string;
  /** ms to wait before the next frame (default depends on speed; 0 at instant speed) */
  pauseMs?: number;
}

export interface SceneStep {
  id: string;
  text: string;
  hint?: string;
  math?: string;
  setup?: {
    bets?: BetInit[];
    bankroll?: Cents;
    phase?: Phase;
    point?: PointNumber | null;
    replaceBets?: boolean;
  };
  forcedDice?: Dice[];
  allowedBets?: BetTypeId[] | 'all';
  allowedActions?: ActionType[];
  highlightedBets?: BetTypeId[];
  expect?: ActionMatcher[];
  /** An in-sim question. With mode 'before-roll' (default) Roll stays locked until it is answered. */
  ask?: StepAsk;
  completeWhen: Condition;
  advance?: 'auto' | 'button';
  showEV?: boolean;
  /**
   * Demo: when the step starts, these actions are played one at a time (bets, rolls with forced dice)
   * with captions, then control is handed back. The learner can Replay or tap to skip to the end.
   * Scripted actions skip the step's allowed-action gate but are counted toward `completeWhen`.
   */
  play?: PlayFrame[];
}

export interface StepAsk {
  q: string;
  options: string[];
  /** index into `options` */
  answer: number;
  explain: string;
  mode?: 'before-roll' | 'any';
}

export interface ActionMatcher {
  type: ActionType;
  betType?: BetTypeId | BetTypeId[];
  amount?: Cents;
  minAmount?: Cents;
  maxAmount?: Cents;
  oddsMax?: boolean;
  /** EXTENSION (I035): only a hop bet on this pair matches (either order). */
  hop?: Dice;
}

/** Outcome of a resolved bet, for `betResolved` (sugar over the bet-won / bet-lost / bet-pushed events). */
export type BetResult = 'won' | 'lost' | 'pushed';

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { action: ActionMatcher; count?: number }
  | { event: GameEvent['type']; betType?: BetTypeId; count?: number }
  | { rolls: number }
  | { phase: Phase }
  | { point: PointNumber | null }
  | { betOnTable: { type: BetTypeId; minAmount?: Cents; point?: PointNumber } }
  | { betResolved: { type: BetTypeId; result?: BetResult } }
  | { bankrollAtLeast: Cents }
  | { bankrollAtMost: Cents }
  | { equityAtLeast: Cents }
  | { equityAtMost: Cents }
  | { previewed: BetTypeId }
  | { autoRollCompleted: { minRolls?: number; oddsMultiple?: number | 'default' } }
  | { acknowledged: true }
  /** the step's `ask` was answered (true) or answered correctly ('correct') */
  | { answered: true | 'correct' };

export interface SceneRuntime {
  stepIndex: number;
  stepStartRoll: number;
  counters: Record<string, number>;
  done: boolean;
  /** current step's condition is met but the step waits for the Next button (advance: 'button') */
  satisfied?: boolean;
}

export type SceneInput =
  | { kind: 'action'; action: Action; events: GameEvent[] }
  | { kind: 'previewed'; betType: BetTypeId }
  | { kind: 'acknowledged' }
  | { kind: 'answered'; correct: boolean }
  | { kind: 'auto-roll-completed'; rolls: number; oddsMultiple?: number | 'default' };
