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
 * How far a captioned chip stack (ChipStack, up to 5 chips) reaches above and below its centre:
 * the pair caption sits over the top chip (4 chips x 6 units of offset), the amount badge under it.
 */
export function stackExtent(r: number): { above: number; below: number } {
  const thick = Math.max(4, r * 0.14);
  return { above: r + 4 * 6 + r * 0.32 + r * 0.36, below: r + thick - 2 + r * 0.42 };
}
/** Vertical step: one full stack plus a small gap (4r at r = 32). */
export const hopStepY = (r: number) => {
  const e = stackExtent(r);
  return Math.ceil(e.above + e.below + 2);
};
/** Centre of the first row: caption top clears the title band. */
const firstRowY = (r: number) => HOP_BAND + stackExtent(r).above + 2;

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
