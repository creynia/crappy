import { resolveRules } from '../engine';
import type { Cents, RulePresetId, TableRules } from '../engine/types';
import { strategyMetrics } from './metrics';
import { simulateMany, simulateSession } from './simulate';
import type { ManyOptions, StrategySpec } from './types';

/** What the player chooses on the plan panel. */
export interface PlanInput {
  strategy: StrategySpec;
  bankroll: Cents;
  hours: number;
  rollsPerHour: number;
  rules?: Partial<TableRules> | RulePresetId;
}
export interface PlanOptions extends Omit<ManyOptions, 'onProgress'> {
  /** sessions simulated per estimate (default 500) */
  sessions?: number;
  seed?: number;
  /** target bust probability for the bankroll suggestion (default 0.05) */
  targetBust?: number;
  /** stop counting once the bust rate is certainly above this (the returned rate is then a lower bound) */
  stopAbove?: number;
  onProgress?(p: number): void;
}

export const PLAN_SESSIONS = 500;
export const PLAN_SEED = 1;
const MAX_ROLLS = 10_000;

/** Rolls in a session of `hours` at `rollsPerHour`, at least 1 and at most 10,000. */
export function planRolls(hours: number, rollsPerHour: number): number {
  return Math.min(MAX_ROLLS, Math.max(1, Math.round(hours * rollsPerHour)));
}

/** The instant, analytic part: expected loss over the whole session. */
export function planExpectedLoss(input: PlanInput): { rolls: number; expectedLoss: Cents } {
  const rules = resolveRules(input.rules);
  const rolls = planRolls(input.hours, input.rollsPerHour);
  const m = strategyMetrics(input.strategy, rules);
  return { rolls, expectedLoss: Math.round(m.expectedLossPerRoll * 100 * rolls) };
}

export interface PlanRisk {
  rolls: number;
  sessions: number;
  bustRate: number;
  probAhead: number;
  /** 10th and 90th percentile of the final result (cents, relative to the starting bankroll) */
  p10: Cents;
  p90: Cents;
  /** Mean analytic expected loss actually incurred (cents; lower than rolls x loss/roll when sessions bust early). */
  meanExpectedLoss: Cents;
}

/** Simulated risk for a plan: `sessions` seeded sessions (seeds seed..seed+sessions-1). */
export async function planRisk(input: PlanInput, opts: PlanOptions = {}): Promise<PlanRisk> {
  const rolls = planRolls(input.hours, input.rollsPerHour);
  const sessions = opts.sessions ?? PLAN_SESSIONS;
  const r = await simulateMany(
    {
      strategy: input.strategy,
      rolls,
      seed: opts.seed ?? PLAN_SEED,
      bankroll: input.bankroll,
      ...(input.rules !== undefined ? { rules: input.rules } : {}),
    },
    sessions,
    {
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(opts.schedule ? { schedule: opts.schedule } : {}),
      ...(opts.sliceMs !== undefined ? { sliceMs: opts.sliceMs } : {}),
      ...(opts.onProgress ? { onProgress: (p: number) => opts.onProgress!(p) } : {}),
    },
  );
  return {
    rolls,
    sessions,
    bustRate: r.bustRate,
    probAhead: r.probAhead,
    p10: Math.round(r.p10[r.p10.length - 1]! - input.bankroll),
    p90: Math.round(r.p90[r.p90.length - 1]! - input.bankroll),
    meanExpectedLoss: Math.round(r.meanExpectedLoss),
  };
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());
function abortError(): Error {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

/** Share of `sessions` seeded sessions that go bust. Chunked and abortable. Same seeds for every bankroll. */
export function bustRateAt(
  input: PlanInput,
  bankroll: Cents,
  opts: PlanOptions = {},
): Promise<number> {
  const rolls = planRolls(input.hours, input.rollsPerHour);
  const sessions = opts.sessions ?? PLAN_SESSIONS;
  const seed = opts.seed ?? PLAN_SEED;
  const schedule = (fn: () => void): void => {
    if (opts.schedule) opts.schedule(fn);
    else setTimeout(fn, 0);
  };
  const slice = opts.sliceMs ?? 16;
  return new Promise<number>((resolve, reject) => {
    let done = 0;
    let busts = 0;
    const step = (): void => {
      if (opts.signal?.aborted) return reject(abortError());
      const t0 = now();
      while (done < sessions) {
        const r = simulateSession({
          strategy: input.strategy,
          rolls,
          seed: seed + done,
          bankroll,
          ...(input.rules !== undefined ? { rules: input.rules } : {}),
        });
        if (r.bustedAtRoll !== null) busts++;
        done++;
        // already over the limit: the exact rate no longer matters, only that it is above it
        if (opts.stopAbove !== undefined && busts > opts.stopAbove * sessions)
          return resolve(busts / sessions);
        if (now() - t0 >= slice && done < sessions) return schedule(step);
      }
      resolve(busts / sessions);
    };
    schedule(step);
  });
}

export interface BankrollSuggestion {
  /** a bankroll found with bust probability at or under the target, within `step` of the smallest such; null when none up to the cap */
  bankroll: Cents | null;
  /** bust probability at that bankroll, measured on a fresh, independent set of seeds */
  bustRate: number;
  target: number;
  /** the largest bankroll tried, when none worked */
  cap: Cents;
  /** how closely the answer is pinned down: one bankroll step less was over the target */
  step: Cents;
}

/**
 * A bankroll whose bust probability is at or under `targetBust` (default 5%), within about 5% of the
 * smallest that does (and never coarser than $10). Doubles from the plan's own bankroll until it is
 * safe, then bisects. Every estimate uses the same seeds, so the answer is deterministic and the
 * bust rate does not rise as the bankroll grows. Unsafe candidates are abandoned as soon as they
 * are certainly over the target, which keeps the search quick.
 */
export async function suggestBankroll(
  input: PlanInput,
  opts: PlanOptions & {
    capMultiple?: number;
    searchSessions?: number;
    verifySessions?: number;
  } = {},
): Promise<BankrollSuggestion> {
  const target = opts.targetBust ?? 0.05;
  // aim a little under the target from the start (4% for 5%): the final check is stricter than the
  // probes, so searching to the same margin means it usually passes first time and no work is repeated
  const goal = target * 0.8;
  const unit = input.strategy.unit;
  const base = 1000;
  const cap = Math.ceil((unit * (opts.capMultiple ?? 400)) / base) * base;
  const cache = new Map<Cents, number>();
  const at = async (b: Cents): Promise<number> => {
    let v = cache.get(b);
    if (v === undefined) {
      v = await bustRateAt(input, b, {
        ...opts,
        sessions: opts.searchSessions ?? Math.min(opts.sessions ?? PLAN_SESSIONS, 150),
        stopAbove: goal,
      });
      cache.set(b, v);
    }
    return v;
  };
  let lo = 0; // known unsafe (or zero)
  let hi = Math.max(base, Math.ceil(Math.max(unit, input.bankroll) / base) * base);
  while ((await at(hi)) > goal) {
    lo = hi;
    if (hi >= cap) return { bankroll: null, bustRate: cache.get(hi)!, target, cap: hi, step: base };
    hi = Math.min(cap, hi * 2);
  }
  const step = Math.max(base, Math.round((hi * 0.05) / base) * base);
  while (hi - lo > step) {
    const mid = lo + Math.max(base, Math.floor((hi - lo) / 2 / base) * base);
    if (mid >= hi) break;
    if ((await at(mid)) > goal) lo = mid;
    else hi = mid;
  }
  // The search picks the first candidate that looks safe on its own seeds, which flatters it. Check the
  // winner on a larger, independent set of seeds and step up until it holds with a margin (4% when the
  // target is 5%), so "gets that under 5%" is true of the real thing, not just of the sample.
  const verifySessions = opts.verifySessions ?? 1000;
  const margin = goal;
  let verified = hi;
  let vRate = 1;
  for (let i = 0; i < 12; i++) {
    vRate = await bustRateAt(input, verified, {
      ...opts,
      sessions: verifySessions,
      seed: (opts.seed ?? PLAN_SEED) + 1_000_000,
      stopAbove: margin,
    });
    if (vRate <= margin || verified >= cap) break;
    verified = Math.min(cap, verified + step);
  }
  if (vRate > margin) return { bankroll: null, bustRate: vRate, target, cap: verified, step };
  return { bankroll: verified, bustRate: vRate, target, cap, step };
}

/**
 * A stop-loss to set before playing: roughly what the worst 1 in 10 sessions lose, never less than
 * the expected loss, rounded up to a whole $5 and capped at the bankroll.
 */
export function suggestStopLoss(
  risk: Pick<PlanRisk, 'p10'>,
  expectedLoss: Cents,
  bankroll: Cents,
): Cents {
  const raw = Math.max(-risk.p10, expectedLoss, 0);
  const rounded = Math.ceil(raw / 500) * 500;
  return Math.min(Math.max(rounded, 500), bankroll);
}

/**
 * Share of the plan's seeded sessions that would hit `stopLoss` (down by that much from the starting
 * bankroll) before the session ends. Same seeds as `planRisk`.
 */
export async function planStopLossRate(
  input: PlanInput,
  stopLoss: Cents,
  opts: PlanOptions = {},
): Promise<number> {
  const r = await simulateMany(
    {
      strategy: input.strategy,
      rolls: planRolls(input.hours, input.rollsPerHour),
      seed: opts.seed ?? PLAN_SEED,
      bankroll: input.bankroll,
      stopLoss,
      ...(input.rules !== undefined ? { rules: input.rules } : {}),
    },
    opts.sessions ?? PLAN_SESSIONS,
    {
      ...(opts.signal ? { signal: opts.signal } : {}),
      ...(opts.schedule ? { schedule: opts.schedule } : {}),
      ...(opts.sliceMs !== undefined ? { sliceMs: opts.sliceMs } : {}),
    },
  );
  return r.stopLossRate;
}
