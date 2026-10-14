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
  };
  autoRoll?: {
    enabled: boolean;
    strategies?: StrategyId[];
    defaultStrategy?: StrategySpec;
    rollOptions?: number[];
    sessions?: number[];
    compareMode?: boolean;
  };
  steps?: SceneStep[];
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
  completeWhen: Condition;
  advance?: 'auto' | 'button';
  showEV?: boolean;
}

export interface ActionMatcher {
  type: ActionType;
  betType?: BetTypeId | BetTypeId[];
  amount?: Cents;
  minAmount?: Cents;
  maxAmount?: Cents;
  oddsMax?: boolean;
}

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { action: ActionMatcher; count?: number }
  | { event: GameEvent['type']; betType?: BetTypeId; count?: number }
  | { rolls: number }
  | { phase: Phase }
  | { point: PointNumber | null }
  | { betOnTable: { type: BetTypeId; minAmount?: Cents } }
  | { bankrollAtLeast: Cents }
  | { bankrollAtMost: Cents }
  | { previewed: BetTypeId }
  | { autoRollCompleted: { minRolls?: number } }
  | { acknowledged: true };

export interface SceneRuntime {
  stepIndex: number;
  stepStartRoll: number;
  counters: Record<string, number>;
  done: boolean;
}

export type SceneInput =
  | { kind: 'action'; action: Action; events: GameEvent[] }
  | { kind: 'previewed'; betType: BetTypeId }
  | { kind: 'acknowledged' }
  | { kind: 'auto-roll-completed'; rolls: number };
