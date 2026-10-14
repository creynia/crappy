import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { RULE_PRESETS, formatMoney, resolveRules } from '../engine';
import type { Cents, RulePresetId, TableRules } from '../engine/types';
import {
  listStrategies,
  simulateCompare,
  simulateMany,
  simulateManyCompare,
  simulateSession,
  strategyMetrics,
} from '../strategy';
import type {
  LayoutBet,
  ManyResult,
  SessionConfig,
  SessionResult,
  StrategyId,
  StrategySpec,
} from '../strategy';
import { BankrollChart } from './BankrollChart';
import type { ChartMode, ChartSeries } from './BankrollChart';
import { TotalsHistogram } from './TotalsHistogram';

export interface AutoRollPanelProps {
  rules?: Partial<TableRules> | RulePresetId;
  bankroll?: Cents; // default $500
  /** subset of SceneConfig['autoRoll'] */
  config?: {
    strategies?: StrategyId[];
    defaultStrategy?: StrategySpec;
    rollOptions?: number[];
    sessions?: number[];
    compareMode?: boolean;
  };
  /** the player's current layout, for the `my-layout` strategy */
  layout?: LayoutBet[];
  initialSeed?: number;
  rollsPerHour?: number; // default 100
  onCompleted?(result: SessionResult | ManyResult): void;
  /** One session of <= 100 rolls: let the container replay it on the table. */
  onWatch?(cfg: SessionConfig): void;
}

const LENS_LABEL = { 'lowest-edge': 'Lowest edge', practical: 'Practical', fun: 'Fun per dollar' };
const MAX_ROLLS = 10_000;
const UNITS: Cents[] = [500, 1000, 2500, 10_000];
const PRESET_IDS = Object.keys(RULE_PRESETS) as RulePresetId[];
const PRESET_LABEL: Record<RulePresetId, string> = {
  'standard-vegas': 'Standard Vegas (3-4-5x)',
  'field-3x-12': 'Field pays 3x on 12',
  'odds-10x': '10x odds',
  'odds-100x': '100x odds',
};
const COLORS = ['#2f6fed', '#d9480f', '#2b8a3e'];

type Outcome =
  | { kind: 'single'; results: SessionResult[]; specs: StrategySpec[]; cfg: SessionConfig }
  | { kind: 'many'; results: ManyResult[]; specs: StrategySpec[]; cfg: SessionConfig };

function money(c: number, sign = false): string {
  return formatMoney(Math.round(c), { sign });
}

function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]! & 0x7fffffff;
  } catch {
    return Math.floor(Math.random() * 0x7fffffff);
  }
}

export function AutoRollPanel(props: AutoRollPanelProps) {
  const { config, layout, rollsPerHour = 100 } = props;
  const bankroll = props.bankroll ?? 50_000;
  const all = useMemo(() => {
    const l = listStrategies();
    return config?.strategies ? l.filter((s) => config.strategies!.includes(s.id)) : l;
  }, [config?.strategies]);
  const rollOptions = config?.rollOptions ?? [10, 100, 1000];
  const sessionOptions = config?.sessions ?? [1, 100];
  const compare = config?.compareMode === true;

  const [strategyIds, setStrategyIds] = useState<StrategyId[]>([
    config?.defaultStrategy?.id ?? all[0]?.id ?? 'pass-max-odds',
  ]);
  const [unit, setUnit] = useState<Cents>(config?.defaultStrategy?.unit ?? 1000);
  const [oddsMultiple, setOddsMultiple] = useState<number | undefined>(
    config?.defaultStrategy?.oddsMultiple,
  );
  const [rolls, setRolls] = useState<number>(rollOptions.includes(100) ? 100 : rollOptions[0]!);
  const [custom, setCustom] = useState('');
  const [sessions, setSessions] = useState<number>(sessionOptions[0] ?? 1);
  const [preset, setPreset] = useState<RulePresetId>(
    typeof props.rules === 'string' ? props.rules : 'standard-vegas',
  );
  const [seed, setSeed] = useState<number>(props.initialSeed ?? 1);
  const [progress, setProgress] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [chartTab, setChartTab] = useState<'results' | 'survival'>('results');
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const rulesInput = typeof props.rules === 'object' ? props.rules : preset;
  const rules = useMemo(() => resolveRules(rulesInput), [rulesInput]);
  const running = progress !== null;
  const lensGroups = (['lowest-edge', 'practical', 'fun'] as const).map((lens) => ({
    lens,
    items: all.filter((s) => s.lens === lens),
  }));

  const specFor = (id: StrategyId): StrategySpec => {
    const spec: StrategySpec = { id, unit };
    if (oddsMultiple !== undefined) spec.oddsMultiple = oddsMultiple;
    if (id === 'my-layout') spec.layout = layout ?? [];
    return spec;
  };

  const run = async (): Promise<void> => {
    setError(null);
    const specs = strategyIds.map(specFor);
    const base = {
      rolls,
      seed,
      bankroll,
      rules: rulesInput,
    };
    const cfg: SessionConfig = { ...base, strategy: specs[0]! };
    try {
      if (sessions <= 1) {
        const results = specs.length > 1 ? simulateCompare(base, specs) : [simulateSession(cfg)];
        setOutcome({ kind: 'single', results, specs, cfg });
        props.onCompleted?.(results[0]!);
      } else {
        const ac = new AbortController();
        abort.current = ac;
        setProgress(0);
        const o = { signal: ac.signal, onProgress: (p: number) => setProgress(p) };
        const results =
          specs.length > 1
            ? await simulateManyCompare(base, specs, sessions, o)
            : [await simulateMany(cfg, sessions, o)];
        setOutcome({ kind: 'many', results, specs, cfg });
        props.onCompleted?.(results[0]!);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  const toggleStrategy = (id: StrategyId): void => {
    setStrategyIds((cur) => {
      if (!compare) return [id];
      if (cur.includes(id)) return cur.length > 1 ? cur.filter((x) => x !== id) : cur;
      return cur.length >= 3 ? cur : [...cur, id];
    });
  };

  const needsLayout = strategyIds.includes('my-layout') && !(layout && layout.length > 0);
  const nameOf = (id: StrategyId): string => all.find((s) => s.id === id)?.name ?? id;
  const button = (active: boolean, label: string, onClick: () => void, key?: string | number) => (
    <button
      key={key ?? label}
      type="button"
      aria-pressed={active}
      disabled={running}
      onClick={onClick}
      style={{ minHeight: 44, minWidth: 44, padding: '0 12px', fontWeight: active ? 700 : 400 }}
    >
      {label}
    </button>
  );
  const group = { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' } as const;

  return (
    <section class="sim-autoroll" aria-label="Auto-roll" data-testid="auto-roll-panel">
      <div style={{ display: 'grid', gap: 12 }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>{compare ? 'Strategies to compare (pick up to 3)' : 'Strategy'}</legend>
          {compare ? (
            lensGroups.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.lens} style={{ marginTop: 4 }}>
                    <strong>{LENS_LABEL[g.lens]}</strong>
                    <div style={group}>
                      {g.items.map((s) => (
                        <label
                          key={s.id}
                          style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                          <input
                            type="checkbox"
                            checked={strategyIds.includes(s.id)}
                            disabled={running}
                            onChange={() => toggleStrategy(s.id)}
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ),
            )
          ) : (
            <select
              aria-label="Strategy"
              value={strategyIds[0]}
              disabled={running}
              style={{ minHeight: 44, maxWidth: '100%' }}
              onChange={(e) => toggleStrategy(e.currentTarget.value as StrategyId)}
            >
              {lensGroups.map(
                (g) =>
                  g.items.length > 0 && (
                    <optgroup key={g.lens} label={LENS_LABEL[g.lens]}>
                      {g.items.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                  ),
              )}
            </select>
          )}
          {!compare && (
            <p style={{ margin: '4px 0 0', fontSize: '0.9em' }}>
              {all.find((s) => s.id === strategyIds[0])?.description}
            </p>
          )}
          {needsLayout && (
            <p role="status" style={{ margin: '4px 0 0' }}>
              Build a layout on the table first; with no bets this just rolls the dice.
            </p>
          )}
        </fieldset>

        <div style={group} role="group" aria-label="Unit">
          <span>Unit</span>
          {UNITS.filter((u) => u >= rules.tableMin).map((u) =>
            button(unit === u, money(u), () => setUnit(u), u),
          )}
        </div>
        <div style={group} role="group" aria-label="Odds">
          <span>Odds</span>
          {button(oddsMultiple === undefined, 'Default', () => setOddsMultiple(undefined))}
          {button(oddsMultiple === 0, 'Flat only', () => setOddsMultiple(0))}
          {button(oddsMultiple === 2, '2x', () => setOddsMultiple(2))}
        </div>
        <div style={group} role="group" aria-label="Rolls">
          <span>Rolls</span>
          {rollOptions.map((r) =>
            button(
              rolls === r && custom === '',
              String(r),
              () => {
                setCustom('');
                setRolls(r);
              },
              r,
            ),
          )}
          <label>
            <span class="sr-only" style={{ position: 'absolute', left: -9999 }}>
              Custom number of rolls (up to {MAX_ROLLS})
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_ROLLS}
              placeholder="Custom"
              value={custom}
              disabled={running}
              style={{ minHeight: 44, width: 90 }}
              onInput={(e) => {
                const v = e.currentTarget.value;
                setCustom(v);
                const n = Math.floor(Number(v));
                if (n >= 1) setRolls(Math.min(n, MAX_ROLLS));
              }}
            />
          </label>
        </div>
        <div style={group} role="group" aria-label="Sessions">
          <span>Sessions</span>
          {sessionOptions.map((n) => button(sessions === n, String(n), () => setSessions(n), n))}
        </div>
        {typeof props.rules !== 'object' && (
          <label style={group}>
            Rules
            <select
              value={preset}
              disabled={running}
              style={{ minHeight: 44 }}
              onChange={(e) => setPreset(e.currentTarget.value as RulePresetId)}
            >
              {PRESET_IDS.map((id) => (
                <option key={id} value={id}>
                  {PRESET_LABEL[id]}
                </option>
              ))}
            </select>
          </label>
        )}
        <div style={group}>
          <label>
            Seed{' '}
            <input
              type="number"
              value={seed}
              disabled={running}
              style={{ minHeight: 44, width: 120 }}
              onInput={(e) => setSeed(Math.floor(Number(e.currentTarget.value)) || 0)}
            />
          </label>
          <button
            type="button"
            disabled={running}
            style={{ minHeight: 44 }}
            onClick={() => setSeed(randomSeed())}
          >
            Re-roll seed
          </button>
        </div>
        <div style={group}>
          <button
            type="button"
            data-testid="auto-roll-run"
            disabled={running}
            onClick={() => void run()}
            style={{ minHeight: 56, padding: '0 20px', fontWeight: 700 }}
          >
            {running ? 'Running...' : `Auto-roll ${rolls}${sessions > 1 ? ` x ${sessions}` : ''}`}
          </button>
          {running && (
            <button type="button" style={{ minHeight: 44 }} onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          )}
          {!running &&
            outcome?.kind === 'single' &&
            props.onWatch &&
            outcome.results.length === 1 &&
            outcome.cfg.rolls <= 100 && (
              <button
                type="button"
                style={{ minHeight: 44 }}
                onClick={() => props.onWatch!(outcome.cfg)}
              >
                Watch on the table
              </button>
            )}
        </div>
        {running && <progress value={progress ?? 0} max={1} aria-label="Simulation progress" />}
        {error && <p role="alert">{error}</p>}
      </div>

      {outcome && (
        <div data-testid="auto-roll-output" style={{ marginTop: 16 }} aria-live="polite">
          {renderOutput(outcome)}
        </div>
      )}
    </section>
  );

  function renderOutput(o: Outcome) {
    const start = bankroll;
    const noBet = o.specs.length === 1 && o.specs[0]!.id === 'no-bet';
    if (noBet && o.kind === 'single') return <TotalsHistogram counts={o.results[0]!.totals} />;
    let series: ChartSeries[];
    let mode: ChartMode;
    if (o.kind === 'single') {
      mode = 'running';
      series = o.results.map((r, i) => ({
        id: o.specs[i]!.id,
        label: nameOf(o.specs[i]!.id),
        line: r.equity,
        expected: r.expected,
      }));
    } else if (chartTab === 'survival') {
      mode = 'survival';
      series = o.results.map((r, i) => ({
        id: o.specs[i]!.id,
        label: nameOf(o.specs[i]!.id),
        line: r.survival,
      }));
    } else {
      mode = 'sessions';
      series = o.results.map((r, i) => ({
        id: o.specs[i]!.id,
        label: nameOf(o.specs[i]!.id),
        line: r.p50,
        band: { lo: r.p10, hi: r.p90 },
        expected: r.expected,
      }));
    }
    const metrics = o.specs.map((s) => strategyMetrics(s, rules));
    return (
      <>
        {o.kind === 'many' && (
          <div style={group} role="group" aria-label="Chart">
            {button(chartTab === 'results', 'Session results', () => setChartTab('results'))}
            {button(chartTab === 'survival', 'Survival', () => setChartTab('survival'))}
          </div>
        )}
        <BankrollChart
          mode={mode}
          series={series}
          start={start}
          sessions={o.kind === 'many' ? o.results[0]!.sessions : 1}
        />
        <table
          style={{ width: '100%', marginTop: 12, borderCollapse: 'collapse' }}
          data-testid="auto-roll-summary"
        >
          <thead>
            <tr>
              <th scope="col" style={{ textAlign: 'left' }}>
                Summary
              </th>
              {o.specs.map((s, i) => (
                <th key={s.id} scope="col" style={{ textAlign: 'right', color: COLORS[i] }}>
                  {nameOf(s.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summaryRows(o, metrics).map(([label, cells]) => (
              <tr key={label}>
                <th scope="row" style={{ textAlign: 'left', fontWeight: 400 }}>
                  {label}
                </th>
                {cells.map((c, i) => (
                  <td key={i} style={{ textAlign: 'right' }}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  function summaryRows(
    o: Outcome,
    metrics: ReturnType<typeof strategyMetrics>[],
  ): Array<[string, string[]]> {
    const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
    const perDollar = metrics.map((m) =>
      Number.isFinite(m.rollsPerDollar) ? m.rollsPerDollar.toFixed(1) : 'no cost',
    );
    const perHour = metrics.map((m) => money(m.expectedLossPerRoll * 100 * rollsPerHour));
    const edge = metrics.map((m) => pct(m.edgeOnAction));
    if (o.kind === 'single') {
      const rs = o.results;
      return [
        ['Final bankroll', rs.map((r) => money(r.finalEquity))],
        ['Actual result', rs.map((r) => money(r.finalEquity - bankroll, true))],
        ['Expected loss', rs.map((r) => money(-r.expectedLoss, true))],
        [
          'Luck (actual minus expected)',
          rs.map((r) => money(r.finalEquity - bankroll + r.expectedLoss, true)),
        ],
        ['Total wagered', rs.map((r) => money(r.totalWagered))],
        ['Edge on action', edge],
        ['Biggest drop from a peak', rs.map((r) => money(r.maxDrawdown))],
        ['Busted', rs.map((r) => (r.bustedAtRoll === null ? 'No' : `Roll ${r.bustedAtRoll}`))],
        ['Points made / seven-outs', rs.map((r) => `${r.pointsMade} / ${r.sevenOuts}`)],
        ['Longest hand (rolls)', rs.map((r) => String(r.longestHand))],
        ['Rolls per $1 of expected loss', perDollar],
        [`Expected cost per ${rollsPerHour} rolls`, perHour],
      ];
    }
    const rs = o.results;
    const last = (a: Float64Array) => a[a.length - 1]!;
    return [
      ['Median final bankroll', rs.map((r) => money(last(r.p50)))],
      ['Middle 80% of finals', rs.map((r) => `${money(last(r.p10))} to ${money(last(r.p90))}`)],
      ['Average final bankroll', rs.map((r) => money(r.meanFinal))],
      ['Expected final bankroll', rs.map((r) => money(last(r.expected)))],
      ['Chance of finishing ahead', rs.map((r) => pct(r.probAhead))],
      ['Busted sessions', rs.map((r) => pct(r.bustRate))],
      ['Edge on action', edge],
      ['Rolls per $1 of expected loss', perDollar],
      [`Expected cost per ${rollsPerHour} rolls`, perHour],
    ];
  }
}
