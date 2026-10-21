import { toNumber } from '../math/fraction';
import { previewAction } from '../math/preview';
import { isWorking } from '../engine/working';
import type { Bet, GameState } from '../engine/types';
import { workingCopy } from './text';

/** Working toggle props for a bet, with copy from the set-working preview (cost of turning it ON). */
export function workingProp(game: GameState, bet: Bet, rollsPerHour: number) {
  const on = isWorking(bet, game);
  const wp = previewAction(
    game,
    { type: 'set-working', betId: bet.id, working: on ? 'off' : 'on' },
    { rollsPerHour },
  );
  return { value: on, canToggle: true, copy: workingCopy(on, toNumber(wp.perRollCents)) };
}
