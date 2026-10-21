import { DEFAULT_RULES, RULE_PRESETS, resolveRules } from '../engine/rules';
import type { Cents, PointNumber, RulePresetId, TableRules } from '../engine/types';
import { betEdge, betEV } from '../math/ev';
import { add, div, frac, mul, neg, toNumber, type Fraction } from '../math/fraction';

/**
 * Custom table rules (I033): the choices the rules editor offers, mapped onto TableRules fields
 * the engine already supports, plus the live house-edge summary.
 */

const POINTS: readonly PointNumber[] = [4, 5, 6, 8, 9, 10];

export type OddsChoice = '3-4-5x' | '2x' | '5x' | '10x' | '20x' | '100x';
export const ODDS_CHOICES: readonly OddsChoice[] = ['3-4-5x', '2x', '5x', '10x', '20x', '100x'];

/**
 * Max odds per point for a choice, and the matching lay limit. A flat Nx table lets the don't side
 * lay enough to win N times the flat bet: 2N on 4/10, 1.5N on 5/9, 1.2N on 6/8 (as the 10x and
 * 100x presets do). 3-4-5x tables allow 6x lay odds on every point (the standard Vegas default).
 */
export function oddsLimits(choice: OddsChoice): Pick<TableRules, 'maxOdds' | 'maxLayOdds'> {
  if (choice === '3-4-5x')
    return { maxOdds: { ...DEFAULT_RULES.maxOdds }, maxLayOdds: { ...DEFAULT_RULES.maxLayOdds } };
  const n = Number(choice.slice(0, -1));
  const all = (k: number) => ({ 4: k, 5: k, 6: k, 8: k, 9: k, 10: k });
  return {
    maxOdds: all(n),
    maxLayOdds: { 4: 2 * n, 5: 1.5 * n, 6: 1.2 * n, 8: 1.2 * n, 9: 1.5 * n, 10: 2 * n },
  };
}

/** The choice matching a rules object's odds limits, or null if they match none (e.g. from a scene). */
export function oddsChoiceOf(r: TableRules): OddsChoice | null {
  for (const c of ODDS_CHOICES) {
    const l = oddsLimits(c);
    if (POINTS.every((p) => r.maxOdds[p] === l.maxOdds[p] && r.maxLayOdds[p] === l.maxLayOdds[p]))
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
const POINT_WAYS: Record<PointNumber, number> = { 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3 };

/**
 * House edge of a $10 Pass Line bet backed with full odds on every point, per dollar wagered
 * (flat plus the expected odds). Exact for the given rules, payout rounding included.
 */
export function passMaxOddsEdge(rules: TableRules): Fraction {
  const flat = 1000;
  let ev: Fraction = betEV({ type: 'pass-line', amount: flat, point: null }, comeOut(rules));
  let wagered: Fraction = frac(flat);
  for (const p of POINTS) {
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

/** The live summary under the editor: what these rules do to the bets they change. */
export function rulesSummary(rules: TableRules): RulesSummaryItem[] {
  const e = (t: Parameters<typeof betEdge>[0], amount: Cents) =>
    ratio(betEdge(t, amount, comeOut(rules)).perResolved);
  return [
    { label: 'Pass + max odds', edge: ratio(passMaxOddsEdge(rules)) },
    { label: 'Field', edge: e('field', 500) },
    { label: 'Buy 4', edge: e('buy-4', 2000) },
    { label: 'Place 6', edge: e('place-6', 1200) },
  ];
}

export const fmtEdgePct = (x: number) => `${(x * 100).toFixed(2)}%`;
