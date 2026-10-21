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
  SweepMultiple,
} from '../strategy';
import { BankrollChart } from './BankrollChart';
import type { ChartMode, ChartSeries } from './BankrollChart';
import { ResultsHistogram } from './ResultsHistogram';
import { SweepPanel } from './SweepPanel';
import { TotalsHistogram } from './TotalsHistogram';
import { fmtMoney } from './text';

// Strategies whose default odds are the table maximum.
const MAX_ODDS_BY_DEFAULT = new Set<string>([
  'pass-max-odds',
  'dont-pass-max-lay',
  'three-point-molly',
]);

// Strategies with no line bet, so an odds setting means nothing for them.
const NO_ODDS_STRATEGIES = new Set<string>([
  'place-6-8',
  'iron-cross',
  'across',
  'field-every-roll',
  'any-7-every-roll',
  'hardways-all',
  'no-bet',
  'my-layout',
]);

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
    /** exact specs to run side by side on the same seed (each with its own unit and odds) */
    compare?: StrategySpec[];
    /** show the odds-multiple sweep table instead of the run form */
    sweep?: { strategy: StrategyId; oddsMultiples: SweepMultiple[] };
  };
  /** the player's current layout, for the `my-layout` strategy */
  layout?: LayoutBet[];
  initialSeed?: number;
  rollsPerHour?: number; // default 100
  /** `result` is the first strategy's; `all` has every compared strategy's result, `specs` what was run */
  onCompleted?(
    result: SessionResult | ManyResult,
    all?: (SessionResult | ManyResult)[],
    specs?: StrategySpec[],
  ): void;
  /** The odds sweep finished (config.sweep); `rolls` is the length of each swept session. */
  onSweepCompleted?(rolls: number): void;
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

type Metrics = ReturnType<typeof strategyMetrics>;
type Outcome =
  | {
      kind: 'single';
      results: SessionResult[];
      specs: StrategySpec[];
      cfg: SessionConfig;
      metrics: Metrics[];
    }
  | {
      kind: 'many';
      results: ManyResult[];
      specs: StrategySpec[];
      cfg: SessionConfig;
      metrics: Metrics[];
    };

function money(c: number, sign = false): string {
  return formatMoney(Math.round(c), { sign });
}

/** Exact cents for the summary table, e.g. $1,935.00 */
function money2(c: number, sign = false): string {
  return fmtMoney(c, { sign, exact: true });
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
  const fixedSpecs = config?.compare && config.compare.length > 0 ? config.compare : null;
  const compare = config?.compareMode === true || fixedSpecs !== null;

  const [strategyIds, setStrategyIds] = useState<StrategyId[]>(
    fixedSpecs
      ? fixedSpecs.map((x) => x.id)
      : [config?.defaultStrategy?.id ?? all[0]?.id ?? 'pass-max-odds'],
  );
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
  const unitOptions = UNITS.filter((u) => u >= rules.tableMin);
  if (unitOptions.length === 0) unitOptions.push(rules.tableMin);
  // when the chosen unit isn't offered (higher table minimum), use the nearest one that is
  const effUnit = unitOptions.includes(unit)
    ? unit
    : (unitOptions.find((u) => u >= unit) ?? unitOptions[unitOptions.length - 1]!);
  const running = progress !== null;
  const lensGroups = (['lowest-edge', 'practical', 'fun'] as const).map((lens) => ({
    lens,
    items: all.filter((s) => s.lens === lens),
  }));

  const specFor = (id: StrategyId): StrategySpec => {
    const spec: StrategySpec = { id, unit: effUnit };
    if (oddsMultiple !== undefined) spec.oddsMultiple = oddsMultiple;
    if (id === 'my-layout') spec.layout = layout ?? [];
    return spec;
  };

  const run = async (): Promise<void> => {
    setError(null);
    // computed once per run, with the rules this run uses
    const metricsFor = (specs: StrategySpec[]): Metrics[] =>
      specs.map((s) => strategyMetrics(s, rules));
    const specs = fixedSpecs
      ? fixedSpecs.map((x) => (x.id === 'my-layout' ? { ...x, layout: layout ?? [] } : x))
      : strategyIds.map(specFor);
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
        setOutcome({ kind: 'single', results, specs, cfg, metrics: metricsFor(specs) });
        props.onCompleted?.(results[0]!, results, specs);
      } else {
        const ac = new AbortController();
        abort.current = ac;
        setProgress(0);
        const o = { signal: ac.signal, onProgress: (p: number) => setProgress(p) };
        const results =
          specs.length > 1
            ? await simulateManyCompare(base, specs, sessions, o)
            : [await simulateMany(cfg, sessions, o)];
        setOutcome({ kind: 'many', results, specs, cfg, metrics: metricsFor(specs) });
        props.onCompleted?.(results[0]!, results, specs);
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
      class="sim-ar-btn"
    >
      {label}
    </button>
  );

  if (config?.sweep)
    return (
      <SweepPanel
        config={config.sweep}
        rules={props.rules}
        bankroll={bankroll}
        onCompleted={() => props.onSweepCompleted?.(100)}
        initialSeed={props.initialSeed}
        unit={config.defaultStrategy?.unit}
      />
    );

  return (
    <section class="sim-autoroll" aria-label="Auto-roll" data-testid="auto-roll-panel">
      <div class="sim-ar-form">
        <fieldset class="sim-ar-fieldset">
          <legend>
            {fixedSpecs
              ? 'Strategies compared on the same dice'
              : compare
                ? 'Strategies to compare (pick up to 3)'
                : 'Strategy'}
          </legend>
          {fixedSpecs ? (
            <ul class="sim-ar-fixed">
              {fixedSpecs.map((x, i) => (
                <li key={i} style={{ color: COLORS[i] }}>
                  <strong>{nameOf(x.id)}</strong>
                  <span class="sim-ar-fixed-note">
                    {' '}
                    {money(x.unit)} unit,{' '}
                    {NO_ODDS_STRATEGIES.has(x.id)
                      ? 'standard layout'
                      : x.oddsMultiple === undefined
                        ? MAX_ODDS_BY_DEFAULT.has(x.id)
                          ? 'max odds'
                          : 'default odds'
                        : x.oddsMultiple === 0
                          ? 'flat bets only'
                          : `${x.oddsMultiple}x odds`}
                  </span>
                </li>
              ))}
            </ul>
          ) : compare ? (
            lensGroups.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.lens} class="sim-ar-lens">
                    <strong>{LENS_LABEL[g.lens]}</strong>
                    <div class="sim-ar-group">
                      {g.items.map((s) => (
                        <label key={s.id} class="sim-ar-check">
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
            <p class="sim-ar-desc">{all.find((s) => s.id === strategyIds[0])?.description}</p>
          )}
          {needsLayout && (
            <p role="status" class="sim-ar-desc">
              Build a layout on the table first; with no bets this just rolls the dice.
            </p>
          )}
        </fieldset>

        {!fixedSpecs && (
          <>
            <div class="sim-ar-group" role="group" aria-label="Unit">
              <span>Unit</span>
              {unitOptions.map((u) => button(effUnit === u, money(u), () => setUnit(u), u))}
            </div>
            <div class="sim-ar-group" role="group" aria-label="Odds">
              <span>Odds</span>
              {button(oddsMultiple === undefined, 'Max', () => setOddsMultiple(undefined))}
              {button(oddsMultiple === 0, 'Flat only', () => setOddsMultiple(0))}
              {button(oddsMultiple === 2, '2x', () => setOddsMultiple(2))}
            </div>
          </>
        )}
        <div class="sim-ar-group" role="group" aria-label="Rolls">
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
            <span class="sim-sr">Custom number of rolls (up to {MAX_ROLLS})</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_ROLLS}
              placeholder="Custom"
              value={custom}
              disabled={running}
              class="sim-ar-num"
              onInput={(e) => {
                const v = e.currentTarget.value;
                setCustom(v);
                const n = Math.floor(Number(v));
                if (n >= 1) setRolls(Math.min(n, MAX_ROLLS));
              }}
            />
          </label>
        </div>
        <div class="sim-ar-group" role="group" aria-label="Sessions">
          <span>Sessions</span>
          {sessionOptions.map((n) => button(sessions === n, String(n), () => setSessions(n), n))}
        </div>
        {typeof props.rules !== 'object' && !fixedSpecs && (
          <label class="sim-ar-group">
            Rules
            <select
              value={preset}
              disabled={running}
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
        <div class="sim-ar-group">
          <label>
            Seed{' '}
            <input
              type="number"
              value={seed}
              disabled={running}
              class="sim-ar-num sim-ar-seed"
              onInput={(e) => setSeed(Math.floor(Number(e.currentTarget.value)) || 0)}
            />
          </label>
          <button
            type="button"
            disabled={running}
            class="sim-ar-btn"
            onClick={() => setSeed(randomSeed())}
          >
            Re-roll seed
          </button>
        </div>
        <div class="sim-ar-group">
          <button
            type="button"
            data-testid="auto-roll-run"
            disabled={running}
            onClick={() => void run()}
            class="sim-ar-run"
          >
            {running ? 'Running...' : `Auto-roll ${rolls}${sessions > 1 ? ` x ${sessions}` : ''}`}
          </button>
          {running && (
            <button type="button" class="sim-ar-btn" onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          )}
          {!running &&
            outcome?.kind === 'single' &&
            props.onWatch &&
            outcome.results.length === 1 &&
            outcome.cfg.rolls <= 100 && (
              <button type="button" onClick={() => props.onWatch!(outcome.cfg)}>
                Watch on the table
              </button>
            )}
        </div>
        {running && <progress value={progress ?? 0} max={1} aria-label="Simulation progress" />}
        {error && <p role="alert">{error}</p>}
      </div>

      {outcome && (
        <div data-testid="auto-roll-output" class="sim-ar-output" aria-live="polite">
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
    const metrics = o.metrics;
    return (
      <>
        {o.kind === 'many' && (
          <div class="sim-ar-group" role="group" aria-label="Chart">
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
        {o.kind === 'many' && chartTab === 'results' && (
          <ResultsHistogram
            start={start}
            series={o.results.map((r, i) => ({
              label: nameOf(o.specs[i]!.id),
              color: COLORS[i]!,
              finals: r.finals,
              busted: Math.round(r.bustRate * r.sessions),
              expected: r.expected[r.expected.length - 1]! - start,
            }))}
          />
        )}
        <div class="sim-ar-summary-wrap" tabindex={0} role="region" aria-label="Strategy summary">
          <table class="sim-ar-summary" data-testid="auto-roll-summary">
            <thead>
              <tr>
                <th scope="col">Summary</th>
                {o.specs.map((s, i) => (
                  <th key={i} scope="col" style={{ color: COLORS[i] }}>
                    {nameOf(s.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaryRows(o, metrics).map(([label, cells]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {cells.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  function summaryRows(
    o: Outcome,
    metrics: ReturnType<typeof strategyMetrics>[],
  ): Array<[string, string[]]> {
    const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
    // learner-facing cost rows come from the run's OWN expected loss, so they agree with the
    // "Expected loss" / "Expected final bankroll" rows (the analytic steady-layout figure is not shown)
    const lossPerRoll = (): number[] =>
      o.kind === 'single'
        ? o.results.map((r) => (r.rollsPlayed > 0 ? r.expectedLoss / r.rollsPlayed : 0))
        : o.results.map((r) => {
            const n = Math.max(1, r.expected.length - 1);
            return (bankroll - r.expected[r.expected.length - 1]!) / n;
          });
    const perRoll = lossPerRoll();
    const perDollar = perRoll.map((c) => (c > 0 ? (100 / c).toFixed(1) : 'no cost'));
    const perHour = perRoll.map((c) => money2(c * rollsPerHour));
    const edge = metrics.map((m) => pct(m.edgeOnAction));
    if (o.kind === 'single') {
      const rs = o.results;
      return [
        ['Final bankroll', rs.map((r) => money2(r.finalEquity))],
        ['Actual result', rs.map((r) => money2(r.finalEquity - bankroll, true))],
        ['Expected loss', rs.map((r) => money2(-r.expectedLoss, true))],
        [
          'Luck (actual minus expected)',
          rs.map((r) => money2(r.finalEquity - bankroll + r.expectedLoss, true)),
        ],
        ['Total wagered', rs.map((r) => money2(r.totalWagered))],
        ['Edge on action', edge],
        ['Biggest drop from a peak', rs.map((r) => money2(r.maxDrawdown))],
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
      ['Median final bankroll', rs.map((r) => money2(last(r.p50)))],
      ['Middle 80% of finals', rs.map((r) => `${money2(last(r.p10))} to ${money2(last(r.p90))}`)],
      ['Average final bankroll', rs.map((r) => money2(r.meanFinal))],
      ['Expected final bankroll', rs.map((r) => money2(last(r.expected)))],
      ['Chance of finishing ahead', rs.map((r) => pct(r.probAhead))],
      ['Busted sessions', rs.map((r) => pct(r.bustRate))],
      ['Edge on action', edge],
      ['Rolls per $1 of expected loss', perDollar],
      [`Expected cost per ${rollsPerHour} rolls`, perHour],
    ];
  }
}
