import { useEffect, useMemo, useState } from 'preact/hooks';
import { resolveRules } from '../engine';
import type { Cents, RulePresetId, TableRules } from '../engine/types';
import {
  listStrategies,
  planExpectedLoss,
  planRisk,
  suggestBankroll,
  suggestStopLoss,
} from '../strategy';
import type { BankrollSuggestion, PlanInput, PlanRisk, StrategyId } from '../strategy';
import { fmtMoney } from './text';

export interface PlanPanelProps {
  rules?: Partial<TableRules> | RulePresetId;
  /** starting value for the bankroll choice (cents) */
  bankroll?: Cents;
  rollsPerHour?: number; // default 100
  /** test hook: schedule simulation slices (default setTimeout) */
  schedule?: (fn: () => void) => void;
  /** pause before simulating after an input changes (ms, default 250) */
  debounceMs?: number;
}

const BANKROLLS: Cents[] = [10_000, 20_000, 30_000, 50_000, 100_000, 200_000];
const UNITS: Cents[] = [500, 1000, 2500, 10_000];
const HOURS = [1, 2, 4, 8];
const HIDDEN: ReadonlySet<StrategyId> = new Set<StrategyId>(['my-layout', 'no-bet']);
const pct = (x: number): string => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`;

/** Session plan: what a session is likely to cost and how likely it is to go broke, before you play. */
export function PlanPanel(props: PlanPanelProps) {
  const rollsPerHour = props.rollsPerHour ?? 100;
  const rules = useMemo(() => resolveRules(props.rules ?? 'standard-vegas'), [props.rules]);
  const strategies = useMemo(() => listStrategies().filter((s) => !HIDDEN.has(s.id)), []);
  const unitOptions = UNITS.filter((u) => u >= rules.tableMin);
  if (unitOptions.length === 0) unitOptions.push(rules.tableMin);
  const initialBank = BANKROLLS.reduce((best, b) =>
    Math.abs(b - (props.bankroll ?? 30_000)) < Math.abs(best - (props.bankroll ?? 30_000))
      ? b
      : best,
  );
  const [bankroll, setBankroll] = useState<Cents>(initialBank);
  const [unit, setUnit] = useState<Cents>(unitOptions.includes(1000) ? 1000 : unitOptions[0]!);
  const [strategyId, setStrategyId] = useState<StrategyId>('pass-max-odds');
  const [hours, setHours] = useState(4);
  const [risk, setRisk] = useState<PlanRisk | null>(null);
  const [suggestion, setSuggestion] = useState<BankrollSuggestion | null>(null);
  const [progress, setProgress] = useState<number | null>(0);

  const effUnit = unitOptions.includes(unit) ? unit : unitOptions[0]!;
  const input: PlanInput = {
    strategy: { id: strategyId, unit: effUnit },
    bankroll,
    hours,
    rollsPerHour,
    rules: props.rules ?? 'standard-vegas',
  };
  const instant = planExpectedLoss(input);
  const name = strategies.find((s) => s.id === strategyId)?.name ?? strategyId;

  // Instant numbers above; the simulated ones follow. Any change aborts the run in flight.
  useEffect(() => {
    const ac = new AbortController();
    setRisk(null);
    setSuggestion(null);
    setProgress(0);
    const h = setTimeout(() => {
      const opts = {
        signal: ac.signal,
        ...(props.schedule ? { schedule: props.schedule } : {}),
      };
      void (async () => {
        try {
          const r = await planRisk(input, { ...opts, onProgress: (p) => setProgress(p * 0.5) });
          setRisk(r);
          setProgress(0.5);
          if (r.bustRate > 0.05) {
            const s = await suggestBankroll(input, opts);
            setSuggestion(s);
          }
          setProgress(null);
        } catch (e) {
          if ((e as Error).name !== 'AbortError') throw e;
        }
      })();
    }, props.debounceMs ?? 250);
    return () => {
      clearTimeout(h);
      ac.abort();
    };
  }, [bankroll, effUnit, strategyId, hours, rollsPerHour, props.rules]);

  const group = (label: string, children: unknown) => (
    <div class="sim-ar-group" role="group" aria-label={label}>
      <span>{label}</span>
      {children as never}
    </div>
  );
  const chip = (active: boolean, text: string, onClick: () => void) => (
    <button type="button" class="sim-ar-btn" aria-pressed={active} onClick={onClick} key={text}>
      {text}
    </button>
  );
  const longName = `${fmtMoney(effUnit)} ${name.toLowerCase()}`;
  const stop = risk ? suggestStopLoss(risk, instant.expectedLoss, bankroll) : null;

  return (
    <section class="sim-plan" aria-label="Session plan" data-testid="plan-panel">
      <div class="sim-ar-form">
        <label class="sim-ar-field">
          Strategy
          <select
            aria-label="Strategy"
            value={strategyId}
            onChange={(e) => setStrategyId(e.currentTarget.value as StrategyId)}
          >
            {strategies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {group(
          'Bankroll',
          BANKROLLS.map((b) => chip(bankroll === b, fmtMoney(b), () => setBankroll(b))),
        )}
        {group(
          'Unit',
          unitOptions.map((u) => chip(effUnit === u, fmtMoney(u), () => setUnit(u))),
        )}
        {group(
          'Hours',
          HOURS.map((x) => chip(hours === x, `${x} h`, () => setHours(x))),
        )}
      </div>

      <div class="sim-plan-out" aria-live="polite" data-testid="plan-output">
        <p data-testid="plan-expected">
          The price of this session: about <strong>{fmtMoney(instant.expectedLoss)}</strong> in
          expected loss over {instant.rolls.toLocaleString('en-US')} rolls ({hours} h at{' '}
          {rollsPerHour} rolls an hour). Think of it as what the entertainment costs.
        </p>
        {risk ? (
          <>
            <ul class="sim-plan-list" data-testid="plan-risk">
              <li>
                Goes broke before the end: <strong>{pct(risk.bustRate)}</strong> of {risk.sessions}{' '}
                simulated sessions
              </li>
              <li>
                Finishes ahead: <strong>{pct(risk.probAhead)}</strong>
              </li>
              <li>
                A typical bad session (1 in 10) ends {fmtMoney(risk.p10, { sign: true })}; a good
                one (1 in 10) ends {fmtMoney(risk.p90, { sign: true })}
              </li>
            </ul>
            {stop !== null && (
              <p data-testid="plan-stop">
                Suggested stop-loss: <strong>{fmtMoney(stop)}</strong>. Walking away at that point
                would end about the worst 1 in 10 sessions early.
              </p>
            )}
            {risk.bustRate <= 0.05 ? (
              <p data-testid="plan-suggest">
                With {fmtMoney(bankroll)} and a {longName}, only {pct(risk.bustRate)} of {hours}
                -hour sessions go broke, already under 5%.
              </p>
            ) : suggestion ? (
              <p data-testid="plan-suggest">
                With {fmtMoney(bankroll)} and a {longName}, about {pct(risk.bustRate)} of {hours}
                -hour sessions go broke;{' '}
                {suggestion.bankroll !== null ? (
                  <>
                    <strong>{fmtMoney(suggestion.bankroll)}</strong> gets that under 5%.
                  </>
                ) : (
                  <>even {fmtMoney(suggestion.cap)} does not get that under 5%.</>
                )}
              </p>
            ) : (
              <p role="status">Finding a bankroll that keeps the risk under 5%…</p>
            )}
          </>
        ) : (
          <p role="status">
            Simulating {hours}-hour sessions…{' '}
            {progress !== null && <progress value={progress} max={1} aria-label="Plan progress" />}
          </p>
        )}
        <p class="sim-ar-desc">
          Simulated with the same dice for every bankroll, so the numbers are repeatable. This is an
          estimate, not a promise.
        </p>
      </div>
    </section>
  );
}
