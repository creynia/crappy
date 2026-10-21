import { useEffect, useRef, useState } from 'preact/hooks';
import type { Cents, RulePresetId, TableRules } from '../engine/types';
import { simulateSweep } from '../strategy';
import type { StrategyId, SweepMultiple, SweepRow } from '../strategy';
import { fmtMoney } from './text';

export interface SweepPanelProps {
  rules?: Partial<TableRules> | RulePresetId;
  bankroll?: Cents; // default $1,000
  config: { strategy: StrategyId; oddsMultiples: SweepMultiple[] };
  unit?: Cents; // default $10
  rolls?: number; // default 100
  sessions?: number; // default 100
  initialSeed?: number;
  onCompleted?(rows: SweepRow[]): void;
}

const label = (m: SweepMultiple): string =>
  m === 'max' ? 'Table max' : m === 0 ? 'None' : `${m}x`;
const pct = (x: number): string => `${(x * 100).toFixed(x < 0.01 ? 3 : 2)}%`;

/** Same dice, one line strategy, growing odds: the edge falls, the dollars expected lost do not, the swing grows. */
export function SweepPanel(props: SweepPanelProps) {
  const { config, rolls = 100, sessions = 100 } = props;
  const unit = props.unit ?? 1000;
  const bankroll = props.bankroll ?? 1_000_000;
  const [seed, setSeed] = useState(props.initialSeed ?? 1);
  const [rows, setRows] = useState<SweepRow[] | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const run = async (s: number): Promise<void> => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    setProgress(0);
    try {
      const out = await simulateSweep(
        {
          strategy: config.strategy,
          unit,
          oddsMultiples: config.oddsMultiples,
          rolls,
          seed: s,
          bankroll,
          rules: props.rules,
        },
        sessions,
        { signal: ac.signal, onProgress: setProgress },
      );
      setRows(out);
      props.onCompleted?.(out);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      throw e;
    } finally {
      if (abort.current === ac) setProgress(null);
    }
  };

  const running = progress !== null;
  return (
    <section class="sim-autoroll sim-sweep" aria-label="Odds sweep" data-testid="sweep-panel">
      <p class="sim-sweep-intro">
        {sessions} sessions of {rolls} rolls at a {fmtMoney(unit)} line bet, the same dice for every
        row. Only the odds change.
      </p>
      <div class="sim-sweep-actions">
        <button
          type="button"
          class="sim-ar-run"
          data-testid="sweep-run"
          disabled={running}
          onClick={() => void run(seed)}
        >
          {running
            ? `Running ${Math.round((progress ?? 0) * 100)}%`
            : rows
              ? 'Run again'
              : 'Run sweep'}
        </button>
        {rows && (
          <button
            type="button"
            class="sim-ar-btn"
            data-testid="sweep-reseed"
            disabled={running}
            onClick={() => {
              setSeed(seed + sessions);
              void run(seed + sessions);
            }}
          >
            New dice
          </button>
        )}
      </div>
      {rows && (
        <table class="sim-ar-summary sim-sweep-table" data-testid="sweep-table">
          <thead>
            <tr>
              <th scope="col">Odds</th>
              <th scope="col">Edge on action</th>
              <th scope="col">Expected loss / {rolls} rolls</th>
              <th scope="col">Swing (SD)</th>
              <th scope="col">Finish ahead</th>
              <th scope="col">Bust</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} data-testid="sweep-row">
                <th scope="row">{label(r.multiple)}</th>
                <td>{pct(r.edgeOnAction)}</td>
                <td>{fmtMoney(Math.round(r.expectedLossCents), { exact: true })}</td>
                <td>{fmtMoney(Math.round(r.sdFinal))}</td>
                <td>{Math.round(r.probAhead * 100)}%</td>
                <td>{Math.round(r.bustRate * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows && (
        <p class="sim-sweep-intro">
          A session that busts stops early, so with a small bankroll the bust rate and the average
          loss can look larger than the edge suggests. Odds themselves cost nothing.
        </p>
      )}
    </section>
  );
}
