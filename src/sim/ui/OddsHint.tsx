import { fmtMoney } from './text';
import type { OddsRoom } from './oddsHint';
import './sim.css';

/** The one-line nudge, also sent to the shared live announcer. */
export function oddsHintText(room: OddsRoom): string {
  const amount = fmtMoney(room.room);
  const lay = room.type === 'dont-pass' || room.type === 'dont-come';
  return lay
    ? `Lay up to ${amount} against your ${room.label} on ${room.point}. Lay odds have no house edge.`
    : `Add up to ${amount} odds behind your ${room.label} on ${room.point}. Odds have no house edge.`;
}

export interface OddsHintProps {
  room: OddsRoom;
  onDismiss: () => void;
  onHideForever: () => void;
}

/** One-time nudge after a point is set. Plain text (not a live region): the Simulator announces it. */
export function OddsHint({ room, onDismiss, onHideForever }: OddsHintProps) {
  return (
    <div class="sim-odds-hint" data-testid="odds-hint">
      <p>{oddsHintText(room)}</p>
      <div class="sim-odds-hint-actions">
        <button type="button" onClick={onDismiss}>
          Got it
        </button>
        <button type="button" onClick={onHideForever}>
          Don't show again
        </button>
      </div>
    </div>
  );
}
