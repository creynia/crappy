import { describe, expect, it } from 'vitest';
import {
  centerLayout,
  landscapeLayout,
  portraitLayout,
  regionIdForBet,
  spotPosition,
} from './index';
import type { Rect, TableLayout } from './types';

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
