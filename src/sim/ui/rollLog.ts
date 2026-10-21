import type { Cents, GameEvent, GameState } from '../engine/types';
import type { ManyResult, SessionResult } from '../strategy/types';
import { describeRoll, fmtMoney } from './text';

export const LOG_LIMIT = 500;
export const LOG_PERSIST = 50;

export type LogPointEvent = 'natural' | 'craps' | 'point-set' | 'point-made' | 'seven-out';
export type LogOutcomeKind = 'win' | 'lose' | 'push' | 'returned' | 'travel';

/** One line of the roll log: a roll, or a summary of an auto-roll run. */
export interface RollLogEntry {
  /** unique within a session */
  id: string;
  kind: 'roll' | 'auto';
  /** roll number (for an auto-roll run: the roll count when it finished) */
  n: number;
  dice?: [number, number];
  total?: number;
  /** the same sentence the status toast shows */
  text: string;
  point: LogPointEvent | null;
  outcomes: LogOutcomeKind[];
  /** net result of the roll, cents */
  net: Cents;
  /** bankroll in the rack after the roll, cents */
  bankroll: Cents;
}

const POINT_EVENTS: Partial<Record<GameEvent['type'], LogPointEvent>> = {
  natural: 'natural',
  craps: 'craps',
  'point-established': 'point-set',
  'point-made': 'point-made',
  'seven-out': 'seven-out',
};
const OUTCOMES: Partial<Record<GameEvent['type'], LogOutcomeKind>> = {
  'bet-won': 'win',
  'bet-lost': 'lose',
  'bet-pushed': 'push',
  'bet-returned': 'returned',
  'bet-travelled': 'travel',
};

/**
 * The per-roll summary behind the log. `text` comes from describeRoll, the function that also feeds
 * the toast and the screen-reader announcement, so there is one wording.
 */
export function summarizeRoll(post: GameState, events: readonly GameEvent[]): RollLogEntry | null {
  const roll = events.find(
    (e): e is Extract<GameEvent, { type: 'dice-rolled' }> => e.type === 'dice-rolled',
  );
  if (!roll) return null;
  let point: LogPointEvent | null = null;
  const outcomes: LogOutcomeKind[] = [];
  for (const e of events) {
    // a come-out roll can report both a natural/craps and nothing else; keep the puck events last
    const p = POINT_EVENTS[e.type];
    if (p && (point === null || p === 'point-set' || p === 'point-made' || p === 'seven-out'))
      point = p;
    const o = OUTCOMES[e.type];
    if (o) outcomes.push(o);
  }
  const r = roll.roll;
  return {
    id: `r${r.n}`,
    kind: 'roll',
    n: r.n,
    dice: [r.dice[0], r.dice[1]],
    total: r.total,
    text: describeRoll(events),
    point,
    outcomes,
    net: r.net,
    bankroll: post.bankroll,
  };
}

/** "Auto-roll: 100 rolls, net -$12.40." */
export function autoRollText(result: SessionResult | ManyResult, bankroll: Cents): string {
  if ('rollsPlayed' in result) {
    const net = result.finalEquity - bankroll;
    return `Auto-roll: ${result.rollsPlayed} ${result.rollsPlayed === 1 ? 'roll' : 'rolls'}, net ${
      net === 0 ? '$0' : fmtMoney(net, { sign: true })
    }.`;
  }
  const rolls = Math.max(0, result.p50.length - 1);
  const median = (result.p50[rolls] ?? bankroll) - bankroll;
  return `Auto-roll: ${result.sessions} sessions of ${rolls} rolls, median net ${
    median === 0 ? '$0' : fmtMoney(median, { sign: true })
  }.`;
}

export function autoRollEntry(
  result: SessionResult | ManyResult,
  bankrollBefore: Cents,
  game: GameState,
  seq: number,
): RollLogEntry {
  const net =
    'rollsPlayed' in result
      ? result.finalEquity - bankrollBefore
      : (result.p50[result.p50.length - 1] ?? bankrollBefore) - bankrollBefore;
  return {
    id: `a${seq}`,
    kind: 'auto',
    n: game.rollCount,
    text: autoRollText(result, bankrollBefore),
    point: null,
    outcomes: [],
    net,
    bankroll: game.bankroll,
  };
}

export type LogFilter = 'all' | 'wins' | 'losses' | 'points';

export function matchesFilter(e: RollLogEntry, f: LogFilter): boolean {
  switch (f) {
    case 'all':
      return true;
    case 'wins':
      return e.kind === 'roll' && (e.outcomes.includes('win') || e.net > 0);
    case 'losses':
      return e.kind === 'roll' && (e.outcomes.includes('lose') || e.net < 0);
    case 'points':
      return e.kind === 'roll' && e.point !== null;
  }
}

/** Appends and trims to the in-memory limit. */
export function appendLog(log: readonly RollLogEntry[], e: RollLogEntry): RollLogEntry[] {
  const next = [...log, e];
  return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next;
}
