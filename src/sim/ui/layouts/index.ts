import { centerLayout } from './center';
import { landscapeLayout } from './landscape';
import { portraitLayout } from './portrait';
import type { Point2, RegionDef, RegionId, TableLayout } from './types';

export * from './types';
export { portraitLayout, landscapeLayout, centerLayout };

export function layoutFor(kind: TableLayout['id']): TableLayout {
  return kind === 'portrait'
    ? portraitLayout
    : kind === 'landscape'
      ? landscapeLayout
      : centerLayout;
}

export function findRegion(layout: TableLayout, id: RegionId): RegionDef | undefined {
  return layout.regions.find((r) => r.id === id);
}

/** Region that holds a bet's chips, or null if the layout lacks it (e.g. a prop on the main felt). */
export function regionIdForBet(type: string, point: number | null): RegionId | null {
  switch (type) {
    case 'pass-line':
    case 'pass-odds':
      return 'pass';
    case 'dont-pass':
    case 'dont-pass-odds':
      return 'dont-pass';
    case 'come':
      return point ? (`box-${point}` as RegionId) : 'come';
    case 'dont-come':
      return point ? (`box-${point}` as RegionId) : 'dont-come';
    case 'come-odds':
    case 'dont-come-odds':
      return point ? (`box-${point}` as RegionId) : null;
    case 'field':
    case 'big-6':
    case 'big-8':
    case 'any-7':
    case 'any-craps':
    case 'yo-11':
    case 'aces-2':
    case 'boxcars-12':
    case 'ace-deuce-3':
    case 'horn':
    case 'c-e':
    case 'world':
    case 'hard-4':
    case 'hard-6':
    case 'hard-8':
    case 'hard-10':
    case 'fire':
    case 'all':
    case 'tall':
    case 'small':
      return type;
  }
  const m = /^(place|buy|lay)-(\d+)$/.exec(type);
  return m ? (`box-${m[2]}` as RegionId) : null;
}

/** Where a bet type's chips are drawn inside its region (absolute viewBox coordinates). */
export function spotPosition(region: RegionDef, type: string): Point2 {
  const s = region.chipSpots;
  const fallback = { x: region.rect.x + region.rect.w / 2, y: region.rect.y + region.rect.h / 2 };
  if (type === 'come-odds') {
    return s.odds ?? fallback;
  }
  if (type === 'dont-come-odds') return s['dc-odds'] ?? s['dc-point'] ?? fallback;
  if (type === 'pass-odds' || type === 'dont-pass-odds') return s.odds ?? s.main ?? fallback;
  if (type === 'come')
    return region.id.startsWith('box-') ? (s['come-point'] ?? fallback) : (s.main ?? fallback);
  if (type === 'dont-come')
    return region.id.startsWith('box-') ? (s['dc-point'] ?? fallback) : (s.main ?? fallback);
  if (type.startsWith('buy-')) return s.buy ?? fallback;
  if (type.startsWith('lay-')) return s.lay ?? fallback;
  return s.main ?? fallback;
}
