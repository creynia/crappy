import type { RollRecord } from '../engine/types';
import { DieIcon } from './Dice';
import './sim.css';

export type RollOutcome = 'seven-out' | 'point-made' | 'natural' | 'craps' | 'none';

export function rollOutcome(r: RollRecord): RollOutcome {
  if (r.phaseBefore === 'point') {
    if (r.total === 7) return 'seven-out';
    if (r.total === r.pointBefore) return 'point-made';
    return 'none';
  }
  if (r.total === 7 || r.total === 11) return 'natural';
  if (r.total === 2 || r.total === 3 || r.total === 12) return 'craps';
  return 'none';
}
const OUTCOME_TEXT: Record<RollOutcome, string> = {
  'seven-out': 'seven out',
  'point-made': 'point made',
  natural: 'natural',
  craps: 'craps',
  none: '',
};
const GLYPH: Record<RollOutcome, string> = {
  'seven-out': '×',
  'point-made': '✓',
  natural: '',
  craps: '',
  none: '',
};

export interface HistoryStripProps {
  /** chronological (oldest first), as in GameState.history */
  history: readonly RollRecord[];
  limit?: number;
  onOpenAll?: () => void;
}

/** Last N rolls as pills, newest first, horizontally scrollable. */
export function HistoryStrip({ history, limit = 20, onOpenAll }: HistoryStripProps) {
  const recent = history.slice(-limit).reverse();
  return (
    <div
      class="sim-history"
      {...(recent.length ? { role: 'list', 'aria-label': 'Roll history, newest first' } : {})}
      onClick={onOpenAll}
    >
      {recent.length === 0 ? <span class="sim-history-empty">No rolls yet</span> : null}
      {recent.map((r) => {
        const o = rollOutcome(r);
        const text = `${r.dice[0]} and ${r.dice[1]}, total ${r.total}${OUTCOME_TEXT[o] ? ', ' + OUTCOME_TEXT[o] : ''}`;
        return (
          <span
            key={r.n}
            role="listitem"
            class={`sim-pill sim-pill-${o}`}
            aria-label={text}
            title={text}
          >
            <DieIcon value={r.dice[0]} size={16} />
            <DieIcon value={r.dice[1]} size={16} />
            <b>{r.total}</b>
            {GLYPH[o] ? <i aria-hidden="true">{GLYPH[o]}</i> : null}
          </span>
        );
      })}
    </div>
  );
}
