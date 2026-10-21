import { equity } from '../engine/game';
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
export function summarizeRoll(
  pre: GameState,
  post: GameState,
  events: readonly GameEvent[],
): RollLogEntry | null {
  const roll = events.find(
    (e): e is Extract<GameEvent, { type: 'dice-rolled' }> => e.type === 'dice-rolled',
  );
  if (!roll) return null;
  let point: LogPointEvent | null = null;
  const outcomes: LogOutcomeKind[] = [];
  for (const e of events) {
    // the puck events (point set / made / seven-out) win over natural / craps
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
    text: describeRoll(events, pre.bets),
    point,
    outcomes,
    net: r.net,
    bankroll: equity(post),
  };
}

/** The bankroll an auto-roll run started with, read from the result itself (it may differ from the table's). */
function startOf(result: SessionResult | ManyResult): Cents {
  return 'rollsPlayed' in result ? result.finalEquity + result.actualLoss : (result.p50[0] ?? 0);
}

/** "Auto-roll: 100 rolls, net -$12.40." */
export function autoRollText(result: SessionResult | ManyResult): string {
  const start = startOf(result);
  const signed = (n: Cents) => (n === 0 ? '$0' : fmtMoney(n, { sign: true }));
  if ('rollsPlayed' in result) {
    return `Auto-roll: ${result.rollsPlayed} ${result.rollsPlayed === 1 ? 'roll' : 'rolls'}, net ${signed(result.finalEquity - start)}.`;
  }
  const rolls = Math.max(0, result.p50.length - 1);
  const median = (result.p50[rolls] ?? start) - start;
  return `Auto-roll: ${result.sessions} sessions of ${rolls} rolls, median net ${signed(median)}.`;
}

export function autoRollEntry(
  result: SessionResult | ManyResult,
  game: GameState,
  seq: number,
): RollLogEntry {
  const start = startOf(result);
  const net =
    'rollsPlayed' in result
      ? result.finalEquity - start
      : (result.p50[result.p50.length - 1] ?? start) - start;
  return {
    id: `a${seq}`,
    kind: 'auto',
    n: game.rollCount,
    text: autoRollText(result),
    point: null,
    outcomes: [],
    net,
    bankroll: equity(game),
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
      // the point going up or coming down; a natural or craps on the come-out is not a point event
      return e.point === 'point-set' || e.point === 'point-made' || e.point === 'seven-out';
  }
}

/** Appends and trims to the in-memory limit. */
export function appendLog(log: readonly RollLogEntry[], e: RollLogEntry): RollLogEntry[] {
  const next = [...log, e];
  return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next;
}

const POINTS = new Set<unknown>(['natural', 'craps', 'point-set', 'point-made', 'seven-out']);
const KINDS = new Set<unknown>(['win', 'lose', 'push', 'returned', 'travel']);
const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function wellFormed(e: unknown): e is RollLogEntry {
  if (typeof e !== 'object' || e === null) return false;
  const o = e as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.text !== 'string') return false;
  if (o.kind !== 'roll' && o.kind !== 'auto') return false;
  if (!finite(o.n) || !finite(o.net) || !finite(o.bankroll)) return false;
  if (o.point !== null && !POINTS.has(o.point)) return false;
  if (!Array.isArray(o.outcomes) || !o.outcomes.every((k) => KINDS.has(k))) return false;
  if (o.kind === 'roll') {
    const d = o.dice;
    if (
      !Array.isArray(d) ||
      d.length !== 2 ||
      !d.every((x) => Number.isInteger(x) && x >= 1 && x <= 6)
    )
      return false;
  }
  return true;
}

/** A saved log is untrusted: keep only the well-formed entries, and nothing if it is not an array. */
export function sanitizeLog(v: unknown): RollLogEntry[] {
  return Array.isArray(v) ? v.filter(wellFormed).slice(-LOG_PERSIST) : [];
}
