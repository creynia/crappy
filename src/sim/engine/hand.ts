import type { GameState } from './types';

/**
 * True when the next roll is a new shooter's first come-out roll: no roll yet, or the last roll was a
 * seven-out. Bonus side bets (Fire, All/Tall/Small) may only be placed or changed at this moment.
 */
export function isHandStart(state: GameState): boolean {
  if (state.phase !== 'come-out') return false;
  if (state.rollCount === 0) return true;
  const last = state.history[state.history.length - 1];
  // History is capped, but the latest roll is always kept once rollCount > 0.
  return last !== undefined && last.phaseBefore === 'point' && last.total === 7;
}
