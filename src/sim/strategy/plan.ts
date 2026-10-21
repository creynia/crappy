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
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
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
        if (now() - t0 >= slice && done < sessions) return schedule(step);
      }
      resolve(busts / sessions);
    };
    schedule(step);
  });
}

export interface BankrollSuggestion {
  /** smallest bankroll (a multiple of the step) found with bust probability at or under the target; null when none up to the cap */
  bankroll: Cents | null;
  /** bust probability at that bankroll (same seeds as the plan's own estimate) */
  bustRate: number;
  target: number;
  /** the largest bankroll tried, when none worked */
  cap: Cents;
}

/**
 * Smallest bankroll (to the nearest `step`, default $10) whose bust probability is at or under
 * `targetBust` (default 5%). Doubles the bankroll until it is safe, then bisects. Every estimate
 * uses the same seeds, so the answer is deterministic and the bust rate does not rise as the
 * bankroll grows.
 */
export async function suggestBankroll(
  input: PlanInput,
  opts: PlanOptions & { step?: Cents; capMultiple?: number } = {},
): Promise<BankrollSuggestion> {
  const target = opts.targetBust ?? 0.05;
  const step = opts.step ?? 1000;
  const unit = input.strategy.unit;
  const cap = Math.ceil((unit * (opts.capMultiple ?? 400)) / step) * step;
  const cache = new Map<Cents, number>();
  const at = async (b: Cents): Promise<number> => {
    let v = cache.get(b);
    if (v === undefined) {
      v = await bustRateAt(input, b, opts);
      cache.set(b, v);
    }
    return v;
  };
  // find a safe upper bound by doubling from one unit
  let lo = 0; // known unsafe (or zero)
  let hi = Math.max(step, Math.ceil(unit / step) * step);
  while ((await at(hi)) > target) {
    lo = hi;
    if (hi >= cap) return { bankroll: null, bustRate: cache.get(hi)!, target, cap: hi };
    hi = Math.min(cap, hi * 2);
  }
  while (hi - lo > step) {
    const mid = lo + Math.floor((hi - lo) / 2 / step) * step;
    if (mid <= lo) break;
    if ((await at(mid)) > target) lo = mid;
    else hi = mid;
  }
  return { bankroll: hi, bustRate: cache.get(hi)!, target, cap };
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
