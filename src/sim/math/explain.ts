import { BET_TYPES } from '../engine/bets';
import type { PointNumber } from '../engine/types';
import { pointWinProb, ways } from './dice';
import { betEV, betOutcomes } from './ev';
import { fracText, money } from './format';
import { add, div, neg, ZERO, type Fraction } from './fraction';
import { rollEffectGrid, worksNow } from './outcomes';
import type { BetCtx, BetLike, Explanation, Outcome, OutcomeTree, TreeLeaf } from './types';

const KIND_ORDER: Record<TreeLeaf['kind'], number> = { win: 0, lose: 1, push: 2 };

/** Row labels read "Win on 4", "Point 4, then Lose on 7": only the stem is shown under a point. */
function leafOf(r: Outcome): TreeLeaf {
  const label = r.label.replace(/^Point \d+, then /, '');
  const kind = label.startsWith('Win') ? 'win' : label.startsWith('Lose') ? 'lose' : 'push';
  return { label, kind, probability: r.probability, net: r.net };
}
const byKind = (a: TreeLeaf, b: TreeLeaf) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind];

/** Group the rows by the point they went through (`via`); null when no row passes through a point. */
export function buildTree(rows: readonly Outcome[]): OutcomeTree | null {
  const comeOut: TreeLeaf[] = [];
  const byPoint = new Map<PointNumber, TreeLeaf[]>();
  for (const r of rows) {
    const leaf = leafOf(r);
    if (r.via === undefined) comeOut.push(leaf);
    else byPoint.set(r.via, [...(byPoint.get(r.via) ?? []), leaf]);
  }
  if (byPoint.size === 0) return null;
  const points = [...byPoint.keys()]
    .sort((x, y) => x - y)
    .map((point) => {
      const leaves = (byPoint.get(point) as TreeLeaf[]).sort(byKind);
      const probability = leaves.reduce((acc, l) => add(acc, l.probability), ZERO);
      for (const l of leaves) l.given = div(l.probability, probability);
      return { point, probability, ways: ways(point), pMake: pointWinProb(point), leaves };
    });
  comeOut.sort(byKind);
  const total = (k: TreeLeaf['kind']): Fraction =>
    [...comeOut, ...points.flatMap((p) => p.leaves)]
      .filter((l) => l.kind === k)
      .reduce((acc, l) => add(acc, l.probability), ZERO);
  return {
    comeOut,
    points,
    totals: { win: total('win'), lose: total('lose'), push: total('push') },
  };
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
  if (def.category === 'bonus') {
    notes.push(
      bet.type === 'fire'
        ? 'Bonus bet on the whole hand: a point made twice counts once; it is decided when the shooter sevens out (or at once on the 6th point).'
        : 'Bonus bet on the whole hand: every 7 loses it, come-out rolls included; it pays at once on the last number.',
    );
  }
  const note = notes.length > 0 ? notes.join(' ') : undefined;
  const tree = buildTree(rows);
  const out: Explanation = { rows, grid: rollEffectGrid(bet, ctx), evFormula };
  if (tree) out.tree = tree;
  if (note !== undefined) out.note = note;
  if (!worksNow(bet, ctx)) {
    out.gridNote =
      bet.working === 'off'
        ? 'You turned this bet off, so no roll changes it.'
        : 'This bet is off on the come-out, so no roll changes it.';
  }
  return out;
}
