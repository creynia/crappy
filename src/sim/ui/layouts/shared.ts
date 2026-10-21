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

/**
 * Odds sit offset on their flat bet, in chip radii. Come odds go up and to the right, far enough
 * that both amount badges show and a tap on the flat's centre still hits the flat. Lay odds on a
 * don't-come bet go beside it (the top bar has no room above).
 */
export const ODDS_OFFSET = { dx: 1.35, dy: -0.9 } as const;
export const DC_ODDS_OFFSET = { dx: 1.75, dy: 0 } as const;
/** Height of the shaded top bar (don't come), as a fraction of the box height. */
export const BOX_BAR = 0.27;
/** How far a full stack (5 chips) rises above its spot, in viewBox units. */
export const STACK_RISE = 24;

/**
 * A number box with chip spots placed where a dealer puts them (simulator.md section 3.2).
 * `r` is the layout's chip radius. Horizontal positions scale with the box width (k).
 * - top bar, left: travelled don't-come chips, with their lay odds beside them;
 * - right, under the puck: lay bets (with a LAY button);
 * - come-point area, left middle: travelled come bets, with come odds offset on the flat;
 * - bottom (y + 80%): place bets on the left, buy bets on the right (with a BUY button).
 */
export function numberBox(n: PointNumber, rect: Rect, r: number): RegionDef {
  const { x, y, w, h } = rect;
  const k = w / 280; // horizontal scale relative to the portrait box
  // a full stack on the top bar stays inside the box
  const dc = { x: x + 44 * k, y: y + r + STACK_RISE + 4 };
  const come = { x: x + 44 * k, y: y + h * 0.56 };
  const spots: Partial<Record<ChipSpotKey, { x: number; y: number }>> = {
    'dc-point': dc,
    'dc-odds': { x: dc.x + DC_ODDS_OFFSET.dx * r, y: dc.y + DC_ODDS_OFFSET.dy * r },
    lay: { x: x + w - 44 * k, y: y + h * 0.54 },
    'come-point': come,
    odds: { x: come.x + ODDS_OFFSET.dx * r, y: come.y + ODDS_OFFSET.dy * r },
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
