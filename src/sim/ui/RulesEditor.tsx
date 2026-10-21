import { useId, useState } from 'preact/hooks';
import type { TableRules } from '../engine/types';
import {
  ODDS_CHOICES,
  PAYOUT_UNIT_CHOICES,
  TABLE_MAX_CHOICES,
  TABLE_MIN_CHOICES,
  fmtEdgePct,
  oddsChoiceOf,
  oddsLimits,
  rulesSummary,
  type OddsChoice,
} from './customRules';
import { fmtMoney } from './text';
import './rulesEditor.css';

export interface RulesEditorProps {
  /** the rules the form starts from (the table's current rules) */
  initial: TableRules;
  onApply: (rules: TableRules) => void;
  onCancel: () => void;
  /** button text; the sandbox resets the table on apply */
  applyLabel?: string;
  disabled?: boolean;
}

type BoolRule =
  'placeBetsWorkOnComeOut' | 'hardwaysWorkOnComeOut' | 'comeOddsWorkOnComeOut' | 'allowPutBets';

const ODDS_LABEL: Record<OddsChoice, string> = {
  '3-4-5x': '3-4-5x',
  '2x': '2x',
  '5x': '5x',
  '10x': '10x',
  '20x': '20x',
  '100x': '100x',
};

/**
 * Custom table rules (I033): every TableRules field the engine supports, as a form, with a live
 * house-edge summary. Nothing changes until Apply.
 */
export function RulesEditor(p: RulesEditorProps) {
  const [r, setR] = useState<TableRules>(p.initial);
  const id = useId();
  // functional update: several fields can change before the next render
  const set = (patch: Partial<TableRules> | ((prev: TableRules) => Partial<TableRules>)) =>
    setR((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  const odds = oddsChoiceOf(r);
  const summary = rulesSummary(r);
  const check = (key: BoolRule, label: string) => (
    <label class="sim-rules-check">
      <input
        type="checkbox"
        name={key}
        checked={r[key]}
        disabled={p.disabled}
        onChange={(e) => set({ [key]: e.currentTarget.checked })}
      />
      {label}
    </label>
  );
  return (
    <form
      class="sim-rules"
      aria-labelledby={`${id}-h`}
      onSubmit={(e) => {
        e.preventDefault();
        p.onApply(r);
      }}
    >
      <h3 id={`${id}-h`}>Custom table rules</h3>
      <div class="sim-rules-grid">
        <label>
          Game
          <select
            name="variant"
            value={r.variant}
            disabled={p.disabled}
            onChange={(e) => {
              const variant = e.currentTarget.value as TableRules['variant'];
              // odds tables already list every point, so crapless 2/3/11/12 are covered
              set({ variant });
            }}
          >
            <option value="standard">Standard craps</option>
            <option value="crapless">Crapless craps</option>
          </select>
        </label>
        <label>
          Max odds
          <select
            name="odds"
            value={odds ?? ''}
            disabled={p.disabled}
            onChange={(e) => {
              const c = e.currentTarget.value as OddsChoice;
              set(oddsLimits(c));
            }}
          >
            {odds === null ? <option value="">As set by the lesson</option> : null}
            {ODDS_CHOICES.map((c) => (
              <option key={c} value={c}>
                {ODDS_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Field pays on 12
          <select
            name="field12"
            value={String(r.fieldPays[12])}
            disabled={p.disabled}
            onChange={(e) => {
              const v = Number(e.currentTarget.value);
              set((prev) => ({ fieldPays: { ...prev.fieldPays, 12: v } }));
            }}
          >
            <option value="2">2 to 1</option>
            <option value="3">3 to 1</option>
          </select>
        </label>
        <label>
          Buy/lay vig paid
          <select
            name="vigTiming"
            value={r.vig.timing}
            disabled={p.disabled}
            onChange={(e) => {
              const timing = e.currentTarget.value as TableRules['vig']['timing'];
              set((prev) => ({ vig: { ...prev.vig, timing } }));
            }}
          >
            <option value="on-win">Only on a win</option>
            <option value="upfront">Up front</option>
          </select>
        </label>
        <label>
          Vig rounding
          <select
            name="vigRounding"
            value={r.vig.rounding}
            disabled={p.disabled}
            onChange={(e) => {
              const rounding = e.currentTarget.value as TableRules['vig']['rounding'];
              set((prev) => ({ vig: { ...prev.vig, rounding } }));
            }}
          >
            <option value="floor-dollar-min-1">Whole $, $1 min</option>
            <option value="exact-cents">Exact 5%</option>
          </select>
        </label>
        <label>
          Payouts
          <select
            name="payoutUnit"
            value={String(r.payoutUnit)}
            disabled={p.disabled}
            onChange={(e) => set({ payoutUnit: Number(e.currentTarget.value) })}
          >
            {PAYOUT_UNIT_CHOICES.map((u) => (
              <option key={u.value} value={String(u.value)}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Table minimum
          <select
            name="tableMin"
            value={String(r.tableMin)}
            disabled={p.disabled}
            onChange={(e) => set({ tableMin: Number(e.currentTarget.value) })}
          >
            {withCurrent(TABLE_MIN_CHOICES, r.tableMin).map((c) => (
              <option key={c} value={String(c)}>
                {fmtMoney(c)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Table maximum
          <select
            name="tableMax"
            value={String(r.tableMax)}
            disabled={p.disabled}
            onChange={(e) => set({ tableMax: Number(e.currentTarget.value) })}
          >
            {withCurrent(TABLE_MAX_CHOICES, r.tableMax).map((c) => (
              <option key={c} value={String(c)}>
                {fmtMoney(c)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset class="sim-rules-checks">
        <legend>On the come-out roll</legend>
        {check('placeBetsWorkOnComeOut', 'Place and buy bets work')}
        {check('hardwaysWorkOnComeOut', 'Hardways work')}
        {check('comeOddsWorkOnComeOut', 'Come odds work')}
      </fieldset>
      {check('allowPutBets', 'Allow put bets (Pass or Come after the point is set)')}
      <div class="sim-rules-summary" aria-live="polite" data-testid="rules-summary">
        {summary.map((s, i) => (
          <span key={s.label}>
            {i ? ' · ' : ''}
            {s.label}: <b>{fmtEdgePct(s.edge)}</b>
          </span>
        ))}
      </div>
      <p class="sim-rules-note">
        The come-out switches change when bets work, not their edge per bet resolved.
      </p>
      <div class="sim-rules-actions">
        <button type="button" onClick={p.onCancel}>
          Cancel
        </button>
        <button type="submit" class="sim-primary" disabled={p.disabled}>
          {p.applyLabel ?? 'Apply'}
        </button>
      </div>
    </form>
  );
}

/** The fixed choices plus the current value if a scene set something else, sorted. */
function withCurrent(choices: readonly number[], current: number): number[] {
  return [...new Set([...choices, current])].sort((a, b) => a - b);
}
