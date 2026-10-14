import type { PointNumber } from '../../engine/types';
import { numberBox, puckForBox } from './shared';
import type { Rect, RegionDef, TableLayout } from './types';

const BW = 280;
const BH = 250;
const cols = [20, 310, 600];
const boxes: [PointNumber, Rect][] = [
  [4, { x: cols[0]!, y: 20, w: BW, h: BH }],
  [5, { x: cols[1]!, y: 20, w: BW, h: BH }],
  [6, { x: cols[2]!, y: 20, w: BW, h: BH }],
  [8, { x: cols[0]!, y: 280, w: BW, h: BH }],
  [9, { x: cols[1]!, y: 280, w: BW, h: BH }],
  [10, { x: cols[2]!, y: 280, w: BW, h: BH }],
];

const comeRect: Rect = { x: 20, y: 545, w: 860, h: 125 };
const fieldRect: Rect = { x: 20, y: 685, w: 860, h: 150 };
const dcRect: Rect = { x: 20, y: 850, w: 420, h: 115 };
const big6Rect: Rect = { x: 455, y: 850, w: 205, h: 115 };
const big8Rect: Rect = { x: 675, y: 850, w: 205, h: 115 };
const dpRect: Rect = { x: 20, y: 980, w: 860, h: 110 };
const passRect: Rect = { x: 20, y: 1105, w: 860, h: 135 };

const regions: RegionDef[] = [
  ...boxes.map(([n, r]) => numberBox(n, r)),
  {
    id: 'come',
    rect: comeRect,
    label: 'Come',
    sublabel: 'Pays 1 to 1',
    betTypes: ['come'],
    chipSpots: { main: { x: comeRect.x + 560, y: comeRect.y + 62 } },
  },
  {
    id: 'field',
    rect: fieldRect,
    label: 'Field',
    sublabel: 'One roll. 2 and 12 pay double',
    betTypes: ['field'],
    chipSpots: { main: { x: fieldRect.x + 620, y: fieldRect.y + 100 } },
  },
  {
    id: 'dont-come',
    rect: dcRect,
    label: "Don't Come",
    sublabel: 'Bar 12. Pays 1 to 1',
    betTypes: ['dont-come'],
    chipSpots: { main: { x: dcRect.x + 385, y: dcRect.y + 50 } },
  },
  {
    id: 'big-6',
    rect: big6Rect,
    label: 'Big 6',
    sublabel: 'Pays 1 to 1',
    betTypes: ['big-6'],
    chipSpots: { main: { x: big6Rect.x + big6Rect.w * 0.68, y: big6Rect.y + big6Rect.h * 0.45 } },
  },
  {
    id: 'big-8',
    rect: big8Rect,
    label: 'Big 8',
    sublabel: 'Pays 1 to 1',
    betTypes: ['big-8'],
    chipSpots: { main: { x: big8Rect.x + big8Rect.w * 0.68, y: big8Rect.y + big8Rect.h * 0.45 } },
  },
  {
    id: 'dont-pass',
    rect: dpRect,
    label: "Don't Pass Bar",
    sublabel: 'Bar 12. Pays 1 to 1',
    betTypes: ['dont-pass', 'dont-pass-odds'],
    chipSpots: {
      main: { x: dpRect.x + 150, y: dpRect.y + 56 },
      odds: { x: dpRect.x + 215, y: dpRect.y + 40 },
    },
  },
  {
    id: 'pass',
    rect: passRect,
    label: 'Pass Line',
    sublabel: 'Pays 1 to 1',
    betTypes: ['pass-line', 'pass-odds'],
    shape: 'pass-arc',
    chipSpots: {
      main: { x: passRect.x + 150, y: passRect.y + 62 },
      odds: { x: passRect.x + 215, y: passRect.y + 44 },
    },
  },
];

const puck = {} as TableLayout['puck'];
for (const [n, r] of boxes) puck[n] = puckForBox(r, 50);
puck.off = { x: comeRect.x + 58, y: comeRect.y + 62 };

export const portraitLayout: TableLayout = {
  id: 'portrait',
  viewBox: { w: 900, h: 1255 },
  regions,
  puck,
  puckRadius: 42,
  chipRadius: 34,
  minTapUnits: 102,
};
