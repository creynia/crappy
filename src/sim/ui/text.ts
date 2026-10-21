import type { ActionPreview, EdgeTier } from '../math/types';
import { BET_TYPES } from '../engine/bets';
import type { Action, Bet, BetTypeId, Cents, GameEvent, GameState } from '../engine/types';
import { betEdge } from '../math';
import { oddsMultiplePerDecision } from '../strategy';
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

export type UiTier = EdgeTier;
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

const FLAT_ODDS: Partial<Record<BetTypeId, { flat: BetTypeId; label: string }>> = {
  'pass-line': { flat: 'pass-odds', label: 'Pass + Odds' },
  'dont-pass': { flat: 'dont-pass-odds', label: "Don't Pass + Lay odds" },
  come: { flat: 'come-odds', label: 'Come + Odds' },
  'dont-come': { flat: 'dont-come-odds', label: "Don't Come + Lay odds" },
};
const ODDS_FLAT: Partial<Record<BetTypeId, BetTypeId>> = {
  'pass-odds': 'pass-line',
  'dont-pass-odds': 'dont-pass',
  'come-odds': 'come',
  'dont-come-odds': 'dont-come',
};

const a2 = (a: Action): string | undefined => (a.type === 'place-bet' ? a.parentId : undefined);

/** Combined flat + odds edge per dollar, when the flat bet has (or is getting) odds. */
function combinedEdge(
  type: BetTypeId,
  amount: Cents,
  state: Pick<GameState, 'rules' | 'phase' | 'point' | 'bets'>,
  action: Action,
): { label: string; edge: number } | null {
  // Flat line/come bets are priced as placed on a come-out roll (1.41%, 1.36%), the figure the lessons quote.
  const ctx = { phase: 'come-out' as const, point: null, rules: state.rules };
  let flatType: BetTypeId;
  let flatAmount: Cents;
  let oddsAmount: Cents;
  let label: string;
  const flatLink = FLAT_ODDS[type];
  const parentType = ODDS_FLAT[type];
  if (flatLink) {
    const own =
      action.type === 'set-amount' ? state.bets.find((b) => b.id === action.betId) : undefined;
    const odds = state.bets.filter(
      (b) =>
        b.type === flatLink.flat &&
        (own ? b.parentId === own.id : type === 'pass-line' || type === 'dont-pass'),
    );
    flatType = type;
    flatAmount = amount;
    oddsAmount = odds.reduce((t, b) => t + b.amount, 0);
    label = flatLink.label;
  } else if (parentType) {
    const parent =
      action.type === 'place-bet' && action.parentId
        ? state.bets.find((b) => b.id === action.parentId)
        : state.bets.find((b) => b.type === parentType);
    if (!parent) return null;
    flatType = parentType;
    flatAmount = parent.amount;
    const existing = state.bets.filter((b) => b.type === type && b.parentId === parent.id);
    oddsAmount =
      existing.reduce((t, b) => t + b.amount, 0) + (action.type === 'place-bet' ? amount : 0);
    label = FLAT_ODDS[parentType]!.label;
  } else return null;
  if (oddsAmount <= 0 || flatAmount <= 0) return null;
  // Per DECISION of the flat bet: the odds wagered depend on which point is made, so use the same fraction
  // of the table maximum at every point (max odds on 3-4-5x gives Pass + odds 0.374%, DP + 6x lay 0.273%).
  const flat = fracToNumber(betEdge(flatType, flatAmount, ctx).perResolved);
  const lay = flatType === 'dont-pass' || flatType === 'dont-come';
  const parentBet =
    flatType === 'pass-line' || flatType === 'dont-pass'
      ? null
      : (state.bets.find((b) => b.type === flatType && (a2(action) ? b.id === a2(action) : true)) ??
        null);
  const point = parentBet?.point ?? state.point ?? 6;
  const maxMult = (lay ? state.rules.maxLayOdds : state.rules.maxOdds)[point];
  const frac = Math.min(1, oddsAmount / (flatAmount * maxMult));
  const oddsPerDecision = flatAmount * frac * oddsMultiplePerDecision(state.rules, lay);
  return { label, edge: (flat * flatAmount) / (flatAmount + oddsPerDecision) };
}

/**
 * Builds the curriculum 6.1 facts for the sheet from a preview. oneRoll, chance, pays and the combined
 * edge are derived here (engine registry + the preview's explanation), so callers pass only the state.
 * Returns null for actions that are not about a bet (roll, set-working without a bet).
 */
function bigGcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}

export function buildEvFacts(
  preview: ActionPreview,
  state: Pick<GameState, 'rules' | 'phase' | 'point' | 'bets'>,
): EvFacts | null {
  const a = preview.action;
  let type: BetTypeId | undefined;
  let amount: Cents | undefined;
  let bet: Bet | undefined;
  if (a.type === 'place-bet') {
    type = a.betType;
    amount = a.amount;
  } else if (a.type === 'set-amount') {
    bet = state.bets.find((b) => b.id === a.betId);
    type = bet?.type;
    amount = a.amount;
  } else if (a.type === 'remove-bet' || a.type === 'set-working') {
    bet = state.bets.find((b) => b.id === a.betId);
    type = bet?.type;
    amount = bet?.amount;
  }
  if (!type || amount === undefined) return null;
  const def = BET_TYPES[type];
  const edge = preview.edge ? fracToNumber(preview.edge.perResolved) : null;
  const rows = preview.explanation.rows;
  // exact sum of the winning rows' probabilities (rows can use different bases), e.g. 244/495
  let wn = 0n;
  let wd = 1n;
  for (const r of rows) {
    if (r.net.n <= 0n) continue;
    wn = wn * r.probability.d + r.probability.n * wd;
    wd *= r.probability.d;
    const g = bigGcd(wn, wd);
    if (g > 1n) {
      wn /= g;
      wd /= g;
    }
  }
  let chance = '';
  if (wn > 0n) {
    const p = fracToNumber({ n: wn, d: wd }) * 100;
    const pct = wd <= 36n ? String(Math.round(p)) : p.toFixed(1).replace(/\.0$/, '');
    chance = `${wn} in ${wd}${def.oneRoll ? ' rolls' : ''} (${pct}%)`;
  }
  let pays: string;
  try {
    pays = def.describePayout(state.rules, bet?.point ?? state.point);
  } catch {
    pays = '';
  }
  return {
    amount,
    edge,
    expectedLossCents: edge === null ? 0 : amount * edge,
    perHourCents: preview.edge ? fracToNumber(preview.perHourCents) : null,
    rollsPerHour: preview.rollsPerHour,
    oneRoll: def.oneRoll,
    chance,
    pays,
    combined:
      a.type === 'place-bet' || a.type === 'set-amount'
        ? combinedEdge(type, amount, state, a)
        : null,
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

/**
 * Copy under the Working toggle. `perRollCents` is the expected cost per roll of turning the
 * bet ON (positive) or OFF (negative); the sign is ignored and the magnitude is shown.
 */
export function workingCopy(on: boolean, perRollCents: number): string {
  const cost = fmtMoney(Math.abs(perRollCents), { exact: true });
  return on
    ? `Working on the come-out. Turning it OFF saves about ${cost} per come-out roll.`
    : `Off on the come-out by table convention. Turning it ON costs about ${cost} per come-out roll and risks the 7, which comes up 6 of 36 ways.`;
}
