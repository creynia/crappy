import { describe, expect, it } from 'vitest';
import { resolveRules } from '../engine';
import { buildStrategyRows, sortRows } from './StrategyTable';

describe('strategy table rows', () => {
  const rules = resolveRules('standard-vegas');
  const rows = buildStrategyRows(1000, rules, 100);
  it('prices pass + odds at $0.0419 per roll and $4.19 an hour', () => {
    const r = rows.find((x) => x.id === 'pass-max-odds')!;
    expect(r.lossPerRoll).toBeCloseTo(0.0419, 3);
    expect(r.lossPerHour).toBeCloseTo(4.19, 1);
  });
  it('sorts ascending and descending by any column', () => {
    const asc = sortRows(rows, 'lossPerHour', 'asc').map((r) => r.lossPerHour);
    expect(asc).toEqual(asc.slice().sort((a, b) => a - b));
    const desc = sortRows(rows, 'edge', 'desc').map((r) => r.edge);
    expect(desc).toEqual(desc.slice().sort((a, b) => b - a));
    const names = sortRows(rows, 'name', 'asc').map((r) => r.name);
    expect(names).toEqual(names.slice().sort((a, b) => a.localeCompare(b)));
  });
  it('flags approximate presets so they are not ranked as exact', () => {
    const approx = rows.filter((r) => r.approximate).map((r) => r.id);
    expect(approx).toEqual(
      expect.arrayContaining([
        'martingale-pass',
        'dont-come-molly',
        'place-6-8-press',
        'inside-regress',
      ]),
    );
    expect(rows.find((r) => r.id === 'pass-max-odds')!.approximate).toBe(false);
  });
});
