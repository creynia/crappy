import type { PointNumber } from '../../engine/types';
import { landscapeLayout } from './landscape';
import { portraitLayout } from './portrait';
import { NOT_OFFERED, numberBox, puckForBox } from './shared';
import type { Rect, TableLayout } from './types';

/** Crapless box order: 2 3 | 4 5 6 8 9 10 | 11 12. */
const ORDER: PointNumber[] = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

/** A standard layout with its number boxes swapped for ten crapless boxes (rest of the felt unchanged). */
function withBoxes(base: TableLayout, boxes: [PointNumber, Rect][], inset: number): TableLayout {
  const puck = { off: base.puck.off } as TableLayout['puck'];
  for (const [n, r] of boxes) puck[n] = puckForBox(r, inset);
  // no don't side on a crapless table: the regions stay (greyed) but say so
  const rest = base.regions
    .filter((r) => !r.id.startsWith('box-'))
    .map((r) =>
      r.id === 'dont-pass' || r.id === 'dont-come' ? { ...r, sublabel: NOT_OFFERED } : r,
    );
  // narrow boxes: keep the place/buy chips clear of the "PAYS ..." line
  const numbered = boxes.map(([n, rect]) => {
    const b = numberBox(n, rect);
    const y = rect.y + rect.h * 0.88;
    const { main, buy } = b.chipSpots;
    return {
      ...b,
      chipSpots: {
        ...b.chipSpots,
        ...(main ? { main: { x: main.x, y } } : {}),
        ...(buy ? { buy: { x: buy.x, y } } : {}),
      },
    };
  });
  return { ...base, regions: [...numbered, ...rest], puck };
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

export const craplessPortraitLayout = withBoxes(portraitLayout, portraitBoxes, 34);
export const craplessLandscapeLayout = withBoxes(landscapeLayout, landscapeBoxes, 30);
