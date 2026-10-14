import type { Dice, Die, PointNumber } from '../engine/types';
import { frac, type Fraction } from './fraction';

/** Number of ways (of 36) to roll each total; index = total (0 and 1 unused). */
export const WAYS: readonly number[] = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];

export function ways(total: number): number {
  return WAYS[total] ?? 0;
}
export function pTotal(total: number): Fraction {
  return frac(ways(total), 36);
}
/** Probability of a specific hard pair: always 1/36. */
export function pHard(_n: number): Fraction {
  return frac(1, 36);
}
/** P(point n rolls before 7) = W / (W + 6). */
export function pointWinProb(n: PointNumber): Fraction {
  const w = ways(n);
  return frac(w, w + 6);
}

export const DIE_FACES: readonly Die[] = [1, 2, 3, 4, 5, 6];
/** All 36 ordered dice outcomes. */
export const ALL_DICE: readonly Dice[] = DIE_FACES.flatMap((a) =>
  DIE_FACES.map((b): Dice => [a, b]),
);
