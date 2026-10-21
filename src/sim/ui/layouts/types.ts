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
  | `hard-${4 | 6 | 8 | 10}`
  | 'fire'
  | 'all'
  | 'tall'
  | 'small';
export type ChipSpotKey = 'main' | 'odds' | 'come-point' | 'dc-point' | 'lay' | 'buy';
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
