import { BET_TYPES } from './bets';
import type {
  Action,
  ApplyResult,
  BetTypeDef,
  BetTypeId,
  Cents,
  Dice,
  GameState,
  Phase,
  PointNumber,
  RulePresetId,
  TableRules,
  WorkingMode,
} from './types';

export interface BetInit {
  ref?: string;
  type: BetTypeId;
  amount: Cents;
  point?: PointNumber;
  parentRef?: string;
  working?: WorkingMode;
}

export interface CreateGameOptions {
  rules?: Partial<TableRules> | RulePresetId;
  bankroll?: Cents; // default 50_000 ($500)
  seed?: number; // default: caller supplies (UI uses crypto.getRandomValues once)
  phase?: Phase;
  point?: PointNumber | null; // must be consistent (point iff phase==='point')
  bets?: BetInit[]; // deducted from bankroll; throws if invalid
  forcedDice?: Dice[];
}

export function createGame(_opts?: CreateGameOptions): GameState {
  throw new Error('TODO(engine)');
}
/** Forced queue first, then RNG. */
export function nextDice(_state: GameState): { dice: Dice; forced: boolean; state: GameState } {
  throw new Error('TODO(engine)');
}
export function applyAction(
  _state: GameState,
  _action: Action,
  _opts?: { expectedLossFn?: (s: GameState) => number },
): ApplyResult {
  throw new Error('TODO(engine)');
}
export { isWorking } from './working';
/** bankroll + sum(bet.amount) */
export function equity(_state: GameState): Cents {
  throw new Error('TODO(engine)');
}
/** Deterministic. */
export function replay(_initial: GameState, _actions: Action[]): GameState {
  throw new Error('TODO(engine)');
}
export function getBetType(id: BetTypeId): BetTypeDef {
  return BET_TYPES[id];
}
