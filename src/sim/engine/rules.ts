import type { PointNumber, RulePresetId, TableRules } from './types';

const all = (n: number): Record<PointNumber, number> => ({ 4: n, 5: n, 6: n, 8: n, 9: n, 10: n });

export const DEFAULT_RULES: TableRules = {
  presetId: 'standard-vegas',
  tableMin: 500,
  tableMax: 500_000,
  propMin: 100,
  maxOdds: { 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3 },
  maxLayOdds: { 4: 6, 5: 6, 6: 6, 8: 6, 9: 6, 10: 6 },
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
    maxLayOdds: { 4: 20, 5: 15, 6: 12, 8: 12, 9: 15, 10: 20 },
  },
  'odds-100x': {
    maxOdds: all(100),
    maxLayOdds: { 4: 200, 5: 150, 6: 120, 8: 120, 9: 150, 10: 200 },
  },
};

export function resolveRules(_r?: Partial<TableRules> | RulePresetId): TableRules {
  throw new Error('TODO(engine)');
}
