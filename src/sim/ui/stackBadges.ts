import type { Rect } from './layouts/types';

export interface BadgeItem {
  key: string;
  /** the stack's centre */
  x: number;
  y: number;
  text: string;
}

export interface BadgeBox extends Rect {
  fontSize: number;
}

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Badge rectangles for annotated chip stacks: sized to their text, centred on the stack, and moved
 * down (then up) a row at a time until they overlap no badge placed before them, so nearby stacks
 * (a flat bet and its odds) never hide each other's call. Kept inside the viewBox horizontally.
 */
export function layoutBadges(
  items: readonly BadgeItem[],
  r: number,
  viewBox: { w: number; h: number },
  /** smallest font size in viewBox units (e.g. 12 CSS px at the rendered scale) */
  minFont = 0,
): Map<string, BadgeBox> {
  const fontSize = Math.max(r * 0.78, minFont);
  const h = Math.max(r * 1.15, fontSize * 1.45);
  const gap = r * 0.12;
  const placed: Rect[] = [];
  const out = new Map<string, BadgeBox>();
  for (const it of items) {
    const w = Math.max(r * 2.2, it.text.length * fontSize * 0.56 + r * 0.6);
    const x = Math.min(Math.max(it.x - w / 2, 2), viewBox.w - 2 - w);
    const y0 = it.y + r * 0.15 - h / 2;
    let box: Rect = { x, y: y0, w, h };
    for (let k = 1; k < 12 && placed.some((p) => intersects(p, box)); k++) {
      const step = Math.ceil(k / 2) * (h + gap) * (k % 2 ? 1 : -1);
      box = { x, y: Math.min(Math.max(y0 + step, 2), viewBox.h - 2 - h), w, h };
    }
    placed.push(box);
    out.set(it.key, { ...box, fontSize });
  }
  return out;
}
