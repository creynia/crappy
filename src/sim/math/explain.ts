import { BET_TYPES } from '../engine/bets';
import { betEV } from './ev';
import { fracText, money } from './format';
import { neg } from './fraction';
import { betOutcomes } from './ev';
import { add, ZERO } from './fraction';
import type { BetCtx, BetLike, Explanation, OutcomeTree, TreeLeaf } from './types';
import type { PointNumber } from '../engine/types';

const POINT_PREFIX = /^Point (\d+), then (.*)$/;

/** Group the flat rows by the point they went through; null when no row passes through a point. */
export function buildTree(rows: ReturnType<typeof betOutcomes>): OutcomeTree | null {
  const comeOut: TreeLeaf[] = [];
  const byPoint = new Map<number, TreeLeaf[]>();
  for (const r of rows) {
    const m = POINT_PREFIX.exec(r.label);
    const leaf = { label: m ? (m[2] as string) : r.label, probability: r.probability, net: r.net };
    if (m) byPoint.set(Number(m[1]), [...(byPoint.get(Number(m[1])) ?? []), leaf]);
    else comeOut.push(leaf);
  }
  if (byPoint.size === 0) return null;
  const points = [...byPoint.keys()]
    .sort((a, b) => a - b)
    .map((n) => {
      const leaves = byPoint.get(n) as TreeLeaf[];
      return {
        point: n as PointNumber,
        probability: leaves.reduce((acc, l) => add(acc, l.probability), ZERO),
        leaves,
      };
    });
  return { comeOut, points };
}

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
  const tree = buildTree(rows);
  return {
    rows,
    ...(tree ? { tree } : {}),
    evFormula,
    ...(note === undefined ? {} : { note }),
  };
}
