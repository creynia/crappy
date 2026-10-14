import type { Cents } from '../engine/types';
import { ChipFace } from './ChipStack';
import { fmtMoney } from './text';
import './sim.css';

export interface ChipRackProps {
  denominations: readonly Cents[];
  selected: Cents;
  /** chips above this amount are disabled */
  bankroll: Cents;
  onSelect: (chip: Cents) => void;
  orientation?: 'row' | 'column';
}

export function ChipRack({
  denominations,
  selected,
  bankroll,
  onSelect,
  orientation = 'row',
}: ChipRackProps) {
  return (
    <div class={`sim-rack sim-rack-${orientation}`} role="radiogroup" aria-label="Chip value">
      {denominations.map((d) => {
        const disabled = d > bankroll;
        const on = d === selected;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${fmtMoney(d)} chip${disabled ? ', not enough bankroll' : ''}`}
            disabled={disabled}
            class={`sim-chipbtn${on ? ' is-selected' : ''}`}
            onClick={() => onSelect(d)}
          >
            <svg viewBox="-50 -52 100 108" aria-hidden="true">
              <ellipse cx="0" cy="6" rx="46" ry="46" fill="rgba(0,0,0,0.35)" />
              <ChipFace denom={d} r={44} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
