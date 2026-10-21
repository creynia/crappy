import { describe, expect, it } from 'vitest';
import { BET_TYPES } from '../../engine';
import { BOX_BAR } from './shared';
import {
  centerLayout,
  findRegion,
  landscapeLayout,
  portraitLayout,
  regionIdForBet,
  spotPosition,
} from './index';
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
    for (const type of Object.keys(BET_TYPES)) {
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
      // don't come and lay on the top bar
      for (const k of ['dc-point', 'lay'] as const) expect(s[k]!.y, k).toBeLessThan(barBottom);
      // come odds sit offset on the come chips, lay odds on the don't-come chips
      expect(dist(s.odds!, s['come-point']!)).toBeLessThan(r * 1.5);
      expect(dist(s.odds!, s['come-point']!)).toBeGreaterThan(r * 0.5);
      expect(dist(s['dc-odds']!, s['dc-point']!)).toBeLessThan(r * 1.5);
      expect(dist(s['dc-odds']!, s['dc-point']!)).toBeGreaterThan(r * 0.5);
      // place and buy below the numeral, side by side; the come-point area is clear of them
      expect(s.main!.y).toBeGreaterThan(box.rect.y + box.rect.h * 0.7);
      expect(s.buy!.y).toBe(s.main!.y);
      expect(dist(s.main!, s.buy!)).toBeGreaterThanOrEqual(r * 2);
      expect(dist(s['come-point']!, s.main!)).toBeGreaterThanOrEqual(r * 2);
      // the lay stack clears the ON puck at the top right
      expect(dist(s.lay!, layout.puck[n])).toBeGreaterThanOrEqual(r + layout.puckRadius - 1);
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
});
