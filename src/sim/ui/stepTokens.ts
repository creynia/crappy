import { isWorking } from '../engine/working';
import type { GameState } from '../engine/types';
import { betEV, edgeOfBet } from '../math/ev';
import { ZERO, add } from '../math/fraction';
import type { BetCtx } from '../math/types';
import { fmtMoney, fmtPct, fracToNumber } from './text';

/** Resolves a `{{name}}` or `{{name:arg}}` token to display text, or undefined to leave it as written. */
export type TokenResolver = (name: string, arg?: string) => string | undefined;

/**
 * Live values for step text, from the current table. Computed lazily: EV and edge are only worked out
 * for the tokens a step actually uses.
 *   {{bankroll}}  cash on hand          {{point}}      the point, or "off"
 *   {{onTable}}   chips on the table    {{session}}    won minus lost this session
 *   {{ev:T}}      EV of your working T bets ("no bet" if none)
 *   {{edge:T}}    house edge of your T bet (first one on the table)
 */
export function resolverFor(state: GameState): TokenResolver {
  const ctx: BetCtx = { phase: state.phase, point: state.point, rules: state.rules };
  const bets = (type: string) => state.bets.filter((b) => b.type === type && isWorking(b, state));
  return (name, arg) => {
    switch (name) {
      case 'bankroll':
        return fmtMoney(state.bankroll);
      case 'point':
        return state.point === null ? 'off' : String(state.point);
      case 'onTable':
        return fmtMoney(state.bets.reduce((t, b) => t + b.amount, 0));
      case 'session':
        return fmtMoney(state.stats.totalWon - state.stats.totalLost, { sign: true });
      case 'ev': {
        const list = bets(arg ?? '');
        if (list.length === 0) return 'no bet';
        const total = list.reduce((acc, b) => add(acc, betEV(b, ctx)), ZERO);
        return fmtMoney(fracToNumber(total), { sign: true, exact: true });
      }
      case 'edge': {
        const list = bets(arg ?? '');
        if (list.length === 0) return 'no bet';
        return fmtPct(fracToNumber(edgeOfBet(list[0]!, ctx).perResolved));
      }
      default:
        return undefined;
    }
  };
}
