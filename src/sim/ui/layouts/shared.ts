import type { BetTypeId, PointNumber } from '../../engine/types';
import type { ChipSpotKey, Point2, Rect, RegionDef, RegionId } from './types';

export const PLACE_PAYS: Record<PointNumber, string> = {
  4: '9 to 5',
  5: '7 to 5',
  6: '7 to 6',
  8: '7 to 6',
  9: '7 to 5',
  10: '9 to 5',
};
export const NUMBER_WORD: Record<PointNumber, string> = {
  4: '4',
  5: 'FIVE',
  6: 'SIX',
  8: '8',
  9: 'NINE',
  10: '10',
};

function boxBetTypes(n: PointNumber): BetTypeId[] {
  const t: BetTypeId[] = [
    `place-${n}`,
    `buy-${n}`,
    `lay-${n}`,
    'come-odds',
    'dont-come-odds',
  ] as BetTypeId[];
  return t;
}

/** A number box with chip spots placed relative to its rect (see simulator.md section 3.2). */
export function numberBox(n: PointNumber, rect: Rect): RegionDef {
  const { x, y, w, h } = rect;
  const k = w / 280; // horizontal scale relative to the portrait box
  const spots: Partial<Record<ChipSpotKey, { x: number; y: number }>> = {
    'dc-point': { x: x + 62 * k, y: y + h * 0.14 },
    lay: { x: x + 135 * k, y: y + h * 0.14 },
    'come-point': { x: x + 44 * k, y: y + h * 0.5 },
    odds: { x: x + w - 44 * k, y: y + h * 0.5 },
    main: { x: x + w * 0.3, y: y + h * 0.8 },
    buy: { x: x + w * 0.7, y: y + h * 0.8 },
  };
  return {
    id: `box-${n}` as RegionId,
    rect,
    label: `Number ${n}`,
    sublabel: `Place pays ${PLACE_PAYS[n]}`,
    betTypes: boxBetTypes(n),
    chipSpots: spots,
  };
}

export function centerOf(r: Rect): Point2 {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function puckForBox(rect: Rect, inset: number): Point2 {
  return { x: rect.x + rect.w - inset, y: rect.y + inset };
}
