import type { BetTypeId, PointNumber, StandardPoint } from '../../engine/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type RegionId =
  | 'pass'
  | 'dont-pass'
  | 'come'
  | 'dont-come'
  | 'field'
  | 'big-6'
  | 'big-8'
  | `box-${PointNumber}`
  | 'any-7'
  | 'any-craps'
  | 'yo-11'
  | 'aces-2'
  | 'boxcars-12'
  | 'ace-deuce-3'
  | 'horn'
  | 'c-e'
  | 'world'
  | 'hop'
  | `hard-${4 | 6 | 8 | 10}`
  | 'fire'
  | 'all'
  | 'tall'
  | 'small';
/**
 * Bet types with no fixed region (they sit in whichever number box their come bet travelled to), so
 * a callout cannot target them by bet type; point at the number box ("box-6") instead.
 */
export const BET_TYPES_WITHOUT_REGION: readonly BetTypeId[] = ['come-odds', 'dont-come-odds'];

/** Every region id, as a runtime list (scene validation of callout targets). */
export const REGION_IDS: readonly RegionId[] = [
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
  // crapless felts only (I036)
  'box-2',
  'box-3',
  'box-11',
  'box-12',
  'any-7',
  'any-craps',
  'yo-11',
  'aces-2',
  'boxcars-12',
  'ace-deuce-3',
  'horn',
  'c-e',
  'world',
  'hop',
  'hard-4',
  'hard-6',
  'hard-8',
  'hard-10',
  'fire',
  'all',
  'tall',
  'small',
];
/**
 * Chip spots inside a region. Number boxes use all of them except `main` is the place spot;
 * `odds` / `dc-odds` sit offset on top of the come-point / don't-come chips, as a dealer would
 * place them. Line regions use `main` (flat bet) and `odds` (the printed odds area).
 */
export type ChipSpotKey = 'main' | 'odds' | 'come-point' | 'dc-point' | 'dc-odds' | 'lay' | 'buy';
export type Point2 = { x: number; y: number };

export interface RegionDef {
  id: RegionId;
  rect: Rect;
  label: string;
  sublabel?: string;
  /** Bet types reachable from this region (segmented control in the sheet). */
  betTypes: BetTypeId[];
  chipSpots: Partial<Record<ChipSpotKey, Point2>>;
  shape?: 'rect' | 'pass-arc';
}

export interface TableLayout {
  id: 'portrait' | 'landscape' | 'center';
  viewBox: { w: number; h: number };
  regions: RegionDef[];
  /** Puck spot per point; crapless layouts add 2, 3, 11 and 12. */
  puck: Record<StandardPoint | 'off', Point2> & Partial<Record<PointNumber, Point2>>;
  puckRadius: number;
  chipRadius: number;
  /** Minimum region short side, in viewBox units, so that it is >= 44 CSS px at the reference viewport. */
  minTapUnits: number;
}
