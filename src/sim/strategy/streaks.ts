import { seedRng, rollDice } from '../engine/rng';
import type { RngState } from '../engine/types';
import { ways } from '../math/dice';
import { frac, toNumber, type Fraction } from '../math/fraction';

/**
 * Gambler's-fallacy lab: scan a seeded stream of dice rolls for a streak, then look at what happens
 * on the NEXT roll (or the next point) and compare it with the exact probability. Pure and chunk-free:
 * 100k rolls take a few tens of milliseconds.
 */

export type StreakCondition =
  /** the last `n` rolls were all 7s */
  | { kind: 'sevens'; n: number }
  /** `n` rolls in a row without a `total` */
  | { kind: 'drought'; total: number; n: number }
  /** `n` points made in a row by the same shooter (a seven-out starts over) */
  | { kind: 'points'; n: number };

export type StreakTarget =
  /** the next roll is a 7 */
  | 'seven'
  /** the next roll is a 6 */
  | 'six'
  /** the next point that gets set is made rather than sevened out */
  | 'point';

export interface StreakConfig {
  seed: number;
  rolls: number;
  condition: StreakCondition;
}

export interface StreakStat {
  target: StreakTarget;
  /** how many times the condition came up (non-overlapping: a longer streak counts once) */
  samples: number;
  hits: number;
  /** hits / samples, or null with no samples */
  frequency: number | null;
  /** the exact probability, ignoring everything that came before */
  exact: Fraction;
  exactNumber: number;
  /** standard error of the frequency if the exact probability is true */
  se: number | null;
  /** (frequency - exact) / se */
  z: number | null;
  /** 95% Wilson interval for the true chance, from what was seen (sound for small samples too) */
  ci: [number, number] | null;
  /** where the observed frequency lands 95% of the time when the exact chance is true (exact +/- 1.96 se) */
  normalRange: [number, number] | null;
  /** at least MIN_SAMPLES: fewer than that tells us nothing */
  enough: boolean;
}

export interface StreakResult {
  rolls: number;
  condition: StreakCondition;
  stats: Record<StreakTarget, StreakStat>;
}

/** P(7) = 1/6, P(6) = 5/36, P(the next point is made) = sum over points of w * w/(w+6) / 24. */
export function exactProbability(target: StreakTarget): Fraction {
  if (target === 'seven') return frac(1, 6);
  if (target === 'six') return frac(5, 36);
  let num = frac(0);
  for (const p of [4, 5, 6, 8, 9, 10]) {
    const w = ways(p);
    num = {
      n: num.n * BigInt(w + 6) + BigInt(w * w) * num.d,
      d: num.d * BigInt(w + 6),
    };
  }
  return frac(num.n, num.d * 24n);
}

const TARGETS: StreakTarget[] = ['seven', 'six', 'point'];

/** Below this many occurrences a frequency is too noisy to say anything about. */
export const MIN_SAMPLES = 30;

/** 95% Wilson score interval for k successes in n trials. */
export function wilson(k: number, n: number): [number, number] {
  const z = 1.96;
  const f = k / n;
  const d = 1 + (z * z) / n;
  const center = (f + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((f * (1 - f)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/** The dice totals of `rolls` seeded rolls. */
export function rollTotals(seed: number, rolls: number): Uint8Array {
  const out = new Uint8Array(rolls);
  let rng: RngState = seedRng(seed);
  for (let i = 0; i < rolls; i++) {
    const [d, next] = rollDice(rng);
    rng = next;
    out[i] = d[0] + d[1];
  }
  return out;
}

export function scanStreaks(cfg: StreakConfig): StreakResult {
  const t = rollTotals(cfg.seed, cfg.rolls);
  const n = t.length;
  const c = cfg.condition;

  // Walk the table: which roll made a point (1) or sevened out (2), and for every roll that SETS a
  // point, how that point ended. `nextOutcome[j]` is how the first point set at roll j or later ended.
  const made = new Uint8Array(n);
  const outcomeAtSet = new Uint8Array(n);
  let point = 0;
  let setAt = -1;
  for (let i = 0; i < n; i++) {
    const v = t[i]!;
    if (point === 0) {
      if (v >= 4 && v <= 10 && v !== 7) {
        point = v;
        setAt = i;
      }
    } else if (v === point || v === 7) {
      made[i] = v === point ? 1 : 2;
      outcomeAtSet[setAt] = made[i]!;
      point = 0;
    }
  }
  const nextOutcome = new Uint8Array(n + 1);
  for (let j = n - 1; j >= 0; j--) nextOutcome[j] = outcomeAtSet[j] || nextOutcome[j + 1]!;

  const samples: number[] = [0, 0, 0];
  const hits: number[] = [0, 0, 0];
  let run = 0; // current run length of the streak being tracked
  let hand = 0; // points made in a row
  for (let i = 0; i < n - 1; i++) {
    const v = t[i]!;
    let hit: boolean;
    if (c.kind === 'sevens') {
      run = v === 7 ? run + 1 : 0;
      hit = run === c.n;
    } else if (c.kind === 'drought') {
      run = v === c.total ? 0 : run + 1;
      hit = run === c.n;
    } else {
      if (made[i] === 1) hand++;
      else if (made[i] === 2) hand = 0;
      // count it once, on the roll that completes the n-th point
      hit = made[i] === 1 && hand === c.n;
    }
    if (!hit) continue;
    const next = t[i + 1]!;
    samples[0]!++;
    if (next === 7) hits[0]!++;
    samples[1]!++;
    if (next === 6) hits[1]!++;
    // the next point that gets set after this roll (only when it is decided inside the stream)
    const cyc = nextOutcome[i + 1]!;
    if (cyc !== 0) {
      samples[2]!++;
      if (cyc === 1) hits[2]!++;
    }
  }

  const stats = {} as Record<StreakTarget, StreakStat>;
  TARGETS.forEach((target, k) => {
    const exact = exactProbability(target);
    const p = toNumber(exact);
    const s = samples[k]!;
    const h = hits[k]!;
    const f = s > 0 ? h / s : null;
    const se = s > 0 ? Math.sqrt((p * (1 - p)) / s) : null;
    stats[target] = {
      target,
      samples: s,
      hits: h,
      frequency: f,
      exact,
      exactNumber: p,
      se,
      z: f !== null && se ? (f - p) / se : null,
      ci: s > 0 ? wilson(h, s) : null,
      normalRange: se !== null ? [Math.max(0, p - 1.96 * se), Math.min(1, p + 1.96 * se)] : null,
      enough: s >= MIN_SAMPLES,
    };
  });
  return { rolls: n, condition: c, stats };
}
