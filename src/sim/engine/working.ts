import { BET_TYPES, isToggleable } from './bets';
import type { Bet, GameState } from './types';

/** Whether a bet is "working" (can win/lose) on the next roll. */
export function isWorking(bet: Bet, state: GameState): boolean {
  if (!isToggleable(bet.type)) return true;
  if (bet.working === 'on') return true;
  if (bet.working === 'off') return false;
  if (state.phase === 'point') return true;
  const cat = BET_TYPES[bet.type].category;
  if (cat === 'place' || cat === 'buy') return state.rules.placeBetsWorkOnComeOut;
  if (cat === 'hardway') return state.rules.hardwaysWorkOnComeOut;
  if (bet.type === 'come-odds') return state.rules.comeOddsWorkOnComeOut;
  return true;
}
