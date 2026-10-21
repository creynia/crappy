import { BET_TYPES } from '../engine/bets';
import { betEV } from './ev';
import { fracText, money } from './format';
import { neg } from './fraction';
import { betOutcomes } from './ev';
import type { BetCtx, BetLike, Explanation } from './types';

export function explainBet(bet: BetLike, ctx: BetCtx): Explanation {
  const rows = betOutcomes(bet, ctx);
  const ev = betEV(bet, ctx);
  let formula = '';
  for (const r of rows) {
    if (r.net.n === 0n) continue;
    const negative = r.net.n < 0n;
    const term = `${fracText(r.probability)} × ${money(negative ? neg(r.net) : r.net)}`;
    formula +=
      formula === '' ? (negative ? `-${term}` : term) : negative ? ` − ${term}` : ` + ${term}`;
  }
  if (formula === '') formula = '0';
  const evFormula = `${formula} = ${money(ev)}`;

  const def = BET_TYPES[bet.type];
  const notes: string[] = [];
  if (def.category === 'odds') {
    notes.push('Odds pay true odds, so the house has no edge.');
  }
  if (def.category === 'buy' || def.category === 'lay') {
    notes.push(
      ctx.rules.vig.timing === 'on-win'
        ? 'The 5% vig (rounded down to whole dollars, $1 minimum) is charged only when the bet wins.'
        : 'The vig is paid up front, when you place the bet.',
    );
  }
  if (
    bet.type === 'pass-line' ||
    bet.type === 'dont-pass' ||
    bet.type === 'come' ||
    bet.type === 'dont-come'
  ) {
    if (
      bet.point === null &&
      (ctx.phase === 'come-out' || bet.type === 'come' || bet.type === 'dont-come')
    ) {
      notes.push('Covers the come-out roll and, if a point is set, the wait for the point or a 7.');
    }
  }
  if (def.oneRoll) notes.push('One-roll bet: its edge is paid on every roll.');
  if (def.category === 'bonus') {
    notes.push(
      bet.type === 'fire'
        ? 'Bonus bet on the whole hand: a point made twice counts once; it is decided when the shooter sevens out (or at once on the 6th point).'
        : 'Bonus bet on the whole hand: every 7 loses it, come-out rolls included; it pays at once on the last number.',
    );
  }
  const note = notes.length > 0 ? notes.join(' ') : undefined;
  return note === undefined ? { rows, evFormula } : { rows, evFormula, note };
}
