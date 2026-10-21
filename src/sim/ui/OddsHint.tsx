import { useId } from 'preact/hooks';
import { fmtMoney } from './text';
import type { OddsRoom } from './oddsHint';
import './sim.css';

/** The full sentence: the announcer reads it, and the hint carries it as its accessible description. */
export function oddsHintText(room: OddsRoom): string {
  const amount = fmtMoney(room.room);
  const lay = room.type === 'dont-pass' || room.type === 'dont-come';
  return lay
    ? `Lay up to ${amount} against your ${room.label} on ${room.point}. Lay odds have no house edge.`
    : `Add up to ${amount} odds behind your ${room.label} on ${room.point}. Odds have no house edge.`;
}

/** The short line shown in the banner. */
export function hintLine(room: OddsRoom): string {
  const amount = fmtMoney(room.room);
  const lay = room.type === 'dont-pass' || room.type === 'dont-come';
  return lay ? `Lay ${amount} odds: 0% edge` : `Add ${amount} odds: 0% edge`;
}

export interface OddsHintProps {
  room: OddsRoom;
  onDismiss: () => void;
  onHideForever: () => void;
}

/** One-time nudge after a point is set: one row, text plus two 44px icon buttons. Not a live region. */
export function OddsHint({ room, onDismiss, onHideForever }: OddsHintProps) {
  const descId = useId();
  return (
    <div class="sim-odds-hint" data-testid="odds-hint" aria-describedby={descId}>
      <span id={descId} class="sim-sr">
        {oddsHintText(room)}
      </span>
      <p>{hintLine(room)}</p>
      <div class="sim-odds-hint-actions">
        <button
          type="button"
          class="sim-odds-hint-btn"
          aria-label="Got it"
          title="Got it"
          onClick={onDismiss}
        >
          ✓
        </button>
        <button
          type="button"
          class="sim-odds-hint-btn"
          aria-label="Don't show again"
          title="Don't show again"
          onClick={onHideForever}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
