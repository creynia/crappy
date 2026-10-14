import type { Dice, GameEvent, GameState } from './types';

export function resolveRoll(
  _state: GameState,
  _dice: Dice,
  _forced: boolean,
): { state: GameState; events: GameEvent[] } {
  throw new Error('TODO(engine)');
}
