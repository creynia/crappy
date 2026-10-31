/*
 * Seeded randomness. Credits:
 * - xoshiro128** by David Blackman and Sebastiano Vigna (https://prng.di.unimi.it/, public domain).
 * - splitmix32 seeding, with the 0x9e3779b9 / 0x21f0aaad / 0x735a2d97 constants as widely shared in
 *   JavaScript (e.g. bryc's PRNG gist); the multiplier constants come from Chris Wellons'
 *   hash-prospector work.
 * This is an independent, immutable-state TypeScript implementation.
 */
import type { Dice, Die, RngState } from './types';

/** One step of splitmix32; returns [output, nextCounter]. */
function splitmix32(a: number): [number, number] {
  const next = (a + 0x9e3779b9) | 0;
  let t = next ^ (next >>> 16);
  t = Math.imul(t, 0x21f0aaad);
  t = t ^ (t >>> 15);
  t = Math.imul(t, 0x735a2d97);
  t = t ^ (t >>> 15);
  return [t >>> 0, next];
}

/** splitmix32 -> 4 words; all-zero state impossible. */
export function seedRng(seed: number): RngState {
  const [o0, c0] = splitmix32(Math.trunc(seed) | 0);
  const [o1, c1] = splitmix32(c0);
  const [o2, c2] = splitmix32(c1);
  const [o3] = splitmix32(c2);
  return { s: [(o0 | o1 | o2 | o3) === 0 ? 1 : o0, o1, o2, o3] };
}

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/** xoshiro128** */
export function nextU32(r: RngState): [number, RngState] {
  const [s0, s1, s2, s3] = r.s;
  const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
  const t = (s1 << 9) >>> 0;
  let n2 = (s2 ^ s0) >>> 0;
  let n3 = (s3 ^ s1) >>> 0;
  const n1 = (s1 ^ n2) >>> 0;
  const n0 = (s0 ^ n3) >>> 0;
  n2 = (n2 ^ t) >>> 0;
  n3 = rotl(n3, 11);
  return [result, { s: [n0, n1, n2, n3] }];
}

/** Rejection sampling: draw u < 4294967292 (= floor(2^32/6)*6), die = u % 6 + 1. */
export const DIE_REJECT_LIMIT = 4294967292;

export function rollDie(r: RngState): [Die, RngState] {
  let state = r;
  for (;;) {
    const [u, next] = nextU32(state);
    state = next;
    if (u < DIE_REJECT_LIMIT) return [((u % 6) + 1) as Die, state];
  }
}

export function rollDice(r: RngState): [Dice, RngState] {
  const [a, r1] = rollDie(r);
  const [b, r2] = rollDie(r1);
  return [[a, b], r2];
}
