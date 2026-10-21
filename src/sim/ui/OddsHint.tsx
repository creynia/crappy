import { fmtMoney } from './text';
import type { OddsRoom } from './oddsHint';
import './sim.css';

export interface OddsHintProps {
  room: OddsRoom;
  onDismiss: () => void;
  onHideForever: () => void;
}

/** One-time nudge: odds on a flat line/come bet carry no house edge. Dismiss or "Don't show again". */
export function OddsHint({ room, onDismiss, onHideForever }: OddsHintProps) {
  return (
    <div class="sim-odds-hint" role="status" data-testid="odds-hint">
      <p>
        Odds are available: add up to <b>{fmtMoney(room.room)}</b> behind your {room.label} on{' '}
        {room.point}. Odds have no house edge.
      </p>
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
