// Engine/math barrels (not '../sim') so the static-page build can import this without the UI.
import { BET_TYPE_IDS, DEFAULT_RULES, getBetType } from '../sim/engine';
import type { BetTypeId, PointNumber } from '../sim/engine';
import { betEdge } from '../sim/math';
import type { BetCopy, Tier } from '../content/types';

export const ALL_BETS: readonly BetTypeId[] = BET_TYPE_IDS;

export function tierOf(edge: number): Tier {
  if (edge <= 0) return 'free';
  if (edge <= 0.02) return 'good';
  if (edge <= 0.05) return 'fair';
  if (edge < 0.09) return 'poor';
  return 'avoid';
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function prettyBetName(id: string): string {
  return id
    .split('-')
    .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function betLabel(id: BetTypeId, copy?: BetCopy): string {
  return safe(() => getBetType(id).label) ?? copy?.name ?? prettyBetName(id);
}

/** Table-sized payout: "7 to 6, 5% vig" -> "7 to 6 + 5% vig"; multi-part payouts say "varies". */
export function shortPayout(id: string, full: string | null): string | null {
  if (!full) return null;
  if (id === 'field' || id === 'horn' || id === 'c-e' || id === 'world' || id === 'hop')
    return 'varies (see details)';
  const first = (full.split(/[,(]/)[0] ?? full).trim();
  const vig = /(\d+)% vig/.exec(full);
  return vig ? `${first} + ${vig[1]}% vig` : first;
}

export function betPayout(id: BetTypeId): string | null {
  const point: PointNumber | null = /odds/.test(id) ? 6 : null;
  return safe(() => getBetType(id).describePayout(DEFAULT_RULES, point));
}

/** A representative amount (cents) where vig rounding does not distort the edge. */
export function sampleAmount(id: BetTypeId): number {
  if (id.startsWith('buy-')) return 2000;
  if (/^lay-(4|10)$/.test(id)) return 4000;
  if (/^lay-(5|9)$/.test(id)) return 3000;
  if (/^lay-(6|8)$/.test(id)) return 2400;
  return 6000;
}

/** House edge per bet resolved, as a plain fraction (0.0141 = 1.41%), or null while math is a stub. Hop: the easy hop. */
export function houseEdge(id: BetTypeId): number | null {
  const odds = /odds/.test(id);
  const ctx = odds
    ? { phase: 'point' as const, point: 6 as PointNumber, rules: DEFAULT_RULES }
    : { phase: 'come-out' as const, point: null, rules: DEFAULT_RULES };
  return safe(() => {
    // A hop is priced on an easy hop (2-4, 11.11%); the copy also gives the hard hop (13.89%).
    const f = betEdge(id, sampleAmount(id), ctx, id === 'hop' ? [2, 4] : undefined).perResolved;
    const v = Number(f.n) / Number(f.d);
    return Number.isFinite(v) ? v : null;
  });
}

/** The House edge fact on a bet's page; a hop gives both kinds (easy 11.11%, hard 13.89%). */
export function edgeFact(id: BetTypeId): string {
  if (id !== 'hop') return formatEdge(houseEdge(id));
  const hard = safe(() => {
    const f = betEdge(
      'hop',
      sampleAmount('hop'),
      { phase: 'come-out', point: null, rules: DEFAULT_RULES },
      [3, 3],
    ).perResolved;
    return Number(f.n) / Number(f.d);
  });
  return `easy ${formatEdge(houseEdge(id))}, hard ${formatEdge(hard)}`;
}

export function formatEdge(e: number | null): string {
  if (e === null) return '--';
  if (e === 0) return '0%';
  return `${(e * 100).toFixed(2)}%`;
}

export interface BetRow {
  id: BetTypeId;
  label: string;
  payout: string | null;
  edge: number | null;
  tier: Tier;
}

export function betRows(bets: Record<string, BetCopy | undefined>): BetRow[] {
  return ALL_BETS.map((id) => {
    const edge = houseEdge(id);
    return {
      id,
      label: betLabel(id, bets[id]),
      payout: betPayout(id),
      edge,
      tier: edge !== null ? tierOf(edge) : (bets[id]?.verdict ?? 'fair'),
    };
  });
}
