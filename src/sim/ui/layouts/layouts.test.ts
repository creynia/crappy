import { describe, expect, it } from 'vitest';
import { BET_TYPES, CRAPLESS_BET_TYPE_IDS } from '../../engine';
import { BOX_BAR, STACK_RISE } from './shared';
import {
  centerLayout,
  craplessLandscapeLayout,
  craplessPortraitLayout,
  feltLayout,
  findRegion,
  landscapeLayout,
  portraitLayout,
  regionIdForBet,
  hopSpot,
  spotPosition,
} from './index';
import { BADGE_HEIGHT, badgeWidth } from '../ChipStack';
import { HOP_BAND, stackExtent } from './hopSlots';
import type { ChipSpotKey, Point2, Rect, TableLayout } from './types';

const VIEWPORT: Record<TableLayout['id'], number> = {
  portrait: 390 / 900,
  landscape: 664 / 1500,
  center: 390 / 900,
};

function overlap(a: Rect, b: Rect) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

describe.each([portraitLayout, landscapeLayout, centerLayout])('layout $id', (layout) => {
  it('every region is at least 44 CSS px on its short side at the reference viewport', () => {
    for (const r of layout.regions) {
      const short = Math.min(r.rect.w, r.rect.h);
      expect(short, r.id).toBeGreaterThanOrEqual(layout.minTapUnits);
      expect(short * VIEWPORT[layout.id], r.id).toBeGreaterThanOrEqual(44);
    }
  });
  it('regions do not overlap and fit in the viewBox', () => {
    const rs = layout.regions;
    for (let i = 0; i < rs.length; i++) {
      const a = rs[i]!.rect;
      expect(a.x + a.w).toBeLessThanOrEqual(layout.viewBox.w);
      expect(a.y + a.h).toBeLessThanOrEqual(layout.viewBox.h);
      for (let j = i + 1; j < rs.length; j++)
        expect(overlap(a, rs[j]!.rect), `${rs[i]!.id} vs ${rs[j]!.id}`).toBe(false);
    }
  });
  it('has unique region ids and a main chip spot or box spots', () => {
    const ids = layout.regions.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of layout.regions)
      expect(Object.keys(r.chipSpots).length, r.id).toBeGreaterThan(0);
  });
});

describe('main layouts', () => {
  it.each([portraitLayout, landscapeLayout])(
    'contain the felt regions and a puck position for every number',
    (l) => {
      const ids = l.regions.map((r) => r.id);
      for (const id of [
        'pass',
        'dont-pass',
        'come',
        'dont-come',
        'field',
        'big-6',
        'big-8',
        'box-4',
        'box-5',
        'box-6',
        'box-8',
        'box-9',
        'box-10',
      ]) {
        expect(ids).toContain(id);
      }
      for (const n of [4, 5, 6, 8, 9, 10] as const) expect(l.puck[n]).toBeDefined();
    },
  );
  it('routes bets to regions and spots', () => {
    expect(regionIdForBet('place-6', null)).toBe('box-6');
    expect(regionIdForBet('come', 8)).toBe('box-8');
    expect(regionIdForBet('come', null)).toBe('come');
    expect(regionIdForBet('pass-odds', null)).toBe('pass');
    expect(regionIdForBet('hard-8', null)).toBe('hard-8');
    const box = portraitLayout.regions.find((r) => r.id === 'box-6')!;
    expect(spotPosition(box, 'buy-6')).toEqual(box.chipSpots.buy);
    expect(spotPosition(box, 'lay-6')).toEqual(box.chipSpots.lay);
  });
});

describe.each([craplessPortraitLayout, craplessLandscapeLayout])(
  'crapless layout $id',
  (layout) => {
    it('keeps 44px tap targets, no overlaps, unique ids', () => {
      const rs = layout.regions;
      for (const r of rs) {
        const short = Math.min(r.rect.w, r.rect.h);
        expect(short, r.id).toBeGreaterThanOrEqual(layout.minTapUnits);
        expect(short * VIEWPORT[layout.id], r.id).toBeGreaterThanOrEqual(44);
        expect(r.rect.x + r.rect.w).toBeLessThanOrEqual(layout.viewBox.w);
        expect(r.rect.y + r.rect.h).toBeLessThanOrEqual(layout.viewBox.h);
      }
      for (let i = 0; i < rs.length; i++)
        for (let j = i + 1; j < rs.length; j++)
          expect(overlap(rs[i]!.rect, rs[j]!.rect), `${rs[i]!.id} vs ${rs[j]!.id}`).toBe(false);
      expect(new Set(rs.map((r) => r.id)).size).toBe(rs.length);
    });
    it('has the ten boxes in 2 3 | 4 5 6 8 9 10 | 11 12 order and a puck for each', () => {
      const boxes = layout.regions.filter((r) => r.id.startsWith('box-'));
      expect(boxes.map((r) => r.id)).toEqual(
        [2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map((n) => `box-${n}`),
      );
      for (const n of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] as const)
        expect(layout.puck[n]).toBeDefined();
      for (const n of [2, 3, 11, 12] as const)
        expect(boxes.find((r) => r.id === `box-${n}`)!.betTypes, `box-${n}`).toEqual([
          `place-${n}`,
          'come-odds',
        ]);
      expect(boxes.find((r) => r.id === 'box-12')!.sublabel).toBe('Place pays 11 to 2');
      expect(boxes.find((r) => r.id === 'box-3')!.sublabel).toBe('Place pays 11 to 4');
    });
    it('is chosen by feltLayout for the crapless variant only', () => {
      const land = layout.id === 'landscape';
      expect(feltLayout(land, 'crapless')).toBe(layout);
      expect(feltLayout(land, 'standard')).toBe(land ? landscapeLayout : portraitLayout);
    });
  },
);

describe('chip spots: every bet type renders at its documented spot (simulator.md 3.2)', () => {
  // The chip spot each bet type uses on the main felt; props use `main` on the center panel.
  const SPOT: Record<string, ChipSpotKey> = {
    'pass-line': 'main',
    'pass-odds': 'odds',
    'dont-pass': 'main',
    'dont-pass-odds': 'odds',
    field: 'main',
    'big-6': 'main',
    'big-8': 'main',
  };
  const boxSpot = (type: string): ChipSpotKey | null => {
    if (type === 'come') return 'come-point';
    if (type === 'come-odds') return 'odds';
    if (type === 'dont-come') return 'dc-point';
    if (type === 'dont-come-odds') return 'dc-odds';
    if (type.startsWith('place-')) return 'main';
    if (type.startsWith('buy-')) return 'buy';
    if (type.startsWith('lay-')) return 'lay';
    return null;
  };
  const inside = (p: Point2, r: Rect) =>
    p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
  const dist = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);

  it.each([portraitLayout, landscapeLayout])('$id: all bet types have a spot', (layout) => {
    // (place 2/3/11/12 exist only on the crapless felt: see the crapless layout tests)
    for (const type of Object.keys(BET_TYPES).filter(
      (t) => !(CRAPLESS_BET_TYPE_IDS as readonly string[]).includes(t),
    )) {
      const needsPoint = /^(come|dont-come)(-odds)?$/.test(type);
      const box = needsPoint ? 6 : /-(\d+)$/.exec(type)?.[1];
      const rid = regionIdForBet(type, needsPoint ? 6 : null);
      const onCenter = rid !== null && findRegion(centerLayout, rid) !== undefined;
      const region = findRegion(onCenter ? centerLayout : layout, rid!);
      expect(region, type).toBeDefined();
      const key = onCenter ? 'main' : (SPOT[type] ?? (box ? boxSpot(type) : null));
      expect(key, type).toBeTruthy();
      const spot = region!.chipSpots[key!];
      expect(spot, `${type} -> ${key}`).toBeDefined();
      expect(spotPosition(region!, type), type).toEqual(spot);
      expect(inside(spot!, region!.rect), type).toBe(true);
    }
  });

  it.each([portraitLayout, landscapeLayout])('$id: number box geography', (layout) => {
    const r = layout.chipRadius;
    for (const n of [4, 5, 6, 8, 9, 10] as const) {
      const box = findRegion(layout, `box-${n}`)!;
      const s = box.chipSpots;
      const barBottom = box.rect.y + box.rect.h * BOX_BAR;
      // don't come (and its lay odds) on the top bar; lay bets on the right under the puck
      for (const k of ['dc-point', 'dc-odds'] as const) expect(s[k]!.y, k).toBeLessThan(barBottom);
      expect(s.lay!.x).toBeGreaterThan(box.rect.x + box.rect.w * 0.75);
      expect(s.lay!.y).toBeGreaterThan(layout.puck[n].y);
      // come odds sit offset on the come chips, lay odds on the don't-come chips
      expect(dist(s.odds!, s['come-point']!)).toBeLessThan(r * 2);
      expect(dist(s.odds!, s['come-point']!)).toBeGreaterThan(r);
      expect(dist(s['dc-odds']!, s['dc-point']!)).toBeLessThan(r * 2);
      expect(dist(s['dc-odds']!, s['dc-point']!)).toBeGreaterThan(r);
      // place and buy below the numeral, side by side; the come-point area is clear of them
      expect(s.main!.y).toBeGreaterThan(box.rect.y + box.rect.h * 0.7);
      expect(s.buy!.y).toBe(s.main!.y);
      expect(dist(s.main!, s.buy!)).toBeGreaterThanOrEqual(r * 2);
      expect(dist(s['come-point']!, s.main!)).toBeGreaterThanOrEqual(r * 2);
    }
  });

  it.each([portraitLayout, landscapeLayout])(
    '$id: pass and don’t pass odds have their own printed area next to the flat bet',
    (layout) => {
      for (const id of ['pass', 'dont-pass'] as const) {
        const s = findRegion(layout, id)!.chipSpots;
        expect(dist(s.odds!, s.main!), id).toBeGreaterThanOrEqual(layout.chipRadius * 2);
        expect(dist(s.odds!, s.main!), id).toBeLessThan(layout.chipRadius * 4);
      }
    },
  );

  it.each([portraitLayout, landscapeLayout])(
    '$id: stacks that share a box keep their distance (review: no covered buttons)',
    (layout) => {
      const r = layout.chipRadius;
      for (const n of [4, 5, 6, 8, 9, 10] as const) {
        const box = findRegion(layout, `box-${n}`)!;
        const s = box.chipSpots;
        const puck = layout.puck[n];
        const why = `${layout.id} box ${n}`;
        expect(dist(s.lay!, s['dc-odds']!), why).toBeGreaterThanOrEqual(2 * r);
        expect(dist(s.lay!, s['dc-point']!), why).toBeGreaterThanOrEqual(2 * r);
        expect(dist(s.odds!, s.main!), why).toBeGreaterThanOrEqual(2 * r);
        expect(dist(s.buy!, puck), why).toBeGreaterThanOrEqual(2 * r);
        expect(dist(s.lay!, s.buy!), why).toBeGreaterThanOrEqual(2 * r);
        expect(dist(s.lay!, puck), why).toBeGreaterThanOrEqual(r + layout.puckRadius);
        expect(dist(s['dc-odds']!, puck), why).toBeGreaterThanOrEqual(r + layout.puckRadius);
        // a full stack stays inside its box at the top, and every spot's chips stay inside it
        for (const [k, p] of Object.entries(s)) {
          expect(p.y - r - STACK_RISE, `${why} ${k} top`).toBeGreaterThanOrEqual(box.rect.y);
          expect(p.x - r, `${why} ${k} left`).toBeGreaterThanOrEqual(box.rect.x);
          expect(p.x + r, `${why} ${k} right`).toBeLessThanOrEqual(box.rect.x + box.rect.w);
        }
      }
    },
  );

  it.each([portraitLayout, landscapeLayout])(
    '$id: odds offset on the flat keep both amount badges readable and the flat tappable',
    (layout) => {
      const r = layout.chipRadius;
      const bh = BADGE_HEIGHT * r;
      for (const n of [4, 5, 6, 8, 9, 10] as const) {
        const s = findRegion(layout, `box-${n}`)!.chipSpots;
        const why = `${layout.id} ${n}`;
        for (const [flat, odds] of [
          [s['come-point']!, s.odds!],
          [s['dc-point']!, s['dc-odds']!],
        ] as const) {
          expect(dist(odds, flat), why).toBeGreaterThan(r); // the odds chips clear the flat's centre
          expect(dist(odds, flat), why).toBeLessThan(2 * r); // still "on" it
        }
        // come odds up to "$1,000": the odds badge (about 1.1r below the odds spot) stays clear
        // of the flat's centre, so a tap there opens the come bet; the two badges don't overlap
        const come = s['come-point']!;
        const odds = s.odds!;
        const half = badgeWidth('$1,000', r) / 2;
        expect(odds.x - half, why).toBeGreaterThan(come.x);
        expect(Math.abs(odds.y - come.y), why).toBeGreaterThanOrEqual(bh);
        // lay odds up to "$100" beside a "$25" don't come: both badges readable
        const dc = s['dc-point']!;
        const lay = s['dc-odds']!;
        expect(lay.x - dc.x, why).toBeGreaterThanOrEqual(
          badgeWidth('$100', r) / 2 + badgeWidth('$25', r) / 2,
        );
      }
    },
  );
});

describe('center layout: hop region (I035)', () => {
  const hop = centerLayout.regions.find((r) => r.id === 'hop')!;
  it('exists, takes hop bets and is a >= 44 CSS px tap target at 390px wide', () => {
    expect(hop.betTypes).toEqual(['hop']);
    expect(regionIdForBet('hop', null)).toBe('hop');
    expect(Math.min(hop.rect.w, hop.rect.h) * VIEWPORT.center).toBeGreaterThanOrEqual(44);
  });
  it('fits all 21 pairs: slots >= 2r apart, stacks inside the region and below the title', () => {
    const r = centerLayout.chipRadius;
    const ext = stackExtent(r);
    const spots = Array.from({ length: 21 }, (_, i) => hopSpot(hop, i, r));
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) {
        const a = spots[i]!;
        const b = spots[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(2 * r);
        // same column, next row: the lower stack's caption clears the upper stack's badge
        if (a.x === b.x) expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(ext.above + ext.below);
      }
    for (const p of spots) {
      expect(p.x - r).toBeGreaterThanOrEqual(hop.rect.x);
      expect(p.x + r).toBeLessThanOrEqual(hop.rect.x + hop.rect.w);
      // a 5-chip stack, caption and badge included, stays below the title band and in the region
      expect(p.y - ext.above).toBeGreaterThanOrEqual(hop.rect.y + HOP_BAND);
      expect(p.y + ext.below).toBeLessThanOrEqual(hop.rect.y + hop.rect.h);
    }
    expect(hop.rect.y + hop.rect.h).toBeLessThanOrEqual(centerLayout.viewBox.h);
  });
});

describe.each([craplessPortraitLayout, craplessLandscapeLayout])(
  'crapless number boxes: chips $id',
  (layout) => {
    const dist = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
    const r = layout.chipRadius;
    it('the spots a box uses are 2r apart (buy and lay share one: a box holds one or the other)', () => {
      for (const n of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] as const) {
        const s = findRegion(layout, `box-${n}`)!.chipSpots;
        const used: [string, Point2][] = [
          ['come-point', s['come-point']!],
          ['odds', s.odds!],
          ['main', s.main!],
          ['buy', s.buy!],
        ];
        for (let i = 0; i < used.length; i++)
          for (let j = i + 1; j < used.length; j++)
            expect(
              dist(used[i]![1], used[j]![1]),
              `${layout.id} box ${n}: ${used[i]![0]} vs ${used[j]![0]}`,
            ).toBeGreaterThanOrEqual(2 * r);
        expect(s.lay).toEqual(s.buy);
      }
    });
    it('every stack, a full one included, stays inside its box', () => {
      for (const n of [2, 3, 4, 5, 6, 8, 9, 10, 11, 12] as const) {
        const box = findRegion(layout, `box-${n}`)!;
        for (const [k, p] of Object.entries(box.chipSpots)) {
          const why = `${layout.id} box ${n} ${k}`;
          expect(p.y - r - STACK_RISE, `${why} top`).toBeGreaterThanOrEqual(box.rect.y);
          expect(p.y + r, `${why} bottom`).toBeLessThanOrEqual(box.rect.y + box.rect.h);
          expect(p.x - r, `${why} left`).toBeGreaterThanOrEqual(box.rect.x);
          expect(p.x + r, `${why} right`).toBeLessThanOrEqual(box.rect.x + box.rect.w);
        }
      }
    });
  },
);
