import { useMemo, useState } from 'preact/hooks';
import type { TableRules } from '../engine/types';
import { listStrategies, strategyMetrics } from '../strategy';
import type { StrategyId, StrategyLens, StrategySpec } from '../strategy';
import { fmtMoney } from './text';

export type TableSortKey =
  'name' | 'edge' | 'lossPerRoll' | 'lossPerHour' | 'rollsPerDollar' | 'avgAction';

export interface StrategyRow {
  id: StrategyId;
  name: string;
  lens: StrategyLens;
  edge: number;
  lossPerRoll: number;
  lossPerHour: number;
  rollsPerDollar: number;
  avgAction: number;
  /** the numbers describe a starting or steady layout, not a long run (see StrategyMetrics.approximate) */
  approximate: boolean;
}

const LENS_LABEL: Record<StrategyLens, string> = {
  'lowest-edge': 'Lowest edge',
  practical: 'Practical',
  fun: 'Fun per dollar',
};

const COLUMNS: Array<{ key: TableSortKey; label: string }> = [
  { key: 'name', label: 'Strategy' },
  { key: 'edge', label: 'Edge on action' },
  { key: 'lossPerRoll', label: 'Loss per roll' },
  { key: 'lossPerHour', label: 'Loss per hour' },
  { key: 'rollsPerDollar', label: 'Rolls per $1' },
  { key: 'avgAction', label: 'On the table' },
];

/** Every preset (except the player's own layout) priced at one unit and rule set. */
export function buildStrategyRows(
  unit: number,
  rules: TableRules,
  rollsPerHour: number,
  allowed?: StrategyId[],
): StrategyRow[] {
  return listStrategies()
    .filter((s) => s.id !== 'my-layout' && (!allowed || allowed.includes(s.id)))
    .map((s) => {
      const m = strategyMetrics({ id: s.id, unit }, rules);
      return {
        id: s.id,
        name: s.name,
        lens: s.lens,
        edge: m.edgeOnAction,
        lossPerRoll: m.expectedLossPerRoll,
        lossPerHour: m.expectedLossPerRoll * rollsPerHour,
        rollsPerDollar: m.rollsPerDollar,
        avgAction: m.avgAction,
        approximate: m.approximate === true,
      };
    });
}

export function sortRows(rows: StrategyRow[], key: TableSortKey, dir: 'asc' | 'desc') {
  const sign = dir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => {
    const x = a[key];
    const y = b[key];
    // Infinity (no cost) compares fine numerically; names use locale order
    const c =
      typeof x === 'string' || typeof y === 'string'
        ? String(x).localeCompare(String(y))
        : x < y
          ? -1
          : x > y
            ? 1
            : 0;
    return c * sign || a.name.localeCompare(b.name);
  });
}

export interface StrategyTableProps {
  unit: number;
  rules: TableRules;
  rollsPerHour: number;
  strategies?: StrategyId[];
  /** "Run it": the container selects this spec in the auto-roll form. */
  onRun?(spec: StrategySpec): void;
}

export function StrategyTable(props: StrategyTableProps) {
  const { unit, rules, rollsPerHour } = props;
  const [key, setKey] = useState<TableSortKey>('lossPerHour');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const rows = useMemo(
    () => sortRows(buildStrategyRows(unit, rules, rollsPerHour, props.strategies), key, dir),
    [unit, rules, rollsPerHour, props.strategies, key, dir],
  );
  const sortBy = (k: TableSortKey) => {
    if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setKey(k);
      // "Rolls per $1": more is cheaper, so best first
      setDir(k === 'rollsPerDollar' ? 'desc' : 'asc');
    }
  };
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
  const cost = (c: number) => (c > 0 ? fmtMoney(Math.round(c * 100), { exact: true }) : '$0.00');
  const perRoll = (c: number) => `$${c.toFixed(4)}`;
  const per1 = (r: number) => (Number.isFinite(r) ? r.toFixed(1) : 'no cost');
  const onTable = (d: number) => fmtMoney(Math.round(d * 100), { exact: true });
  const cell = (r: StrategyRow, k: TableSortKey): string =>
    (r.approximate && k !== 'name' ? '≈ ' : '') + rawCell(r, k);
  const rawCell = (r: StrategyRow, k: TableSortKey): string =>
    k === 'edge'
      ? pct(r.edge)
      : k === 'lossPerRoll'
        ? perRoll(r.lossPerRoll)
        : k === 'lossPerHour'
          ? cost(r.lossPerHour)
          : k === 'rollsPerDollar'
            ? per1(r.rollsPerDollar)
            : k === 'avgAction'
              ? onTable(r.avgAction)
              : r.name;

  return (
    <div class="sim-st" data-testid="strategy-table">
      <p class="sim-ar-desc">
        Every preset at a {fmtMoney(unit)} unit, steady layout, {rollsPerHour} rolls an hour. Tap a
        heading to sort.
      </p>
      <div class="sim-st-wrap">
        <table class="sim-st-table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={key === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <button type="button" class="sim-st-sort" onClick={() => sortBy(c.key)}>
                    {c.label}
                    {key === c.key ? (dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                </th>
              ))}
              <th scope="col">
                <span class="sim-sr">Run it</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} data-strategy={r.id}>
                <th scope="row" data-label="Strategy">
                  {r.name}
                  <span class="sim-st-lens">
                    {LENS_LABEL[r.lens]}
                    {r.approximate ? ' · ≈ starting layout' : ''}
                  </span>
                </th>
                {COLUMNS.slice(1).map((c) => (
                  <td key={c.key} data-label={c.label}>
                    {cell(r, c.key)}
                  </td>
                ))}
                <td class="sim-st-run">
                  <button
                    type="button"
                    class="sim-ar-btn"
                    aria-label={`Run it: ${r.name}`}
                    onClick={() => props.onRun?.({ id: r.id, unit })}
                  >
                    Run it
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.some((r) => r.approximate) ? (
        <p class="sim-ar-desc" data-testid="strategy-table-approx">
          ≈ marks plans that change their bets as they play, or that this table prices as a steady
          layout: their numbers are an estimate for the starting layout, so do not rank them against
          the exact rows.
        </p>
      ) : null}
    </div>
  );
}
