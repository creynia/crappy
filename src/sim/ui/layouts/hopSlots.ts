import type { Point2, Rect } from './types';

/**
 * Hop bet chip slots (I035). Each pair placed gets its own captioned stack, laid out in rows
 * under a title band, so all 21 pairs fit without overlapping each other or the title.
 * Units are viewBox units; `r` is the layout's chip radius.
 */
export const HOP_BAND = 56; // title band at the top of the region
const PAD = 8;
/** Horizontal step: wider than a chip (2r) and its pair caption (1.9r). */
export const hopStepX = (r: number) => r * 2.35;
/**
 * Vertical step: a 5-chip stack with caption above and badge below spans about
 * 1.68r + 24 above the centre and 1.42r + 4 below, i.e. < 4r for r >= 28.
 */
export const hopStepY = (r: number) => r * 4;
/** Centre of the first row: caption top clears the title band. */
const firstRowY = (r: number) => HOP_BAND + r * 1.68 + 26;

export function hopCols(rect: Rect, r: number): number {
  return Math.max(1, Math.floor((rect.w - 2 * PAD) / hopStepX(r)));
}

export function hopSlot(rect: Rect, slot: number, r: number): Point2 {
  const cols = hopCols(rect, r);
  const step = hopStepX(r);
  const used = cols * step;
  const x0 = rect.x + (rect.w - used) / 2 + step / 2;
  return {
    x: x0 + (slot % cols) * step,
    y: rect.y + firstRowY(r) + Math.floor(slot / cols) * hopStepY(r),
  };
}

export const hopSlot0 = (rect: Rect, r: number) => hopSlot(rect, 0, r);
