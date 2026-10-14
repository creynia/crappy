import type { PointNumber } from '../../engine/types';
import { centerOf, numberBox, puckForBox } from './shared';
import type { Rect, RegionDef, TableLayout } from './types';

const order: PointNumber[] = [4, 5, 6, 8, 9, 10];
const xs = [220, 430, 640, 850, 1060, 1270];
const boxes: [PointNumber, Rect][] = order.map((n, i) => [n, { x: xs[i]!, y: 20, w: 205, h: 230 }]);

const dcRect: Rect = { x: 20, y: 20, w: 190, h: 230 };
const big6Rect: Rect = { x: 20, y: 260, w: 190, h: 140 };
const big8Rect: Rect = { x: 20, y: 410, w: 190, h: 140 };
const comeRect: Rect = { x: 220, y: 260, w: 1255, h: 140 };
const fieldRect: Rect = { x: 220, y: 410, w: 1255, h: 140 };
const dpRect: Rect = { x: 20, y: 560, w: 1455, h: 105 };
const passRect: Rect = { x: 20, y: 675, w: 1455, h: 110 };

const regions: RegionDef[] = [
  {
    id: 'dont-come',
    rect: dcRect,
    label: "Don't Come",
    sublabel: 'Bar 12. Pays 1 to 1',
    betTypes: ['dont-come'],
    chipSpots: { main: centerOf(dcRect) },
  },
  ...boxes.map(([n, r]) => numberBox(n, r)),
  {
    id: 'big-6',
    rect: big6Rect,
    label: 'Big 6',
    sublabel: 'Pays 1 to 1',
    betTypes: ['big-6'],
    chipSpots: { main: centerOf(big6Rect) },
  },
  {
    id: 'big-8',
    rect: big8Rect,
    label: 'Big 8',
    sublabel: 'Pays 1 to 1',
    betTypes: ['big-8'],
    chipSpots: { main: centerOf(big8Rect) },
  },
  {
    id: 'come',
    rect: comeRect,
    label: 'Come',
    sublabel: 'Pays 1 to 1',
    betTypes: ['come'],
    chipSpots: { main: { x: comeRect.x + 760, y: comeRect.y + 70 } },
  },
  {
    id: 'field',
    rect: fieldRect,
    label: 'Field',
    sublabel: 'One roll. 2 and 12 pay double',
    betTypes: ['field'],
    chipSpots: { main: { x: fieldRect.x + 760, y: fieldRect.y + 100 } },
  },
  {
    id: 'dont-pass',
    rect: dpRect,
    label: "Don't Pass Bar",
    sublabel: 'Bar 12. Pays 1 to 1',
    betTypes: ['dont-pass', 'dont-pass-odds'],
    chipSpots: { main: { x: dpRect.x + 420, y: dpRect.y + 54 }, odds: { x: dpRect.x + 490, y: dpRect.y + 38 } },
  },
  {
    id: 'pass',
    rect: passRect,
    label: 'Pass Line',
    sublabel: 'Pays 1 to 1',
    betTypes: ['pass-line', 'pass-odds'],
    shape: 'pass-arc',
    chipSpots: { main: { x: passRect.x + 420, y: passRect.y + 58 }, odds: { x: passRect.x + 490, y: passRect.y + 40 } },
  },
];

const puck = {} as TableLayout['puck'];
for (const [n, r] of boxes) puck[n] = puckForBox(r, 42);
puck.off = { x: comeRect.x + 56, y: comeRect.y + 70 };

export const landscapeLayout: TableLayout = {
  id: 'landscape',
  viewBox: { w: 1500, h: 800 },
  regions,
  puck,
  puckRadius: 34,
  chipRadius: 30,
  minTapUnits: 99,
};
