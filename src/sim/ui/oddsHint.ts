import { maxOddsAmount } from '../engine/validate';
import type { BetTypeId, Cents, GameState } from '../engine/types';

const FLAT_WITH_ODDS: BetTypeId[] = ['pass-line', 'dont-pass', 'come', 'dont-come'];
const LABEL: Partial<Record<BetTypeId, string>> = {
  'pass-line': 'Pass line',
  'dont-pass': "Don't pass",
  come: 'Come',
  'dont-come': "Don't come",
};

export interface OddsRoom {
  betId: string;
  label: string;
  point: number;
  room: Cents;
}

/**
 * The first flat line/come bet on a point that still has odds room and no odds on it yet, or null.
 * Pure; the Simulator shows one nudge per flat bet and point.
 */
export function oddsRoom(game: GameState): OddsRoom | null {
  if (game.phase !== 'point') return null;
  for (const b of game.bets) {
    if (!FLAT_WITH_ODDS.includes(b.type) || b.amount <= 0) continue;
    const point = b.point ?? game.point;
    if (point === null || point === undefined) continue;
    if (game.bets.some((o) => o.parentId === b.id)) continue;
    const room = maxOddsAmount(game, b.id);
    if (room <= 0) continue;
    return { betId: b.id, label: LABEL[b.type]!, point, room };
  }
  return null;
}
