import type { Action, BetTypeId, Cents, GameState, Validation } from './types';

export function validateAction(_state: GameState, _action: Action): Validation {
  throw new Error('TODO(engine)');
}
export function legalBetTypes(_state: GameState): BetTypeId[] {
  throw new Error('TODO(engine)');
}
export function maxOddsAmount(_state: GameState, _parentId: string): Cents {
  throw new Error('TODO(engine)');
}
export function suggestAmount(_betType: BetTypeId, _amount: Cents, _state: GameState): Cents {
  throw new Error('TODO(engine)');
}
