/**
 * Challenge mode (I030): a fixed-length scored session. The score measures the quality of the
 * player's DECISIONS, not the dice: it is the wager-weighted house edge of every bet the player put
 * up, plus penalties for red-tier ("Sucker bet") decisions and for point cycles played with a line
 * bet but no odds. The same decisions always give the same score, whatever the dice did.
 */
import { BET_TYPES } from '../engine/bets';
import type { Action, Cents, GameEvent, GameState, PointNumber } from '../engine/types';
import { edgeOfBet } from '../math/ev';
import { toNumber } from '../math/fraction';
import { edgeTier } from '../math/tiers';
import type { SceneConfig } from './types';

/** The simulator events the tally listens to (a structural subset of `SimulatorEvent`). */
export interface ChallengeEvent {
  type: string;
  action?: Action;
  events?: GameEvent[];
  state?: GameState;
}

export interface ChallengeScoring {
  /** added to the score per red-tier bet decision (fraction, 0.005 = half a point) */
  redBetPenalty: number;
  /** added per point cycle with a line bet and no odds taken */
  noOddsPenalty: number;
  /** below this much action the session has no score (cents) */
  minWagered: Cents;
}
export interface ChallengeConfig {
  rolls: number;
  scoring: ChallengeScoring;
}

export const DEFAULT_CHALLENGE_ROLLS = 300;
export const DEFAULT_CHALLENGE_BANKROLL: Cents = 50_000;
export const DEFAULT_SCORING: ChallengeScoring = {
  redBetPenalty: 0.005,
  noOddsPenalty: 0.0025,
  minWagered: 30_000,
};

export function challengeConfig(over: Partial<ChallengeConfig> = {}): ChallengeConfig {
  return {
    rolls: over.rolls ?? DEFAULT_CHALLENGE_ROLLS,
    scoring: { ...DEFAULT_SCORING, ...(over.scoring ?? {}) },
  };
}

/** YYYYMMDD of the local date: the shared "seed of the day". */
export function dailySeed(d: Date = new Date()): number {
  return d.getFullYear() * 10_000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** The challenge as a scene: one step that ends after `rolls` rolls, every bet allowed, EV shown. */
export function challengeScene(opts: {
  seed: number;
  rolls?: number;
  bankroll?: Cents;
  scoring?: Partial<ChallengeScoring>;
}): SceneConfig {
  const cfg = challengeConfig({
    ...(opts.rolls !== undefined ? { rolls: opts.rolls } : {}),
    ...(opts.scoring ? { scoring: { ...DEFAULT_SCORING, ...opts.scoring } } : {}),
  });
  return {
    id: 'challenge',
    version: 1,
    title: 'Challenge',
    rules: 'standard-vegas',
    bankroll: opts.bankroll ?? DEFAULT_CHALLENGE_BANKROLL,
    seed: opts.seed,
    allowedBets: 'all',
    showEV: true,
    ui: { showBankroll: true, showHistory: true },
    challenge: cfg,
    steps: [
      {
        id: 'play',
        text: `Play **${cfg.rolls} rolls** your way. You are scored on the house edge of the bets you choose, never on how the dice land. Sucker bets and points played without odds cost extra.`,
        completeWhen: { rolls: cfg.rolls },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tally: fed with SimulatorEvents while the session runs
// ---------------------------------------------------------------------------

export interface ChallengeTally {
  rolls: number;
  /** cents the player put up through decisions (place-bet and set-amount increases) */
  wagered: Cents;
  /** sum of cents x edge-per-resolved for those decisions */
  weightedEdge: number;
  redBets: number;
  noOddsCycles: number;
  /** point cycle under way: did it start with a line bet, and were odds taken */
  cycle: { line: boolean; odds: boolean } | null;
  /** last known bet amounts by id (to size set-amount increases) */
  known: Record<string, Cents>;
}

export function emptyTally(): ChallengeTally {
  return {
    rolls: 0,
    wagered: 0,
    weightedEdge: 0,
    redBets: 0,
    noOddsCycles: 0,
    cycle: null,
    known: {},
  };
}

const LINE = new Set(['pass-line', 'dont-pass']);
const LINE_ODDS = new Set(['pass-odds', 'dont-pass-odds']);
const hasType = (s: GameState, set: Set<string>) => s.bets.some((b) => set.has(b.type));

/** Edge per resolved of the bet a decision adds, in the state after the action. */
function decisionEdge(state: GameState, action: Action, betId?: string): number {
  const ctx = { phase: state.phase, point: state.point, rules: state.rules };
  const bet = betId ? state.bets.find((b) => b.id === betId) : undefined;
  let type = bet?.type;
  let point: PointNumber | null = bet?.point ?? null;
  if (action.type === 'place-bet') {
    type = action.betType;
    const placed =
      state.bets.find(
        (b) =>
          b.type === action.betType && (action.parentId ? b.parentId === action.parentId : true),
      ) ?? null;
    point = placed?.point ?? null;
  }
  if (!type) return 0;
  // Line bets are judged as a whole decision (come-out edge), odds have none either way.
  const def = BET_TYPES[type];
  const base =
    def.category === 'line' ? { phase: 'come-out' as const, point: null, rules: state.rules } : ctx;
  try {
    return toNumber(
      edgeOfBet({ type, amount: 100, point: def.category === 'odds' ? point : null }, base)
        .perResolved,
    );
  } catch {
    return 0;
  }
}

/** Pure: returns the tally after one simulator event. */
export function observeChallenge(t: ChallengeTally, e: ChallengeEvent): ChallengeTally {
  const state = e.state;
  if (!state) return t;
  if (e.type === 'action-confirmed' && e.action) {
    const a = e.action;
    let next = t;
    if (a.type === 'place-bet' || a.type === 'set-amount') {
      const added =
        a.type === 'place-bet' ? a.amount : Math.max(0, a.amount - (t.known[a.betId] ?? 0));
      if (added > 0) {
        const edge = decisionEdge(state, a, a.type === 'set-amount' ? a.betId : undefined);
        next = {
          ...next,
          wagered: next.wagered + added,
          weightedEdge: next.weightedEdge + added * edge,
          redBets: next.redBets + (edgeTier(fracOf(edge)) === 'avoid' ? 1 : 0),
        };
      }
    }
    if (next.cycle && !next.cycle.odds && hasType(state, LINE_ODDS))
      next = { ...next, cycle: { ...next.cycle, odds: true } };
    return { ...next, known: amountsOf(state) };
  }
  if (e.type === 'rolled') {
    let next: ChallengeTally = { ...t, rolls: t.rolls + 1 };
    for (const ev of e.events ?? []) {
      if (ev.type === 'point-established') {
        next = { ...next, cycle: { line: hasType(state, LINE), odds: false } };
      } else if (ev.type === 'point-made' || ev.type === 'seven-out') {
        if (next.cycle && next.cycle.line && !next.cycle.odds)
          next = { ...next, noOddsCycles: next.noOddsCycles + 1 };
        next = { ...next, cycle: null };
      }
    }
    return { ...next, known: amountsOf(state) };
  }
  if (e.type === 'ready') return { ...t, known: amountsOf(state) };
  return t;
}

function amountsOf(s: GameState): Record<string, Cents> {
  const out: Record<string, Cents> = {};
  for (const b of s.bets) out[b.id] = b.amount;
  return out;
}

/** A float edge as a Fraction for the tier function (6 decimals is plenty for tier boundaries). */
function fracOf(edge: number): { n: bigint; d: bigint } {
  return { n: BigInt(Math.round(edge * 1_000_000)), d: 1_000_000n };
}

// ---------------------------------------------------------------------------
// Score and rank bands
// ---------------------------------------------------------------------------

export type ChallengeBand = 'perfect' | 'sharp' | 'solid' | 'leaky' | 'sucker' | 'no-action';

export interface RankBand {
  id: Exclude<ChallengeBand, 'no-action'>;
  /** inclusive upper bound of the score, as a fraction */
  max: number;
  label: string;
  blurb: string;
}
/** Rank bands by score (edge per dollar plus penalties). */
export const RANK_BANDS: readonly RankBand[] = [
  {
    id: 'perfect',
    max: 0.004,
    label: 'Perfect strategy',
    blurb: 'Line bets with full odds and nothing else. The house barely got a look in.',
  },
  {
    id: 'sharp',
    max: 0.01,
    label: 'Sharp',
    blurb: 'Mostly line bets and odds, with a few place bets on the 6 and 8.',
  },
  {
    id: 'solid',
    max: 0.02,
    label: 'Solid',
    blurb: 'Low-edge bets, but some odds left on the table or a few pricier numbers.',
  },
  {
    id: 'leaky',
    max: 0.05,
    label: 'Leaky',
    blurb: 'Place bets on the outside numbers or the Field crept in. They add up.',
  },
  {
    id: 'sucker',
    max: Infinity,
    label: "Sucker's table",
    blurb: 'Hardways, props or Big 6/8 carried the session. The center of the table won.',
  },
];

export interface ChallengeResult {
  rolls: number;
  wagered: Cents;
  /** wager-weighted house edge of the decisions (fraction) */
  edgePerDollar: number;
  redBets: number;
  noOddsCycles: number;
  /** edgePerDollar + penalties; null when there was not enough action to judge */
  score: number | null;
  band: ChallengeBand;
  label: string;
  blurb: string;
  /** cents: the session's actual money result and what the house expected to take */
  actualNet: Cents;
  expectedLoss: number;
}

export function bandFor(score: number): RankBand {
  return RANK_BANDS.find((b) => score <= b.max) ?? RANK_BANDS[RANK_BANDS.length - 1]!;
}

/** Scores a finished session. Independent of the dice: only the tally's decisions matter. */
export function scoreChallenge(
  t: ChallengeTally,
  cfg: ChallengeConfig,
  money: { actualNet: Cents; expectedLoss: number },
): ChallengeResult {
  const edgePerDollar = t.wagered > 0 ? t.weightedEdge / t.wagered : 0;
  const base = {
    rolls: t.rolls,
    wagered: t.wagered,
    edgePerDollar,
    redBets: t.redBets,
    noOddsCycles: t.noOddsCycles,
    actualNet: money.actualNet,
    expectedLoss: money.expectedLoss,
  };
  if (t.wagered < cfg.scoring.minWagered) {
    return {
      ...base,
      score: null,
      band: 'no-action',
      label: 'Not enough action',
      blurb: `Put at least ${Math.round(cfg.scoring.minWagered / 100).toLocaleString('en-US')} dollars of bets through the table to earn a score.`,
    };
  }
  const score =
    edgePerDollar +
    t.redBets * cfg.scoring.redBetPenalty +
    t.noOddsCycles * cfg.scoring.noOddsPenalty;
  const band = bandFor(score);
  return { ...base, score, band: band.id, label: band.label, blurb: band.blurb };
}

export function formatScore(score: number | null): string {
  return score === null ? '--' : `${(score * 100).toFixed(2)}%`;
}
