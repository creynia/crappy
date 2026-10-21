import type { Callout } from '../scene/types';
import { regionIdForBet } from './layouts';
import type { Point2, Rect, RegionId, TableLayout } from './layouts/types';

export type { Callout };

/** A callout resolved against one layout: the region it points at. */
export interface PlacedCallout {
  id: string;
  regionId: RegionId;
  text: string;
  placement: 'above' | 'below';
}

/** Bubble geometry in viewBox units. */
export interface CalloutBox {
  box: Rect;
  lines: string[];
  /** where the leader line starts (bubble edge) and ends (region edge) */
  from: Point2;
  to: Point2;
  fontSize: number;
  lineHeight: number;
}

const GAP = 16;
const PAD = 14;
const MARGIN = 6;

/** Wraps text into lines of at most `max` characters (words are never split unless longer than `max`). */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (!cur) cur = word;
    else if (cur.length + 1 + word.length <= max) cur += ' ' + word;
    else {
      lines.push(cur);
      cur = word;
    }
    while (cur.length > max) {
      lines.push(cur.slice(0, max));
      cur = cur.slice(max);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Lays out a callout bubble for a region: centred on the region, above it (or below), flipped to the
 * other side when it would leave the viewBox, clamped horizontally, and as a last resort laid over the
 * region itself. The result always lies inside the viewBox.
 */
export function calloutBox(
  rect: Rect,
  viewBox: { w: number; h: number },
  text: string,
  placement: 'above' | 'below' = 'above',
): CalloutBox {
  const fontSize = Math.round(viewBox.w / 30); // ~13 CSS px at the reference widths
  const lineHeight = Math.round(fontSize * 1.25);
  const maxW = Math.min(viewBox.w - 2 * MARGIN, Math.round(viewBox.w * 0.62));
  const maxChars = Math.max(8, Math.floor((maxW - 2 * PAD) / (fontSize * 0.56)));
  const lines = wrapText(text, maxChars);
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const w = Math.min(maxW, Math.ceil(longest * fontSize * 0.56) + 2 * PAD);
  const h = lines.length * lineHeight + 2 * PAD - (lineHeight - fontSize);
  const cx = rect.x + rect.w / 2;
  const x = Math.min(Math.max(cx - w / 2, MARGIN), viewBox.w - MARGIN - w);
  const aboveY = rect.y - GAP - h;
  const belowY = rect.y + rect.h + GAP;
  const fitsAbove = aboveY >= MARGIN;
  const fitsBelow = belowY + h <= viewBox.h - MARGIN;
  let y: number;
  let side: 'above' | 'below' | 'over';
  if (placement === 'above' ? fitsAbove : !fitsBelow && fitsAbove) {
    y = aboveY;
    side = 'above';
  } else if (fitsBelow) {
    y = belowY;
    side = 'below';
  } else {
    y = Math.min(Math.max(rect.y + rect.h / 2 - h / 2, MARGIN), viewBox.h - MARGIN - h);
    side = 'over';
  }
  const box = { x, y, w, h: Math.min(h, viewBox.h - 2 * MARGIN) };
  const lx = Math.min(Math.max(cx, x + PAD), x + w - PAD);
  const from =
    side === 'above' ? { x: lx, y: y + box.h } : side === 'below' ? { x: lx, y } : { x: lx, y };
  const to =
    side === 'above'
      ? { x: cx, y: rect.y }
      : side === 'below'
        ? { x: cx, y: rect.y + rect.h }
        : from;
  return { box, lines, from, to, fontSize, lineHeight };
}

/** Resolves scene callouts to regions of this layout (callouts whose target it lacks are dropped). */
export function placeCallouts(
  callouts: readonly Callout[],
  layout: TableLayout,
  idPrefix: string,
): PlacedCallout[] {
  const out: PlacedCallout[] = [];
  callouts.forEach((c, i) => {
    const regionId =
      typeof c.target === 'string'
        ? (c.target as RegionId)
        : regionIdForBet(c.target.betType, null);
    if (!regionId || !layout.regions.some((r) => r.id === regionId)) return;
    out.push({
      id: `${idPrefix}-co${i}`,
      regionId,
      text: c.text,
      placement: c.placement ?? 'above',
    });
  });
  return out;
}

/** Callout bubbles with leader lines, drawn inside the Table's SVG (they scale with it). */
export function CalloutLayer({
  callouts,
  layout,
}: {
  callouts: readonly PlacedCallout[];
  layout: TableLayout;
}) {
  if (!callouts.length) return null;
  return (
    <g class="sim-callouts" aria-hidden="true">
      {callouts.map((c) => {
        const region = layout.regions.find((r) => r.id === c.regionId);
        if (!region) return null;
        const g = calloutBox(region.rect, layout.viewBox, c.text, c.placement);
        return (
          <g key={c.id} class="sim-callout" data-callout={c.regionId}>
            {g.from !== g.to ? (
              <>
                <line
                  class="sim-callout-line"
                  x1={g.from.x}
                  y1={g.from.y}
                  x2={g.to.x}
                  y2={g.to.y}
                />
                <circle class="sim-callout-dot" cx={g.to.x} cy={g.to.y} r={g.fontSize * 0.28} />
              </>
            ) : null}
            <rect
              class="sim-callout-box"
              x={g.box.x}
              y={g.box.y}
              width={g.box.w}
              height={g.box.h}
              rx={g.fontSize * 0.45}
            />
            <text id={c.id} class="sim-callout-text" font-size={g.fontSize}>
              {g.lines.map((l, i) => (
                <tspan
                  key={i}
                  x={g.box.x + g.box.w / 2}
                  y={g.box.y + 14 + g.fontSize * 0.85 + i * g.lineHeight}
                  text-anchor="middle"
                >
                  {i < g.lines.length - 1 ? `${l} ` : l}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </g>
  );
}
