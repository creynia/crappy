import { DIE_FACES } from '../math/dice';
import { countEffects, type RollEffect } from '../math/outcomes';
import './sim.css';

const SYMBOL: Record<RollEffect, string> = {
  win: 'W',
  lose: 'L',
  push: 'P',
  none: '·',
  travel: '→',
};
const WORD: Record<RollEffect, string> = {
  win: 'wins',
  lose: 'loses',
  push: 'pushes',
  none: 'no change',
  travel: 'moves or sets a point',
};
const LEGEND: Record<RollEffect, string> = {
  win: 'Win',
  lose: 'Lose',
  push: 'Push',
  none: 'No decision',
  travel: 'Point set / moves',
};
const ORDER: RollEffect[] = ['win', 'lose', 'push', 'travel', 'none'];

/** "Wins on 4 of 36, loses on 6 of 36, 26 rolls change nothing" */
export function gridCaption(grid: readonly RollEffect[]): string {
  const c = countEffects(grid);
  const parts: string[] = [];
  if (c.win > 0) parts.push(`wins on ${c.win} of 36`);
  if (c.lose > 0) parts.push(`loses on ${c.lose} of 36`);
  if (c.push > 0) parts.push(`pushes on ${c.push} of 36`);
  if (c.travel > 0) parts.push(`sets or moves to a point on ${c.travel} of 36`);
  if (c.none === 36) return 'No roll changes this bet right now.';
  if (c.none > 0) parts.push(`${c.none} ${c.none === 1 ? 'roll changes' : 'rolls change'} nothing`);
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface DiceGridProps {
  grid: readonly RollEffect[];
  /** extra line shown under the caption, e.g. why the bet is off */
  note?: string;
}

/** 6x6 grid of dice pairs (rows = first die, columns = second) coloured and lettered by effect. */
export function DiceGrid({ grid, note }: DiceGridProps) {
  if (grid.length !== 36) return null;
  const counts = countEffects(grid);
  const caption = gridCaption(grid);
  return (
    <figure class="sim-dicegrid">
      <table aria-label={`The 36 dice combinations. ${caption}`}>
        <thead>
          <tr>
            <td aria-hidden="true" class="sim-dg-corner">
              1st die ↓<br />
              2nd die →
            </td>
            {DIE_FACES.map((b) => (
              <th key={b} scope="col" aria-label={`second die ${b}`}>
                {b}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DIE_FACES.map((a, r) => (
            <tr key={a}>
              <th scope="row" aria-label={`first die ${a}`}>
                {a}
              </th>
              {DIE_FACES.map((b, c) => {
                const e = grid[r * 6 + c] as RollEffect;
                return (
                  <td
                    key={b}
                    class={`sim-dg-cell is-${e}`}
                    aria-label={`${a} and ${b}, total ${a + b}: ${WORD[e]}`}
                    data-effect={e}
                  >
                    <span aria-hidden="true">{SYMBOL[e]}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <ul class="sim-dg-legend" aria-label="Legend">
        {ORDER.filter((e) => counts[e] > 0).map((e) => (
          <li key={e}>
            <span class={`sim-dg-key is-${e}`} aria-hidden="true">
              {SYMBOL[e]}
            </span>{' '}
            {LEGEND[e]} ({counts[e]})
          </li>
        ))}
      </ul>
      <figcaption class="sim-dg-caption">{caption}</figcaption>
      {note ? <p class="sim-note">{note}</p> : null}
    </figure>
  );
}
