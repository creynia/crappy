import { HOP_PAYS, isHardHop, normalizeHop, sameHop } from '../engine/bets';
import { DEFAULT_RULES } from '../engine/rules';
import type { Dice, Die } from '../engine/types';
import { betEdge } from '../math/ev';
import { fmtPct, fracToNumber } from './text';
import './hop.css';

const FACES: readonly Die[] = [1, 2, 3, 4, 5, 6];

export interface HopPickerProps {
  value: Dice;
  onChange: (d: Dice) => void;
  disabled?: boolean;
}

/**
 * The 21 hop pairs as the upper triangle of a 6 x 6 grid (row = low die, column = high die):
 * the diagonal holds the six hard hops (30 to 1), the rest are easy hops (15 to 1, either way round).
 */
export function HopPicker({ value, onChange, disabled }: HopPickerProps) {
  const v = normalizeHop(value);
  // exact house edge of this pair (easy 1/9 = 11.11%, hard 5/36 = 13.89%)
  const edge = fmtPct(
    fracToNumber(
      betEdge('hop', 100, { phase: 'come-out', point: null, rules: DEFAULT_RULES }, v).perResolved,
    ),
  );
  return (
    <div class="sim-hop" role="group" aria-label="Dice pair">
      <div class="sim-hop-grid">
        {FACES.map((a) =>
          FACES.map((b) => {
            if (b < a) return <span key={`${a}${b}`} class="sim-hop-gap" aria-hidden="true" />;
            const d: Dice = [a, b];
            const hard = isHardHop(d);
            const on = sameHop(d, v);
            const pays = hard ? HOP_PAYS.hard : HOP_PAYS.easy;
            return (
              <button
                key={`${a}${b}`}
                type="button"
                class={`sim-hop-cell${hard ? ' is-hard' : ''}${on ? ' is-selected' : ''}`}
                aria-pressed={on}
                aria-label={`${a}-${b}, ${hard ? 'hard hop' : 'easy hop'}, pays ${pays} to 1`}
                data-hop={`${a}-${b}`}
                disabled={disabled}
                onClick={() => onChange(d)}
              >
                <span class="sim-hop-pair">
                  {a}-{b}
                </span>
                <span class="sim-hop-pays">{pays}:1</span>
              </button>
            );
          }),
        )}
      </div>
      <p class="sim-hop-note">
        {isHardHop(v)
          ? `Hard hop ${v[0]}-${v[1]}: wins on 1 of 36 rolls, pays ${HOP_PAYS.hard} to 1 · edge ${edge}.`
          : `Easy hop ${v[0]}-${v[1]}: wins on ${v[0]}-${v[1]} or ${v[1]}-${v[0]}, 2 of 36 rolls, pays ${HOP_PAYS.easy} to 1 · edge ${edge}.`}
      </p>
    </div>
  );
}
