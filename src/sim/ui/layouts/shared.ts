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

/** Offset of an odds stack on its flat bet, in portrait box units (scaled by the box width). */
export const ODDS_OFFSET = { dx: 30, dy: -18 } as const;
/** Lay odds sit offset on the don't-come chips, to the right so both amount badges stay readable. */
export const DC_ODDS_OFFSET = { dx: 44, dy: -4 } as const;
/** Height of the box's top bar (don't come and lay), as a fraction of the box height. */
export const BOX_BAR = 0.27;

/**
 * A number box with chip spots placed where a dealer puts them (simulator.md section 3.2):
 * - top bar (y + 0..27%): don't-come chips on the left with their lay odds offset on them, lay bets
 *   in the middle (the puck sits at the top right);
 * - come-point area (left, middle): travelled come bets, with come odds offset on the flat;
 * - bottom (y + 80%): place bets on the left, buy bets on the right (with a BUY button).
 */
export function numberBox(n: PointNumber, rect: Rect): RegionDef {
  const { x, y, w, h } = rect;
  const k = w / 280; // horizontal scale relative to the portrait box
  const dc = { x: x + 44 * k, y: y + h * 0.14 };
  const come = { x: x + 44 * k, y: y + h * 0.5 };
  const spots: Partial<Record<ChipSpotKey, { x: number; y: number }>> = {
    'dc-point': dc,
    'dc-odds': { x: dc.x + DC_ODDS_OFFSET.dx * k, y: dc.y + DC_ODDS_OFFSET.dy },
    lay: { x: x + 135 * k, y: y + h * 0.14 },
    'come-point': come,
    odds: { x: come.x + ODDS_OFFSET.dx * k, y: come.y + ODDS_OFFSET.dy },
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
