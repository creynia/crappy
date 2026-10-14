import { applyAction, createGame } from '..';
import type { Action, CreateGameOptions, Dice, GameEvent, GameState } from '..';

export const $ = (d: number): number => d * 100;
export const D = (a: number, b: number): Dice => [a as 1, b as 1];

export function game(opts: CreateGameOptions = {}): GameState {
  return createGame({ seed: 7, bankroll: $(1000), ...opts });
}

export function act(s: GameState, a: Action): { state: GameState; events: GameEvent[] } {
  const r = applyAction(s, a);
  if (!r.ok) throw new Error(`${a.type} rejected: ${r.error.code} ${r.error.message}`);
  return { state: r.state, events: r.events };
}

export function bet(
  s: GameState,
  betType: Parameters<typeof placeArg>[0],
  amount: number,
  parentId?: string,
): GameState {
  return act(s, placeArg(betType, amount, parentId)).state;
}
function placeArg(betType: import('..').BetTypeId, amount: number, parentId?: string): Action {
  return { type: 'place-bet', betType, amount: $(amount), ...(parentId ? { parentId } : {}) };
}

export function roll(
  s: GameState,
  a: number,
  b: number,
): { state: GameState; events: GameEvent[] } {
  return act(s, { type: 'roll', dice: D(a, b) });
}

export function rollTotals(s: GameState, ...dice: Array<[number, number]>): GameState {
  let st = s;
  for (const [a, b] of dice) st = roll(st, a, b).state;
  return st;
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

export function betsOf(s: GameState, type: string) {
  return s.bets.filter((b) => b.type === type);
}
