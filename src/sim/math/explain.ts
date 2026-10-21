import { BET_TYPES } from '../engine/bets';
import { betEV } from './ev';
import { fracText, money } from './format';
import { neg } from './fraction';
import { betOutcomes } from './ev';
import { rollEffectGrid, worksNow } from './outcomes';
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
  const note = notes.length > 0 ? notes.join(' ') : undefined;
  const out: Explanation = { rows, grid: rollEffectGrid(bet, ctx), evFormula };
  if (note !== undefined) out.note = note;
  if (!worksNow(bet, ctx)) {
    out.gridNote =
      bet.working === 'off'
        ? 'You turned this bet off, so no roll changes it.'
        : 'This bet is off on the come-out, so no roll changes it.';
  }
  return out;
}
