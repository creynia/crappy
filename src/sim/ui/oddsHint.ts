import { maxOddsAmount, oddsPoint } from '../engine/validate';
import { payRatio } from '../engine/bets';
import type { BetTypeId, Cents, GameState } from '../engine/types';

const ODDS_FOR: Partial<Record<BetTypeId, BetTypeId>> = {
  'pass-line': 'pass-odds',
  'dont-pass': 'dont-pass-odds',
  come: 'come-odds',
  'dont-come': 'dont-come-odds',
};
const LABEL: Partial<Record<BetTypeId, string>> = {
  'pass-line': 'Pass line',
  'dont-pass': "Don't pass",
  come: 'Come',
  'dont-come': "Don't come",
};

export interface OddsRoom {
  betId: string;
  type: BetTypeId;
  label: string;
  point: number;
  /** the most the learner can add now: the table cap, limited by the bankroll, in whole odds units */
  room: Cents;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * The first flat line/come bet on a point that has no odds yet and room to add some, or null.
 * Pure; the Simulator shows one nudge per mount.
 */
export function oddsRoom(game: GameState): OddsRoom | null {
  if (game.phase !== 'point') return null;
  for (const b of game.bets) {
    const oddsType = ODDS_FOR[b.type];
    if (!oddsType || b.amount <= 0) continue;
    if (game.bets.some((o) => o.parentId === b.id)) continue;
    const point = oddsPoint(game, b);
    if (point === null) continue;
    const ratio = payRatio(oddsType, point);
    const unit = ratio ? (ratio[1] / gcd(ratio[0], ratio[1])) * 100 : 100;
    const room = Math.floor(Math.min(maxOddsAmount(game, b.id), game.bankroll) / unit) * unit;
    if (room <= 0) continue;
    return { betId: b.id, type: b.type, label: LABEL[b.type]!, point, room };
  }
  return null;
}
