import type { PointNumber } from '../../engine/types';
import { landscapeLayout } from './landscape';
import { portraitLayout } from './portrait';
import { NOT_OFFERED, numberBox, puckForBox } from './shared';
import type { Rect, RegionDef, TableLayout } from './types';

/** Crapless box order: 2 3 | 4 5 6 8 9 10 | 11 12. */
const ORDER: PointNumber[] = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

/** A standard layout with its number boxes swapped for ten crapless boxes (rest of the felt unchanged). */
function withBoxes(
  base: TableLayout,
  boxes: [PointNumber, Rect][],
  inset: number,
  chipScale: number,
): TableLayout {
  const puck = { off: base.puck.off } as TableLayout['puck'];
  for (const [n, r] of boxes) puck[n] = puckForBox(r, inset);
  // no don't side on a crapless table: the regions stay (greyed) but say so
  const rest = base.regions
    .filter((r) => !r.id.startsWith('box-'))
    .map((r) =>
      r.id === 'dont-pass' || r.id === 'dont-come' ? { ...r, sublabel: NOT_OFFERED } : r,
    );
  // Narrow boxes (smaller chips, see chipScale): come bets and their odds ride a top row clear of the
  // numeral, place/buy (and lay, sharing the buy spot) a bottom row clear of the "PAYS ..." line and the
  // border. There is no don't side here, so the dc-point spot is unused.
  const numbered = boxes.map(([n, rect]): RegionDef => {
    const b = numberBox(n, rect);
    const at = (fx: number, fy: number) => ({ x: rect.x + rect.w * fx, y: rect.y + rect.h * fy });
    return {
      ...b,
      chipSpots: {
        'come-point': at(0.3, 0.14),
        odds: at(0.72, 0.14),
        main: at(0.3, 0.8),
        buy: at(0.7, 0.8),
        lay: at(0.7, 0.8),
      },
    };
  });
  return {
    ...base,
    regions: [...numbered, ...rest],
    puck,
    chipRadius: Math.round(base.chipRadius * chipScale),
  };
}

// Portrait: two rows of five in the space of the standard 2x3 grid (x 20..880, y 20..530).
const PW = 164;
const portraitBoxes = ORDER.map((n, i): [PointNumber, Rect] => [
  n,
  { x: 20 + (i % 5) * (PW + 10), y: i < 5 ? 20 : 280, w: PW, h: 250 },
]);

// Landscape: one row of ten in the space of the standard row of six (x 220..1475).
const LW = 121;
const landscapeBoxes = ORDER.map((n, i): [PointNumber, Rect] => [
  n,
  { x: 220 + i * (LW + 5), y: 20, w: LW, h: 230 },
]);

export const craplessPortraitLayout = withBoxes(portraitLayout, portraitBoxes, 34, 28 / 34);
export const craplessLandscapeLayout = withBoxes(landscapeLayout, landscapeBoxes, 30, 25 / 30);
