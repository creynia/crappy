import type { PointNumber, PointTable, RulePresetId, RulesVariant, TableRules } from './types';
import { CRAPLESS_POINTS, POINT_NUMBERS } from './types';

const all = (n: number): PointTable => ({
  2: n,
  3: n,
  4: n,
  5: n,
  6: n,
  8: n,
  9: n,
  10: n,
  11: n,
  12: n,
});
// 3-4-5x extended so a max-odds win is 6x the flat on every point: 1x on 2/12 (6:1), 2x on 3/11 (3:1).
const ODDS_345: PointTable = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

export const DEFAULT_RULES: TableRules = {
  presetId: 'standard-vegas',
  variant: 'standard',
  tableMin: 500,
  tableMax: 500_000,
  propMin: 100,
  maxOdds: ODDS_345,
  maxLayOdds: all(6),
  fieldPays: { 2: 2, 12: 2 },
  vig: { rate: 0.05, timing: 'on-win', rounding: 'floor-dollar-min-1' },
  payoutUnit: 1,
  placeBetsWorkOnComeOut: false,
  hardwaysWorkOnComeOut: false,
  comeOddsWorkOnComeOut: false,
  allowPutBets: false,
};

export const RULE_PRESETS: Record<RulePresetId, Partial<TableRules>> = {
  'standard-vegas': {},
  'field-3x-12': { fieldPays: { 2: 2, 12: 3 } },
  'odds-10x': {
    maxOdds: all(10),
    maxLayOdds: { 2: 60, 3: 30, 4: 20, 5: 15, 6: 12, 8: 12, 9: 15, 10: 20, 11: 30, 12: 60 },
  },
  'odds-100x': {
    maxOdds: all(100),
    maxLayOdds: {
      2: 600,
      3: 300,
      4: 200,
      5: 150,
      6: 120,
      8: 120,
      9: 150,
      10: 200,
      11: 300,
      12: 600,
    },
  },
  crapless: { variant: 'crapless' },
};

/** The points a game under these rules can have. */
export function pointsFor(rules: { variant?: RulesVariant }): readonly PointNumber[] {
  return rules.variant === 'crapless' ? CRAPLESS_POINTS : POINT_NUMBERS;
}

/** Copy, filling points a partial table leaves out (e.g. a scene's 6-point table) from `base`. */
const copyPoints = (r: Partial<PointTable>, base: PointTable): PointTable => ({ ...base, ...r });

/** Merge a preset id or partial rules onto DEFAULT_RULES; returns a fresh object. */
/**
 * A rules override: any TableRules fields, where the odds tables may list only some points (a
 * 6-point table from a scene); resolveRules fills the rest from the defaults.
 */
export type RulesPatch = Partial<Omit<TableRules, 'maxOdds' | 'maxLayOdds'>> & {
  maxOdds?: Partial<PointTable>;
  maxLayOdds?: Partial<PointTable>;
};

export function resolveRules(r?: RulesPatch | RulePresetId): TableRules {
  let partial: RulesPatch;
  let presetId: RulePresetId = 'standard-vegas';
  if (r === undefined) {
    partial = {};
  } else if (typeof r === 'string') {
    partial = RULE_PRESETS[r];
    presetId = r;
  } else {
    partial = r;
    presetId = r.presetId ?? 'standard-vegas';
  }
  const m = { ...DEFAULT_RULES, ...partial, presetId };
  return {
    ...m,
    maxOdds: copyPoints(m.maxOdds, DEFAULT_RULES.maxOdds),
    maxLayOdds: copyPoints(m.maxLayOdds, DEFAULT_RULES.maxLayOdds),
    fieldPays: { ...m.fieldPays },
    vig: { ...m.vig },
  };
}
