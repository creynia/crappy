import type { Action, Bet, Phase, PointNumber, TableRules, Validation } from '../engine/types';
import type { Fraction } from './fraction';

export interface Outcome {
  label: string;
  ways: number;
  outOf: number;
  probability: Fraction;
  net: Fraction; // cents, incl. vig
}
export interface BetCtx {
  phase: Phase;
  point: PointNumber | null;
  rules: TableRules;
}
/** `working` is the player's ON/OFF setting; omitted means 'auto'. */
export type BetLike = Pick<Bet, 'type' | 'amount' | 'point'> & { working?: Bet['working'] };

export interface EdgeInfo {
  perResolved: Fraction; // -EV / amount, pushes count as decisions
  perResolvedExPush: Fraction;
  expectedRolls: Fraction;
  perRoll: Fraction;
}

/** By edge per bet resolved: free <=0, good <=2%, fair <=5%, poor <9%, avoid >=9% (only `avoid` needs a second tap). */
export type EdgeTier = 'free' | 'good' | 'fair' | 'poor' | 'avoid';

export interface Explanation {
  rows: Outcome[];
  /** next-roll effect on the bet per dice combination (36, ALL_DICE order) */
  grid?: import('./outcomes').RollEffect[];
  /** shown with the grid when the bet is off / does nothing this roll */
  gridNote?: string;
  evFormula: string;
  note?: string;
}
export interface Alternative {
  action: Action;
  label: string;
  edge: EdgeInfo;
  savingsCents: Fraction;
  message: string;
}
export interface ActionPreview {
  action: Action;
  validation: Validation;
  evCents: Fraction;
  edge: EdgeInfo | null;
  tier: EdgeTier;
  perRollCents: Fraction;
  /** Expected COST per hour, cents (positive = costs money, like perRollCents): amount x per-roll edge x rollsPerHour, x 392/557 for bets off on come-outs. */
  perHourCents: Fraction;
  rollsPerHour: number;
  headline: string;
  detail: string;
  alternative: Alternative | null;
  explanation: Explanation;
}

export interface PreviewOptions {
  /** default 100 */
  rollsPerHour?: number;
}
