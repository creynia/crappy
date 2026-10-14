import type { ActionPreview } from '../math/types';
import type { Bet, BetTypeId, Cents, GameEvent } from '../engine/types';
import type { RegionDef } from './layouts/types';

// ---------- money ----------

/** "$10", "$0.14", "-$0.14", "+$39", "$1,250". ASCII minus. Local so the UI does not depend on the engine's formatter. */
export function fmtMoney(cents: number, opts?: { sign?: boolean; exact?: boolean }): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const body =
    dollars.toLocaleString('en-US') +
    (rem !== 0 || opts?.exact ? '.' + String(rem).padStart(2, '0') : '');
  const sign = neg ? '-' : opts?.sign && abs !== 0 ? '+' : '';
  return `${sign}$${body}`;
}

export function fmtPct(fraction: number, digits = 2): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Structural Fraction -> number (the math module's toNumber may not be available in UI tests). */
export function fracToNumber(f: { n: bigint; d: bigint }): number {
  if (f.d === 0n) return 0;
  const scale = 1_000_000n;
  return Number((f.n * scale) / f.d) / Number(scale);
}

// ---------- labels ----------

const FIXED_LABELS: Partial<Record<BetTypeId, string>> = {
  'pass-line': 'Pass line',
  'dont-pass': "Don't pass",
  come: 'Come',
  'dont-come': "Don't come",
  'pass-odds': 'Pass odds',
  'dont-pass-odds': "Don't pass odds",
  'come-odds': 'Come odds',
  'dont-come-odds': "Don't come odds",
  field: 'Field',
  'big-6': 'Big 6',
  'big-8': 'Big 8',
  'any-7': 'Any seven',
  'any-craps': 'Any craps',
  'yo-11': 'Yo eleven',
  'aces-2': 'Aces',
  'boxcars-12': 'Boxcars',
  'ace-deuce-3': 'Ace-deuce',
  horn: 'Horn',
  'c-e': 'C and E',
  world: 'World',
};

export function betLabel(type: BetTypeId): string {
  const fixed = FIXED_LABELS[type];
  if (fixed) return fixed;
  const m = /^(place|buy|lay|hard)-(\d+)$/.exec(type);
  if (m) return `${m[1]!.charAt(0).toUpperCase()}${m[1]!.slice(1)} ${m[2]}`;
  return type;
}

// ---------- tiers (decisions.md: free | good | fair | poor | avoid) ----------

export type UiTier = 'free' | 'good' | 'fair' | 'poor' | 'avoid';
export const TIER_LABEL: Record<UiTier, string> = {
  free: 'Free bet',
  good: 'Good bet',
  fair: 'Fair',
  poor: 'Costly',
  avoid: 'Sucker bet',
};

/** Accepts the new 5-tier names and, defensively, the legacy 4-tier ones. */
export function normalizeTier(t: string): UiTier {
  switch (t) {
    case 'free':
    case 'good':
    case 'fair':
    case 'poor':
    case 'avoid':
      return t;
    case 'zero':
      return 'free';
    case 'low':
      return 'good';
    case 'medium':
      return 'fair';
    default:
      return 'avoid';
  }
}

// ---------- EV facts (curriculum.md section 6.1) ----------

export interface EvFacts {
  amount: Cents;
  /** edge per bet resolved as a fraction (0.0152), null when unknown */
  edge: number | null;
  /** amount x edge, in cents (>= 0 for house-edge bets) */
  expectedLossCents: number;
  /** cents lost per hour if left up; null when it does not apply */
  perHourCents: number | null;
  rollsPerHour: number;
  oneRoll: boolean;
  /** e.g. "5 in 11 (45%)" or "1 in 6 rolls (17%)" */
  chance: string;
  /** e.g. "7 to 6" */
  pays: string;
  /** Line bet with odds: combined edge per dollar (fraction) and its name, e.g. "Pass + Odds" */
  combined?: { label: string; edge: number } | null;
}

export interface EvFactsInput {
  amount: Cents;
  oneRoll: boolean;
  chance: string;
  pays: string;
  rollsPerHour?: number;
  /** 392/557 for bets that are off on come-outs; default 1 */
  workingFraction?: number;
  combined?: { label: string; edge: number } | null;
}

export function buildEvFacts(preview: Pick<ActionPreview, 'edge'>, input: EvFactsInput): EvFacts {
  const edge = preview.edge ? fracToNumber(preview.edge.perResolved) : null;
  const perRoll = preview.edge ? fracToNumber(preview.edge.perRoll) : null;
  const rph = input.rollsPerHour ?? 100;
  return {
    amount: input.amount,
    edge,
    expectedLossCents: edge === null ? 0 : input.amount * edge,
    perHourCents:
      perRoll === null ? null : input.amount * perRoll * rph * (input.workingFraction ?? 1),
    rollsPerHour: rph,
    oneRoll: input.oneRoll,
    chance: input.chance,
    pays: input.pays,
    combined: input.combined ?? null,
  };
}

// ---------- roll descriptions ----------

const NICKNAME: Record<number, string> = {
  2: 'snake eyes',
  3: 'ace-deuce',
  11: 'yo',
  12: 'boxcars',
};

export function describeRoll(events: readonly GameEvent[]): string {
  const roll = events.find(
    (e): e is Extract<GameEvent, { type: 'dice-rolled' }> => e.type === 'dice-rolled',
  );
  const parts: string[] = [];
  if (roll) {
    const r = roll.roll;
    let head = String(r.total);
    if (r.hard && r.total >= 4 && r.total <= 10 && r.total % 2 === 0) head += ', the hard way';
    else if (NICKNAME[r.total]) head += `, ${NICKNAME[r.total]}`;
    parts.push(head + '.');
  }
  for (const e of events) {
    switch (e.type) {
      case 'natural':
        parts.push('Natural!');
        break;
      case 'craps':
        parts.push('Craps!');
        break;
      case 'point-established':
        parts.push(`Point is ${e.point}.`);
        break;
      case 'point-made':
        parts.push('Point made!');
        break;
      case 'seven-out':
        parts.push('Seven out.');
        break;
    }
  }
  const wins: string[] = [];
  const losses: string[] = [];
  const pushes: string[] = [];
  const returned: string[] = [];
  for (const e of events) {
    if (e.type === 'bet-won')
      wins.push(`${betLabel(e.betType)} wins ${fmtMoney(e.profit - e.vig)}`);
    else if (e.type === 'bet-lost')
      losses.push(`${betLabel(e.betType)} loses ${fmtMoney(e.amount)}`);
    else if (e.type === 'bet-pushed') pushes.push(`${betLabel(e.betType)} pushes`);
    else if (e.type === 'bet-returned') returned.push(`${betLabel(e.betType)} returned`);
  }
  for (const group of [wins, losses, pushes, returned]) {
    if (group.length) parts.push(group.join(', ') + '.');
  }
  if (roll) {
    const net = roll.roll.net;
    parts.push(net === 0 ? 'Net $0.' : `Net ${fmtMoney(net, { sign: true })}.`);
  }
  return parts.join(' ');
}

export type ToastTone = 'win' | 'loss' | 'info';
export function rollTone(events: readonly GameEvent[]): ToastTone {
  const roll = events.find((e) => e.type === 'dice-rolled');
  if (roll && roll.type === 'dice-rolled') {
    if (roll.roll.net > 0) return 'win';
    if (roll.roll.net < 0) return 'loss';
  }
  return 'info';
}

// ---------- region labels ----------

export interface RegionLabelOpts {
  /** bets in this region (any type) */
  bets?: readonly Bet[];
  /** ids of bets that are not working */
  offIds?: ReadonlySet<string>;
  disabled?: boolean;
}

export function regionAriaLabel(region: RegionDef, opts: RegionLabelOpts = {}): string {
  const parts = [region.label + '.'];
  if (region.sublabel) parts.push(region.sublabel.replace(/\.?$/, '') + '.');
  const bets = opts.bets ?? [];
  if (bets.length) {
    const desc = bets.map((b) => {
      const working = opts.offIds?.has(b.id) ? 'off' : 'working';
      return `${betLabel(b.type)} ${fmtMoney(b.amount)}, ${working}`;
    });
    parts.push(`Your bet: ${desc.join('; ')}.`);
  } else {
    parts.push('No bet.');
  }
  if (opts.disabled) parts.push('Not available in this lesson.');
  return parts.join(' ');
}

export function diceAriaLabel(d: readonly [number, number]): string {
  return `Rolled ${d[0]} and ${d[1]}, total ${d[0] + d[1]}`;
}
