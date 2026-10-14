import type { Action, BetTypeId, Cents, GameState } from '../engine/types';
import type { Fraction } from './fraction';
import type {
  ActionPreview,
  Alternative,
  BetCtx,
  BetLike,
  EdgeInfo,
  EdgeTier,
  Explanation,
  Outcome,
} from './types';

export * from './fraction';
export type * from './types';

export function betOutcomes(_bet: BetLike, _ctx: BetCtx): Outcome[] {
  throw new Error('TODO(math)');
}
/** cents */
export function betEV(_bet: BetLike, _ctx: BetCtx): Fraction {
  throw new Error('TODO(math)');
}
/** Edge of a NEW bet in ctx. */
export function betEdge(_type: BetTypeId, _amount: Cents, _ctx: BetCtx): EdgeInfo {
  throw new Error('TODO(math)');
}
/** cents per roll; pass to engine applyAction as `expectedLossFn` after toNumber. */
export function tableExpectedLossPerRoll(_state: GameState): Fraction {
  throw new Error('TODO(math)');
}
export function previewAction(_state: GameState, _action: Action): ActionPreview {
  throw new Error('TODO(math)');
}
export function suggestAlternative(
  _state: GameState,
  _action: Extract<Action, { type: 'place-bet' }>,
): Alternative | null {
  throw new Error('TODO(math)');
}
export function explainBet(_bet: BetLike, _ctx: BetCtx): Explanation {
  throw new Error('TODO(math)');
}
export function edgeTier(_edge: Fraction): EdgeTier {
  throw new Error('TODO(math)');
}
