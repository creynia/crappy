/**
 * Challenge mode (I030): a fixed-length scored session. The score is the house edge on action,
 * measured at resolution: every bet the dice decide (won, lost or pushed) counts by its amount and
 * its exact edge at that amount under the table's rules. Odds count only when they resolve and
 * carry no edge, so taking them down earns nothing; a bet that stays up is counted again each time
 * it is decided. Winning or losing never moves the score.
 */
import { BET_TYPES } from '../engine/bets';
import type {
  Action,
  BetTypeId,
  Cents,
  GameEvent,
  GameState,
  PointNumber,
  TableRules,
} from '../engine/types';
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
  /** below this much resolved action the session has no score (cents) */
  minResolved: Cents;
}
export interface ChallengeConfig {
  rolls: number;
  scoring: ChallengeScoring;
}

export const DEFAULT_CHALLENGE_ROLLS = 300;
export const DEFAULT_CHALLENGE_BANKROLL: Cents = 50_000;
export const DEFAULT_SCORING: ChallengeScoring = { minResolved: 30_000 };

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
    ui: { showBankroll: true, showHistory: true, showRestart: false, stepPanelLabel: 'Challenge' },
    challenge: cfg,
    steps: [
      {
        id: 'play',
        text: `Play **${cfg.rolls} rolls** your way. Your score is the house edge on your action: every bet that gets decided counts by its amount and its exact edge, and winning or losing it makes no difference. Odds count for nothing, in the best possible way.`,
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
  /** cents of bets decided (won, lost or pushed), each counted at every resolution */
  resolved: Cents;
  /** sum of cents x exact edge-per-resolved for those resolutions */
  weightedEdge: number;
  /** resolutions so far */
  decisions: number;
  /** observations (not scored): red-tier bets decided, point cycles with a line bet and no odds */
  redDecisions: number;
  noOddsCycles: number;
  /** point cycle under way: did it start with a line bet, and were odds taken */
  cycle: { line: boolean; odds: boolean } | null;
}

export function emptyTally(): ChallengeTally {
  return {
    rolls: 0,
    resolved: 0,
    weightedEdge: 0,
    decisions: 0,
    redDecisions: 0,
    noOddsCycles: 0,
    cycle: null,
  };
}

const LINE = new Set(['pass-line', 'dont-pass']);
const LINE_ODDS = new Set(['pass-odds', 'dont-pass-odds']);
const hasType = (s: GameState, set: Set<string>) => s.bets.some((b) => set.has(b.type));

/**
 * Exact house edge per resolved bet of `amount` on `type` under `rules`. Line and come bets are
 * one decision from their come-out (1.41% / 1.36%), odds have none, everything else is priced in
 * the point phase (place, buy, lay, hardways and props do not depend on the point).
 */
export function resolvedEdge(type: BetTypeId, amount: Cents, rules: TableRules): number {
  const cat = BET_TYPES[type].category;
  if (cat === 'odds') return 0;
  const ctx =
    cat === 'line' || cat === 'come' || cat === 'bonus'
      ? { phase: 'come-out' as const, point: null, rules }
      : { phase: 'point' as const, point: 6 as PointNumber, rules };
  try {
    return toNumber(edgeOfBet({ type, amount, point: null }, ctx).perResolved);
  } catch {
    return 0;
  }
}

/** Pure: returns the tally after one simulator event. */
export function observeChallenge(t: ChallengeTally, e: ChallengeEvent): ChallengeTally {
  const state = e.state;
  if (!state) return t;
  if (e.type === 'action-confirmed') {
    if (t.cycle && !t.cycle.odds && hasType(state, LINE_ODDS))
      return { ...t, cycle: { ...t.cycle, odds: true } };
    return t;
  }
  if (e.type === 'rolled') {
    let next: ChallengeTally = { ...t, rolls: t.rolls + 1 };
    for (const ev of e.events ?? []) {
      if (ev.type === 'bet-won' || ev.type === 'bet-lost' || ev.type === 'bet-pushed') {
        const edge = resolvedEdge(ev.betType, ev.amount, state.rules);
        next = {
          ...next,
          resolved: next.resolved + ev.amount,
          weightedEdge: next.weightedEdge + ev.amount * edge,
          decisions: next.decisions + 1,
          redDecisions: next.redDecisions + (edgeTier(fracOf(edge)) === 'avoid' ? 1 : 0),
        };
      } else if (ev.type === 'point-established') {
        next = { ...next, cycle: { line: hasType(state, LINE), odds: false } };
      } else if (ev.type === 'point-made' || ev.type === 'seven-out') {
        if (next.cycle && next.cycle.line && !next.cycle.odds)
          next = { ...next, noOddsCycles: next.noOddsCycles + 1 };
        next = { ...next, cycle: null };
      }
    }
    return next;
  }
  return t;
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
    blurb:
      'Place bets on the outside numbers, buys without the vig break, or no odds at all. They add up.',
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
  /** cents of bets decided during the session */
  resolved: Cents;
  decisions: number;
  /** house edge on action: weighted edge of every decided bet (fraction); the score */
  edgeOnAction: number;
  /** observations, not part of the score */
  redDecisions: number;
  noOddsCycles: number;
  /** the score, or null when there was not enough action to judge */
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

/** The label of a band id (older saved scores store the id). */
export function bandLabel(id: string): string {
  return (
    RANK_BANDS.find((b) => b.id === id)?.label ?? (id === 'no-action' ? 'Not enough action' : id)
  );
}

/**
 * Scores a finished session: the house edge on the action the dice actually decided. The mix of
 * bets that got decided depends on the session, so the same play can score slightly differently
 * from seed to seed; what never matters is whether those bets won or lost.
 */
export function scoreChallenge(
  t: ChallengeTally,
  cfg: ChallengeConfig,
  money: { actualNet: Cents; expectedLoss: number },
): ChallengeResult {
  const edgeOnAction = t.resolved > 0 ? t.weightedEdge / t.resolved : 0;
  const base = {
    rolls: t.rolls,
    resolved: t.resolved,
    decisions: t.decisions,
    edgeOnAction,
    redDecisions: t.redDecisions,
    noOddsCycles: t.noOddsCycles,
    actualNet: money.actualNet,
    expectedLoss: money.expectedLoss,
  };
  if (t.resolved < cfg.scoring.minResolved) {
    return {
      ...base,
      score: null,
      band: 'no-action',
      label: 'Not enough action',
      blurb: `Have at least ${Math.round(cfg.scoring.minResolved / 100).toLocaleString('en-US')} dollars of bets decided by the dice to earn a score.`,
    };
  }
  const band = bandFor(edgeOnAction);
  return { ...base, score: edgeOnAction, band: band.id, label: band.label, blurb: band.blurb };
}

export function formatScore(score: number | null): string {
  return score === null ? '--' : `${(score * 100).toFixed(2)}%`;
}
