import { BET_TYPES } from '../engine/bets';
import { isWorking } from '../engine/working';
import type { Bet, GameState } from '../engine/types';
import { toNumber } from '../math/fraction';
import { previewAction } from '../math/preview';
import { workingCopy } from './text';

export interface WorkingProp {
  value: boolean;
  canToggle: boolean;
  copy?: string;
}

/** Working toggle props for a bet; the copy uses the set-working preview (cost of turning it ON). */
export function workingProp(game: GameState, bet: Bet, rollsPerHour: number): WorkingProp {
  const on = isWorking(bet, game);
  const wp = previewAction(
    game,
    { type: 'set-working', betId: bet.id, working: on ? 'off' : 'on' },
    { rollsPerHour },
  );
  const copy = workingCopy({
    on,
    perRollCents: toNumber(wp.perRollCents),
    phase: game.phase,
    playerOff: bet.working === 'off',
    type: bet.type,
    vigSunk: BET_TYPES[bet.type].category === 'buy' && bet.vigPaid > 0,
  });
  return { value: on, canToggle: true, ...(copy ? { copy } : {}) };
}
