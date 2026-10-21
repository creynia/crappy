import { applyAction, createGame, equity, isBonusType, resolveRules } from '../engine';
import type { GameState } from '../engine';
import { makeVarianceFn, tableExpectedLossPerRoll, toNumber } from '../math';
import { lineOddsEdge, strategyMetrics } from './metrics';
import { getImpl } from './presets';
import type {
  ManyOptions,
  ManyResult,
  SessionConfig,
  SessionResult,
  SweepConfig,
  SweepRow,
} from './types';

/** Expected loss only depends on phase, point and the bets, so repeated layouts hit a per-session cache. */
function makeExpectedLossFn(): (s: GameState) => number {
  const cache = new Map<string, number>();
  return (s) => {
    let key = s.phase === 'point' ? `p${s.point}` : 'c';
    for (const b of s.bets) key += `|${b.type}:${b.amount}:${b.point ?? ''}:${b.working}`;
    let v = cache.get(key);
    if (v === undefined) {
      v = toNumber(tableExpectedLossPerRoll(s));
      cache.set(key, v);
    }
    return v;
  };
}

/** Run one session. Pure and deterministic per `cfg.seed`. */
export function simulateSession(cfg: SessionConfig): SessionResult {
  const impl = getImpl(cfg.strategy.id);
  const stopAtBust = cfg.stopAtBust ?? true;
  const start = cfg.bankroll;
  const expectedLossFn = makeExpectedLossFn();
  const varianceFn = makeVarianceFn();
  let state = createGame({ rules: cfg.rules, bankroll: cfg.bankroll, seed: cfg.seed });
  const eq = new Int32Array(cfg.rolls + 1);
  const exp = new Float64Array(cfg.rolls + 1);
  const totals = new Int32Array(13);
  eq[0] = start;
  exp[0] = start;
  let peak = start;
  let maxDd = 0;
  let played = 0;
  let busted: number | null = null;
  let endedBy: SessionResult['endedBy'] = 'rolls';
  let pointsMade = 0;
  let sevenOuts = 0;
  let longest = 0;
  let hand = 0;
  const bonusHits = new Map<string, NonNullable<SessionResult['bonusHits']>[number]>();

  for (let i = 1; i <= cfg.rolls; i++) {
    const plan = impl.plan(state, cfg.strategy);
    for (const a of plan.actions) {
      const r = applyAction(state, a);
      if (r.ok) state = r.state;
      else {
        // A strategy must only emit legal actions; treat an unexpected rejection as unaffordable.
        if (stopAtBust) plan.blocked = true;
        break;
      }
    }
    if (stopAtBust && plan.blocked && state.bets.length === 0) {
      busted = played;
      endedBy = 'bust';
      break;
    }
    const r = applyAction(state, { type: 'roll' }, { expectedLossFn, varianceFn });
    if (!r.ok) throw new Error(`roll rejected: ${r.error.message}`);
    state = r.state;
    played = i;
    const rec = state.history[state.history.length - 1];
    if (rec) totals[rec.total]!++;
    hand++;
    for (const e of r.events) {
      if (e.type === 'bet-won' && isBonusType(e.betType)) {
        const pays = Math.round(e.profit / e.amount);
        const k = `${e.betType}:${pays}`;
        const cur = bonusHits.get(k);
        if (cur) cur.count++;
        else bonusHits.set(k, { type: e.betType, pays, count: 1 });
      }
      if (e.type === 'point-made') pointsMade++;
      else if (e.type === 'seven-out') {
        sevenOuts++;
        if (hand > longest) longest = hand;
        hand = 0;
      }
    }
    const e = equity(state);
    eq[i] = e;
    exp[i] = start - state.stats.expectedLoss;
    if (e > peak) peak = e;
    else if (peak - e > maxDd) maxDd = peak - e;
    if (cfg.stopWin !== undefined && e - start >= cfg.stopWin) {
      endedBy = 'stop-win';
      break;
    }
    if (cfg.stopLoss !== undefined && start - e >= cfg.stopLoss) {
      endedBy = 'stop-loss';
      break;
    }
  }
  if (hand > longest) longest = hand;
  const finalEquity = equity(state);
  return {
    rollsPlayed: played,
    equity: played === cfg.rolls ? eq : eq.slice(0, played + 1),
    expected: played === cfg.rolls ? exp : exp.slice(0, played + 1),
    finalEquity,
    totalWagered: state.stats.totalWagered,
    expectedLoss: state.stats.expectedLoss,
    variance: state.stats.variance,
    actualLoss: start - finalEquity,
    totals,
    endedBy,
    maxDrawdown: maxDd,
    peakEquity: peak,
    bustedAtRoll: busted,
    pointsMade,
    sevenOuts,
    longestHand: longest,
    ...(bonusHits.size ? { bonusHits: [...bonusHits.values()] } : {}),
  };
}

/**
 * Compare strategies on identical dice: every session uses the same seed, so the RNG
 * produces the same dice sequence for each strategy (dice are drawn only by `roll`).
 */
export function simulateCompare(
  cfg: Omit<SessionConfig, 'strategy'>,
  strategies: SessionConfig['strategy'][],
): SessionResult[] {
  return strategies.map((strategy) => simulateSession({ ...cfg, strategy }));
}

function abortError(): Error {
  const e = new Error('Aborted');
  e.name = 'AbortError';
  return e;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function percentile(sorted: Float64Array, p: number): number {
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** Many sessions (seeds seed+i), chunked so the UI stays responsive. Progress 0..1. */
export function simulateMany(
  cfg: SessionConfig,
  sessions: number,
  opts: ManyOptions = {},
): Promise<ManyResult> {
  const schedule = (fn: () => void): void => {
    if (opts.schedule) opts.schedule(fn);
    else setTimeout(fn, 0);
  };
  const slice = opts.sliceMs ?? 16;
  const len = cfg.rolls + 1;
  return new Promise<ManyResult>((resolve, reject) => {
    const eqs: Int32Array[] = [];
    const expSum = new Float64Array(len);
    const alive = new Float64Array(len);
    const finals = new Int32Array(sessions);
    let busts = 0;
    let ahead = 0;
    let stopWins = 0;
    let stopLosses = 0;
    let sumRolls = 0;
    let sumExpLoss = 0;
    let sumFinal = 0;
    let done = 0;
    // phase 2 state
    const p10 = new Float64Array(len);
    const p50 = new Float64Array(len);
    const p90 = new Float64Array(len);
    const col = new Float64Array(sessions);
    let c = 0;
    let phase: 1 | 2 = 1;

    const step = (): void => {
      if (opts.signal?.aborted) return reject(abortError());
      const t0 = now();
      if (phase === 1) {
        while (done < sessions) {
          const r = simulateSession({ ...cfg, seed: cfg.seed + done });
          const eq = new Int32Array(len);
          eq.set(r.equity);
          const last = r.equity[r.rollsPlayed]!;
          eq.fill(last, r.rollsPlayed + 1);
          eqs.push(eq);
          const bustAt = r.bustedAtRoll;
          for (let j = 0; j < len; j++) {
            expSum[j]! += j <= r.rollsPlayed ? r.expected[j]! : r.expected[r.rollsPlayed]!;
            if (bustAt === null || j < bustAt) alive[j]!++;
          }
          if (bustAt !== null) busts++;
          if (r.finalEquity > cfg.bankroll) ahead++;
          if (r.endedBy === 'stop-win') stopWins++;
          if (r.endedBy === 'stop-loss') stopLosses++;
          sumRolls += r.rollsPlayed;
          sumExpLoss += r.expectedLoss;
          finals[done] = r.finalEquity;
          sumFinal += r.finalEquity;
          done++;
          opts.onProgress?.((done / sessions) * 0.8);
          if (now() - t0 >= slice && done < sessions) return schedule(step);
        }
        phase = 2;
        return schedule(step);
      }
      while (c < len) {
        for (let k = 0; k < sessions; k++) col[k] = eqs[k]![c]!;
        col.sort();
        p10[c] = percentile(col, 0.1);
        p50[c] = percentile(col, 0.5);
        p90[c] = percentile(col, 0.9);
        c++;
        if (now() - t0 >= slice && c < len) {
          opts.onProgress?.(0.8 + (c / len) * 0.2);
          return schedule(step);
        }
      }
      for (let j = 0; j < len; j++) {
        expSum[j]! /= sessions;
        alive[j]! /= sessions;
      }
      opts.onProgress?.(1);
      resolve({
        sessions,
        p10,
        p50,
        p90,
        expected: expSum,
        bustRate: busts / sessions,
        survival: alive,
        finals,
        meanFinal: sumFinal / sessions,
        probAhead: ahead / sessions,
        stopWinRate: stopWins / sessions,
        stopLossRate: stopLosses / sessions,
        meanRollsPlayed: sumRolls / sessions,
        meanExpectedLoss: sumExpLoss / sessions,
      });
    };
    if (sessions < 1) return reject(new Error('sessions must be >= 1'));
    schedule(step);
  });
}

/** Several strategies, same seeds (identical dice per session index), one ManyResult each. */
export async function simulateManyCompare(
  cfg: Omit<SessionConfig, 'strategy'>,
  strategies: SessionConfig['strategy'][],
  sessions: number,
  opts: ManyOptions = {},
): Promise<ManyResult[]> {
  const out: ManyResult[] = [];
  for (let i = 0; i < strategies.length; i++) {
    out.push(
      await simulateMany({ ...cfg, strategy: strategies[i]! }, sessions, {
        ...opts,
        onProgress: (p) => opts.onProgress?.((i + p) / strategies.length),
      }),
    );
  }
  return out;
}

/**
 * Sweep the odds multiple of one line strategy over the same seeds. Numeric multiples above the table's
 * maximum run on a table that offers them (like the 10x / 100x presets).
 */
export async function simulateSweep(
  cfg: SweepConfig,
  sessions: number,
  opts: ManyOptions = {},
): Promise<SweepRow[]> {
  const base = resolveRules(cfg.rules);
  const rows: SweepRow[] = [];
  const n = cfg.oddsMultiples.length;
  for (let i = 0; i < n; i++) {
    const m = cfg.oddsMultiples[i]!;
    let rules = base;
    if (
      m !== 'max' &&
      [...Object.values(base.maxOdds), ...Object.values(base.maxLayOdds)].some((cap) => cap < m)
    ) {
      const uniform = { 4: m, 5: m, 6: m, 8: m, 9: m, 10: m };
      rules = resolveRules({ ...base, maxOdds: uniform, maxLayOdds: uniform });
    }
    const spec =
      m === 'max'
        ? { id: cfg.strategy, unit: cfg.unit }
        : { id: cfg.strategy, unit: cfg.unit, oddsMultiple: m };
    const flat = strategyMetrics({ id: cfg.strategy, unit: cfg.unit, oddsMultiple: 0 }, rules);
    const lay = cfg.strategy === 'dont-pass-max-lay';
    const r = await simulateMany(
      { strategy: spec, rolls: cfg.rolls, seed: cfg.seed, bankroll: cfg.bankroll, rules },
      sessions,
      { ...opts, onProgress: (p) => opts.onProgress?.((i + p) / n) },
    );
    let ss = 0;
    for (let k = 0; k < r.finals.length; k++) ss += (r.finals[k]! - r.meanFinal) ** 2;
    rows.push({
      multiple: m,
      edgeOnAction: lineOddsEdge(flat.edgeOnAction, rules, m, lay),
      // odds carry no edge, so the dollars expected lost depend only on the flat bet
      expectedLossCents: flat.expectedLossPerRoll * 100 * cfg.rolls,
      sdFinal: Math.sqrt(ss / Math.max(1, r.finals.length - 1)),
      probAhead: r.probAhead,
      bustRate: r.bustRate,
      meanFinal: r.meanFinal,
    });
  }
  return rows;
}
