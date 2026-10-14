import type { Dice, Die, RngState } from './types';

/** splitmix32 -> 4 words; all-zero state impossible. */
export function seedRng(_seed: number): RngState {
  throw new Error('TODO(engine)');
}
/** xoshiro128** */
export function nextU32(_r: RngState): [number, RngState] {
  throw new Error('TODO(engine)');
}
export function rollDie(_r: RngState): [Die, RngState] {
  throw new Error('TODO(engine)');
}
export function rollDice(_r: RngState): [Dice, RngState] {
  throw new Error('TODO(engine)');
}
