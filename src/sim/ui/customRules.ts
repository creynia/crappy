import { DEFAULT_RULES, RULE_PRESETS, pointsFor, resolveRules } from '../engine/rules';
import type { Cents, PointNumber, PointTable, RulePresetId, TableRules } from '../engine/types';
import { betEdge, betEV } from '../math/ev';
import { add, div, frac, mul, neg, toNumber, type Fraction } from '../math/fraction';

/**
 * Custom table rules (I033): the choices the rules editor offers, mapped onto TableRules fields
 * the engine already supports, plus the live house-edge summary.
 */

export type OddsChoice = '3-4-5x' | '2x' | '5x' | '10x' | '20x' | '100x';
export const ODDS_CHOICES: readonly OddsChoice[] = ['3-4-5x', '2x', '5x', '10x', '20x', '100x'];

/**
 * Max odds per point for a choice, and the matching lay limit. A flat Nx table lets the don't side
 * lay enough to win N times the flat bet: 2N on 4/10, 1.5N on 5/9, 1.2N on 6/8 (as the 10x and
 * 100x presets do), and on crapless 3N on 3/11 and 6N on 2/12. 3-4-5x tables allow 6x lay odds on
 * every point (the standard Vegas default). Tables list all ten points, like the presets.
 */
export function oddsLimits(choice: OddsChoice): Pick<TableRules, 'maxOdds' | 'maxLayOdds'> {
  // every point, so the same limits serve a crapless table (a standard one never reads 2/3/11/12)
  const points = pointsFor({ variant: 'crapless' });
  const maxOdds = {} as PointTable;
  const maxLayOdds = {} as PointTable;
  if (choice === '3-4-5x') {
    for (const p of points) {
      maxOdds[p] = DEFAULT_RULES.maxOdds[p];
      maxLayOdds[p] = DEFAULT_RULES.maxLayOdds[p];
    }
    return { maxOdds, maxLayOdds };
  }
  const n = Number(choice.slice(0, -1));
  // lay odds to win n times the flat: the lay pays 1:6 on 2/12, 1:3 on 3/11, 1:2 on 4/10, 2:3, 5:6
  const layWin: Record<PointNumber, number> = {
    2: 6,
    3: 3,
    4: 2,
    5: 1.5,
    6: 1.2,
    8: 1.2,
    9: 1.5,
    10: 2,
    11: 3,
    12: 6,
  };
  for (const p of points) {
    maxOdds[p] = n;
    maxLayOdds[p] = layWin[p] * n;
  }
  return { maxOdds, maxLayOdds };
}

/** The choice matching a rules object's odds limits, or null if they match none (e.g. from a scene). */
export function oddsChoiceOf(r: TableRules): OddsChoice | null {
  for (const c of ODDS_CHOICES) {
    const l = oddsLimits(c);
    // only the points these rules can have (a standard table never uses the crapless entries)
    if (
      pointsFor(r).every(
        (p) => r.maxOdds[p] === l.maxOdds[p] && r.maxLayOdds[p] === l.maxLayOdds[p],
      )
    )
      return c;
  }
  return null;
}

export const TABLE_MIN_CHOICES: readonly Cents[] = [500, 1000, 1500, 2500];
export const TABLE_MAX_CHOICES: readonly Cents[] = [50_000, 100_000, 500_000];
export const PAYOUT_UNIT_CHOICES: readonly { value: Cents; label: string }[] = [
  { value: 1, label: 'Exact cents' },
  { value: 50, label: 'Round down to 50¢' },
  { value: 100, label: 'Round down to $1' },
];

/** Starting point of the editor: the current rules (preset id or object) resolved in full. */
export function rulesDraft(current: Partial<TableRules> | RulePresetId | undefined): TableRules {
  return resolveRules(current);
}

/** True when `r` equals one preset exactly; the editor then reports it as that preset. */
export function matchingPreset(r: TableRules): RulePresetId | null {
  for (const id of Object.keys(RULE_PRESETS) as RulePresetId[]) {
    const p = resolveRules(id);
    if (JSON.stringify({ ...p, presetId: '' }) === JSON.stringify({ ...r, presetId: '' }))
      return id;
  }
  return null;
}

const comeOut = (rules: TableRules) => ({ phase: 'come-out' as const, point: null, rules });
const ratio = (f: Fraction) => toNumber(f);

/** Probability (out of 36) that the come-out sets each point. */
const POINT_WAYS: Record<PointNumber, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  8: 5,
  9: 4,
  10: 3,
  11: 2,
  12: 1,
};

/**
 * House edge of a Pass Line bet (default $10) backed with full odds on every point, per dollar
 * wagered (flat plus the expected odds). Exact for the given rules, payout rounding included; on a
 * crapless table every non-7 come-out total is a point.
 */
export function passMaxOddsEdge(rules: TableRules, flat: Cents = 1000): Fraction {
  let ev: Fraction = betEV({ type: 'pass-line', amount: flat, point: null }, comeOut(rules));
  let wagered: Fraction = frac(flat);
  for (const p of pointsFor(rules)) {
    const odds = Math.floor(flat * rules.maxOdds[p]);
    const pr = frac(POINT_WAYS[p], 36);
    const oddsEv = betEV(
      { type: 'pass-odds', amount: odds, point: p },
      { phase: 'point', point: p, rules },
    );
    ev = add(ev, mul(pr, oddsEv));
    wagered = add(wagered, mul(pr, frac(odds)));
  }
  return div(neg(ev), wagered);
}

export interface RulesSummaryItem {
  label: string;
  edge: number;
}

const dollars = (c: Cents) => `$${c / 100}`;

/**
 * The live summary under the editor: what these rules do to the bets they change, each at a
 * typical size raised to the table minimum (so every line is a legal bet). Buy 4 at $25 shows the
 * vig rounding (decisions.md: 1.33% on a win, 3.85% up front); Place 6 at $5 shows payout rounding
 * (1.55% exact, 4.55% to 50¢, 9.09% to $1).
 */
export function rulesSummary(rules: TableRules): RulesSummaryItem[] {
  const at = (x: Cents) => Math.max(x, rules.tableMin);
  const e = (t: Parameters<typeof betEdge>[0], amount: Cents) =>
    ratio(betEdge(t, amount, comeOut(rules)).perResolved);
  const pass = at(1000);
  const items: RulesSummaryItem[] = [
    { label: `Pass ${dollars(pass)} + max odds`, edge: ratio(passMaxOddsEdge(rules, pass)) },
    { label: `Field ${dollars(at(500))}`, edge: e('field', at(500)) },
    { label: `Buy 4 ${dollars(at(2500))}`, edge: e('buy-4', at(2500)) },
    { label: `Place 6 ${dollars(at(1200))}`, edge: e('place-6', at(1200)) },
  ];
  if (rules.tableMin <= 500) items.push({ label: 'Place 6 $5', edge: e('place-6', 500) });
  return items;
}

export const fmtEdgePct = (x: number) => `${(x * 100).toFixed(2)}%`;
