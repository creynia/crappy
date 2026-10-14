import { useEffect, useId, useRef, useState } from 'preact/hooks';
import type { Action, BetTypeId, Cents } from '../engine/types';
import type { ActionPreview } from '../math/types';
import { fmtMoney, fmtPct, fracToNumber, normalizeTier, TIER_LABEL, type EvFacts } from './text';
import './sim.css';

export type SheetPreview = ActionPreview;

export interface TypeOption {
  id: BetTypeId;
  label: string;
  enabled: boolean;
  reason?: string;
}
export interface QuickAction {
  id: 'min' | 'double' | 'max-odds' | 'fix-units';
  label: string;
  amount: Cents;
}

export interface BetSheetProps {
  title: string;
  mode?: 'new' | 'manage';
  /** bottom sheet (portrait) or right-side panel (landscape) */
  placement?: 'sheet' | 'panel';
  preview: SheetPreview;
  /** numbers for the curriculum section 6.1 lines; omit to show only the headline */
  facts?: EvFacts | null;
  /** false hides EV block, alternative and Why? (some lessons) */
  showEV?: boolean;
  forceWhyOpen?: boolean;
  typeOptions: readonly TypeOption[];
  selectedType: BetTypeId;
  amount: Cents;
  /** selected chip value: one step of the +/- stepper */
  step: Cents;
  quickActions?: readonly QuickAction[];
  working?: { value: boolean; canToggle: boolean };
  /** sandbox setting "Confirm sucker bets" (default true): avoid-tier needs a second tap */
  confirmSucker?: boolean;
  onTypeChange: (t: BetTypeId) => void;
  onAmountChange: (a: Cents) => void;
  onUseAlternative?: (a: Action) => void;
  onToggleWorking?: (on: boolean) => void;
  /** Preview of removing this bet; an 'avoid' tier (gives up EV) needs the same second tap as Confirm. */
  removePreview?: SheetPreview;
  onRemove?: () => void;
  /** Flat line/come bet that cannot come down: neutral badge, disabled Remove with a reason, optional Add odds. */
  contract?: { reason: string; onAddOdds?: () => void };
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

function ways(n: number, d: number) {
  return `${n} of ${d} ways`;
}

export function BetSheet(p: BetSheetProps) {
  const {
    preview,
    facts,
    showEV = true,
    mode = 'new',
    placement = 'sheet',
    confirmSucker = true,
    amount,
    step,
  } = p;
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [whyOpen, setWhyOpen] = useState(!!p.forceWhyOpen);
  const [armed, setArmed] = useState(false);
  const contract = mode === 'manage' ? p.contract : undefined;
  const tier = contract ? ('free' as const) : normalizeTier(preview.tier);
  const valid = preview.validation.ok;
  const needsSecondTap = tier === 'avoid' && confirmSucker && valid;
  const removeNeedsSecondTap =
    !!p.removePreview && normalizeTier(p.removePreview.tier) === 'avoid' && confirmSucker;
  const [removeArmed, setRemoveArmed] = useState(false);
  const sig = `${p.selectedType}|${amount}|${preview.action.type}`;

  useEffect(() => {
    setArmed(false);
    setRemoveArmed(false);
  }, [sig]);
  useEffect(() => {
    if (p.forceWhyOpen) setWhyOpen(true);
  }, [p.forceWhyOpen]);

  // focus trap + return focus
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const root = rootRef.current;
    root?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    return () => prev?.focus?.();
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      p.onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = [...(rootRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (!nodes.length) return;
    const first = nodes[0]!;
    const last = nodes[nodes.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !rootRef.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const confirm = () => {
    if (!valid) return;
    if (needsSecondTap && !armed) {
      setArmed(true);
      return;
    }
    p.onConfirm();
  };

  const edgePct = preview.edge ? fracToNumber(preview.edge.perResolved) : null;
  const confirmLabel = needsSecondTap
    ? armed
      ? 'Tap again to place anyway'
      : 'Place anyway'
    : mode === 'manage'
      ? 'Update'
      : 'Confirm';

  return (
    <div
      class={`sim-sheet-backdrop sim-sheet-${placement}`}
      onClick={(e) => e.target === e.currentTarget && p.onCancel()}
    >
      <div
        ref={rootRef}
        class={`sim-sheet tier-${contract ? 'neutral' : tier}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKey}
      >
        <h2 id={titleId} class="sim-sheet-title">
          {p.title}
        </h2>

        {p.typeOptions.length > 1 ? (
          <div class="sim-seg" role="radiogroup" aria-label="Bet type">
            {p.typeOptions.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.id === p.selectedType}
                disabled={!t.enabled}
                title={t.reason}
                class={t.id === p.selectedType ? 'is-selected' : ''}
                onClick={() => p.onTypeChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}

        <div class="sim-stepper">
          <button
            type="button"
            aria-label="Decrease amount"
            onClick={() => p.onAmountChange(Math.max(0, amount - step))}
            disabled={amount - step <= 0}
          >
            −
          </button>
          <output aria-live="polite" aria-label="Bet amount">
            {fmtMoney(amount)}
          </output>
          <button
            type="button"
            aria-label="Increase amount"
            onClick={() => p.onAmountChange(amount + step)}
          >
            +
          </button>
        </div>
        {p.quickActions?.length ? (
          <div class="sim-quick">
            {p.quickActions.map((q) => (
              <button key={q.id} type="button" onClick={() => p.onAmountChange(q.amount)}>
                {q.label}
              </button>
            ))}
          </div>
        ) : null}

        {p.working ? (
          <label class="sim-working">
            <input
              type="checkbox"
              checked={p.working.value}
              disabled={!p.working.canToggle}
              onChange={(e) => p.onToggleWorking?.(e.currentTarget.checked)}
            />
            Working: {p.working.value ? 'ON' : 'OFF'}
          </label>
        ) : null}

        {!valid ? (
          <p class="sim-invalid" role="alert">
            {preview.validation.ok ? '' : preview.validation.message}
          </p>
        ) : preview.validation.warnings.length ? (
          <ul class="sim-warnings">
            {preview.validation.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        ) : null}

        {showEV ? (
          <section class="sim-ev" aria-label="Expected value">
            <div class="sim-ev-head">
              <span
                class={`sim-badge sim-badge-${contract ? 'neutral' : tier}`}
                data-tier={contract ? 'contract' : tier}
              >
                {contract ? 'Contract bet' : TIER_LABEL[tier]}
              </span>
              <span class="sim-headline">
                {contract ? 'It stays up until it wins or loses.' : preview.headline}
              </span>
            </div>
            {tier === 'avoid' ? (
              <p class="sim-banner" role="note">
                {edgePct !== null
                  ? `Sucker bet: the house keeps ${fmtPct(edgePct)} on average.`
                  : 'Sucker bet: this gives up expected value.'}
              </p>
            ) : null}
            {facts ? <EvLines facts={facts} /> : <p class="sim-detail">{preview.detail}</p>}
            {preview.alternative ? (
              <div class="sim-alt">
                <p>{preview.alternative.message}</p>
                <button
                  type="button"
                  onClick={() => p.onUseAlternative?.(preview.alternative!.action)}
                >
                  Use this
                </button>
              </div>
            ) : null}
            <button
              type="button"
              class="sim-why-btn"
              aria-expanded={whyOpen}
              onClick={() => setWhyOpen(!whyOpen)}
            >
              Why?
            </button>
            {whyOpen ? (
              <div class="sim-why">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Outcome</th>
                      <th scope="col">Chance</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.explanation.rows.map((r, i) => (
                      <tr key={i}>
                        <td>{r.label}</td>
                        <td>
                          {ways(r.ways, r.outOf)} ({fmtPct(fracToNumber(r.probability), 1)})
                        </td>
                        <td>{fmtMoney(fracToNumber(r.net), { sign: true, exact: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p class="sim-formula">{preview.explanation.evFormula}</p>
                {preview.explanation.note ? (
                  <p class="sim-note">{preview.explanation.note}</p>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {mode === 'manage' && p.removePreview && !contract ? (
          <p class="sim-detail sim-remove-note">{p.removePreview.headline}</p>
        ) : null}
        {contract ? <p class="sim-detail sim-remove-note">{contract.reason}</p> : null}
        <div class="sim-footer">
          {removeNeedsSecondTap && removeArmed ? (
            <p class="sim-banner" role="alert">
              Removing this gives up expected value. Tap Remove again to confirm.
            </p>
          ) : null}
          {needsSecondTap && armed ? (
            <p class="sim-banner" role="alert">
              This is a sucker bet. Tap Place anyway again to confirm.
            </p>
          ) : null}

          <div class="sim-actions">
            {contract?.onAddOdds ? (
              <button type="button" class="sim-btn-addodds" onClick={contract.onAddOdds}>
                Add odds
              </button>
            ) : null}
            {mode === 'manage' && p.onRemove ? (
              <button
                type="button"
                class={`sim-btn-remove${removeNeedsSecondTap ? ' is-danger' : ''}`}
                disabled={!!contract}
                onClick={() => {
                  if (removeNeedsSecondTap && !removeArmed) {
                    setRemoveArmed(true);
                    return;
                  }
                  p.onRemove?.();
                }}
              >
                {removeNeedsSecondTap
                  ? removeArmed
                    ? 'Tap again to remove'
                    : 'Remove anyway'
                  : 'Remove'}
              </button>
            ) : null}
            <button type="button" class="sim-btn-cancel" onClick={p.onCancel}>
              Cancel
            </button>
            <button
              type="button"
              data-autofocus
              class={`sim-btn-confirm${needsSecondTap ? ' is-danger' : ''}`}
              disabled={!valid}
              onClick={confirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Curriculum section 6.1: house edge, expected loss on this bet, per hour, chance + payout, combined edge. */
export function EvLines({ facts: f }: { facts: EvFacts }) {
  const free = f.edge !== null && f.edge <= 0;
  const cents = f.edge === null ? null : (f.edge * 100).toFixed(2);
  const loss = f.expectedLossCents;
  return (
    <ul class="sim-ev-lines">
      <li data-line="edge">
        {f.edge === null ? (
          'House edge: not applicable.'
        ) : free ? (
          <>
            House edge <b>0.00%</b>: the house has no edge on this bet.
          </>
        ) : (
          <>
            House edge <b>{fmtPct(f.edge)}</b>: on average you lose {cents}¢ of every $1 you bet
            here.
          </>
        )}
      </li>
      <li data-line="loss">
        Expected loss on this {fmtMoney(f.amount)} bet:{' '}
        {free ? (
          <b>$0.00: a free bet</b>
        ) : loss > 0 && loss < 1 ? (
          <b>less than 1¢</b>
        ) : (
          <b>{fmtMoney(loss, { exact: true })}</b>
        )}
        .
      </li>
      {f.perHourCents !== null ? (
        <li data-line="hour" class={f.oneRoll ? 'is-strong' : ''}>
          If you keep this bet up for an hour (~{f.rollsPerHour} rolls): about{' '}
          {f.oneRoll ? (
            <strong>{fmtMoney(f.perHourCents, { exact: true })}</strong>
          ) : (
            <b>{fmtMoney(f.perHourCents, { exact: true })}</b>
          )}
          .
          {f.oneRoll ? (
            <span class="sim-oneroll"> One-roll bet: its edge is paid on every roll.</span>
          ) : null}
        </li>
      ) : null}
      {f.chance || f.pays ? (
        <li data-line="chance">
          {f.chance ? (
            <>
              Wins <b>{f.chance}</b>
            </>
          ) : null}
          {f.chance && f.pays ? ' · ' : null}
          {f.pays ? (
            <>
              pays <b>{f.pays}</b>
            </>
          ) : null}
          .
        </li>
      ) : null}
      {f.combined ? (
        <li data-line="combined">
          {f.combined.label} together: <b>{fmtPct(f.combined.edge)}</b> per dollar.
        </li>
      ) : null}
    </ul>
  );
}
