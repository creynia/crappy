// Seeded randomness for drills, built on the simulator's xoshiro128** (src/sim/engine/rng.ts).
import { nextU32, rollDie, seedRng } from '../../sim/engine';
import type { Dice, Die, RngState } from '../../sim/engine';

export interface DrillRng {
  readonly seed: number;
  /** uniform 32-bit unsigned integer */
  u32(): number;
  /** uniform in [0, 1) */
  float(): number;
  /** uniform integer in [lo, hi] (inclusive), unbiased */
  int(lo: number, hi: number): number;
  /** true with probability p */
  chance(p: number): boolean;
  pick<T>(xs: readonly T[]): T;
  /** a shuffled copy */
  shuffle<T>(xs: readonly T[]): T[];
  die(): Die;
  dice(): Dice;
}

export function createDrillRng(seed: number): DrillRng {
  let state: RngState = seedRng(seed);
  const u32 = () => {
    const [u, next] = nextU32(state);
    state = next;
    return u;
  };
  const int = (lo: number, hi: number) => {
    const span = hi - lo + 1;
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || span < 1 || span > 2 ** 32)
      throw new RangeError(`int(${lo}, ${hi})`);
    const limit = 2 ** 32 - (2 ** 32 % span);
    for (;;) {
      const u = u32();
      if (u < limit) return lo + (u % span);
    }
  };
  const rng: DrillRng = {
    seed,
    u32,
    float: () => u32() / 2 ** 32,
    int,
    chance: (p) => u32() / 2 ** 32 < p,
    pick: <T>(xs: readonly T[]): T => {
      if (xs.length === 0) throw new RangeError('pick from empty list');
      return xs[int(0, xs.length - 1)]!;
    },
    shuffle: <T>(xs: readonly T[]): T[] => {
      const a = [...xs];
      for (let i = a.length - 1; i > 0; i--) {
        const j = int(0, i);
        [a[i], a[j]] = [a[j]!, a[i]!];
      }
      return a;
    },
    die: () => {
      const [d, next] = rollDie(state);
      state = next;
      return d;
    },
    dice: () => [rng.die(), rng.die()] as const,
  };
  return rng;
}

/** The i-th child seed of a seed (well mixed, deterministic, int32). */
export function deriveSeed(seed: number, i: number): number {
  const [u] = nextU32(seedRng((seed + Math.imul(i + 1, 0x9e3779b9)) | 0));
  return u | 0;
}

/** A fresh round seed when none is given (not used inside drills). */
export function randomSeed(): number {
  try {
    return crypto.getRandomValues(new Int32Array(1))[0]!;
  } catch {
    return (Math.random() * 2 ** 32) | 0;
  }
}
