import type { Cents, PointNumber, RollRecord } from '../engine/types';
import { Dice } from './Dice';
import { HistoryStrip } from './HistoryStrip';
import { fmtMoney } from './text';
import './sim.css';

export interface StatusBarProps {
  bankroll: Cents;
  onTable: Cents;
  /** equity minus starting bankroll */
  session: Cents;
  point: PointNumber | null;
  history: readonly RollRecord[];
  onOpenHistory?: () => void;
  /** hide the roll history strip (compact landscape rail) */
  compact?: boolean;
}

export function StatusBar({
  bankroll,
  onTable,
  session,
  point,
  history,
  onOpenHistory,
  compact,
}: StatusBarProps) {
  const last = history.length ? history[history.length - 1]! : null;
  const sign = session > 0 ? 'up' : session < 0 ? 'down' : 'even';
  return (
    <div class={`sim-status${compact ? ' is-compact' : ''}`}>
      <div class="sim-status-money">
        <span>
          Bankroll <b>{fmtMoney(bankroll)}</b>
        </span>
        <span>
          On table <b>{fmtMoney(onTable)}</b>
        </span>
        <span class={`sim-session sim-session-${sign}`}>
          Session <b>{fmtMoney(session, { sign: true })}</b>
          <span class="sim-sr">
            {' '}
            ({sign === 'even' ? 'even' : sign === 'up' ? 'ahead' : 'behind'})
          </span>
        </span>
      </div>
      <div class="sim-status-row">
        <span class={`sim-point${point ? ' has-point' : ''}`}>
          {point ? `Point: ${point}` : 'Come-out roll'}
        </span>
        <span class="sim-last" aria-live="polite">
          {last ? <Dice dice={last.dice} size="sm" /> : null}
        </span>
        {compact ? null : <HistoryStrip history={history} onOpenAll={onOpenHistory} />}
      </div>
    </div>
  );
}
