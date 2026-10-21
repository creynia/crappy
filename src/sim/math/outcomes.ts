import { BET_TYPES, isBonusType, upfrontVig } from '../engine/bets';
import { bonusDistribution } from './bonus';
import type {
  Bet,
  BetTypeId,
  Cents,
  Dice,
  Phase,
  PointNumber,
  Resolution,
  RollContext,
  TableRules,
} from '../engine/types';
import { POINT_NUMBERS } from '../engine/types';
import { ALL_DICE, ways } from './dice';
import { add, frac, mul, ONE, ZERO, type Fraction } from './fraction';
import type { BetCtx, BetLike, Outcome } from './types';

/** An outcome row plus bookkeeping the public Outcome type does not carry. */
export interface RawOutcome {
  label: string;
  probability: Fraction;
  net: Fraction;
  push: boolean;
  /** Dice combinations producing this row, out of the deciding combinations (unreduced). Absent for compound rows. */
  ways?: number;
  outOf?: number;
}
export interface Distribution {
  rows: RawOutcome[];
  /** E[rolls until resolution], assuming the bet works on every roll */
  expectedRolls: Fraction;
  /** upfront vig already charged at placement (cents), included in every row's net */
  vigPaid: Cents;
}

const COMES = new Set<BetTypeId>(['come', 'dont-come']);
const LINES = new Set<BetTypeId>(['pass-line', 'dont-pass']);
const ODDS = new Set<BetTypeId>(['pass-odds', 'dont-pass-odds', 'come-odds', 'dont-come-odds']);

export function isOddsType(t: BetTypeId): boolean {
  return ODDS.has(t);
}
/** Bets whose edge is measured from a come-out (they may set / travel to a point first). */
export function isLineLike(t: BetTypeId): boolean {
  return LINES.has(t) || COMES.has(t);
}

function synth(type: BetTypeId, amount: Cents, point: PointNumber | null, vigPaid: Cents): Bet {
  return {
    id: 'math',
    type,
    amount,
    point,
    parentId: null,
    working: 'on',
    placedOnRoll: 0,
    vigPaid,
  };
}

function rollCtx(dice: Dice, phase: Phase, point: PointNumber | null): RollContext {
  return { dice, total: dice[0] + dice[1], hard: dice[0] === dice[1], phase, point };
}

function totalsText(dice: Dice[]): string {
  const byTotal = new Map<number, Dice[]>();
  for (const d of dice) {
    const t = d[0] + d[1];
    byTotal.set(t, [...(byTotal.get(t) ?? []), d]);
  }
  const parts: string[] = [];
  for (const t of [...byTotal.keys()].sort((a, b) => a - b)) {
    const group = byTotal.get(t) as Dice[];
    if (group.length === ways(t) || ways(t) === 1) parts.push(String(t));
    else if (group.every((d) => d[0] === d[1])) parts.push(`hard ${t}`);
    else parts.push(`easy ${t}`);
  }
  if (parts.length <= 2) return parts.join(' or ');
  return `${parts.slice(0, -1).join(', ')} or ${parts[parts.length - 1]}`;
}

interface Group {
  res: Resolution;
  dice: Dice[];
}

function enumerate(
  bet: Bet,
  phase: Phase,
  point: PointNumber | null,
  rules: TableRules,
): { groups: Group[]; none: Dice[] } {
  const def = BET_TYPES[bet.type];
  const groups = new Map<string, Group>();
  const none: Dice[] = [];
  for (const dice of ALL_DICE) {
    const res = def.resolve(bet, rollCtx(dice, phase, point), rules, true);
    if (res.kind === 'none') {
      none.push(dice);
      continue;
    }
    const key =
      res.kind === 'win'
        ? `win|${res.profit}|${res.vig}`
        : res.kind === 'travel'
          ? `travel|${res.point}`
          : res.kind;
    const g = groups.get(key);
    if (g) g.dice.push(dice);
    else groups.set(key, { res, dice: [dice] });
  }
  return { groups: [...groups.values()], none };
}

function distribution(
  bet: Bet,
  phase: Phase,
  point: PointNumber | null,
  rules: TableRules,
  prefix: string,
): Distribution {
  const { groups, none } = enumerate(bet, phase, point, rules);
  const vigPaid = bet.vigPaid;
  const immediate: { w: number; row: Omit<RawOutcome, 'probability'> }[] = [];
  const continuing: { w: number; sub: Distribution }[] = [];
  let resolvingWays = 0;

  for (const g of groups) {
    const res = g.res;
    const w = g.dice.length;
    if (res.kind === 'travel') {
      const sub = distribution(
        synth(bet.type, bet.amount, res.point, vigPaid),
        'point',
        res.point,
        rules,
        `${prefix}Point ${res.point}, then `,
      );
      continuing.push({ w, sub });
      continue;
    }
    resolvingWays += w;
    const text = totalsText(g.dice);
    if (res.kind === 'win') {
      immediate.push({
        w,
        row: {
          label: `${prefix}Win on ${text}`,
          net: frac(res.profit - res.vig - vigPaid),
          push: false,
        },
      });
    } else if (res.kind === 'lose') {
      immediate.push({
        w,
        row: { label: `${prefix}Lose on ${text}`, net: frac(-bet.amount - vigPaid), push: false },
      });
    } else {
      immediate.push({
        w,
        row: { label: `${prefix}Push on ${text}`, net: frac(-vigPaid), push: true },
      });
    }
  }

  // A line bet on its come-out: rolls that leave it alone establish a point and continue.
  if (phase === 'come-out' && LINES.has(bet.type)) {
    for (const n of POINT_NUMBERS) {
      const w = none.filter((d) => d[0] + d[1] === n).length;
      if (w === 0) continue;
      const sub = distribution(
        synth(bet.type, bet.amount, null, vigPaid),
        'point',
        n,
        rules,
        `${prefix}Point ${n}, then `,
      );
      continuing.push({ w, sub });
    }
  }

  if (continuing.length > 0) {
    const rows: RawOutcome[] = immediate.map(({ w, row }) => ({
      ...row,
      probability: frac(w, 36),
      ways: w,
      outOf: 36,
    }));
    let rolls = ZERO;
    for (const c of continuing) {
      const p = frac(c.w, 36);
      for (const r of c.sub.rows) {
        const { ways: _w, outOf: _o, ...rest } = r;
        rows.push({ ...rest, probability: mul(r.probability, p) });
      }
      rolls = add(rolls, mul(p, c.sub.expectedRolls));
    }
    return { rows, expectedRolls: add(ONE, rolls), vigPaid };
  }

  if (resolvingWays === 0) throw new Error(`bet ${bet.type} never resolves`);
  // Single-state bet: condition on the rolls that resolve it.
  return {
    rows: immediate.map(({ w, row }) => ({
      ...row,
      probability: frac(w, resolvingWays),
      ways: w,
      outOf: resolvingWays,
    })),
    expectedRolls: frac(36, resolvingWays),
    vigPaid,
  };
}

const cache = new Map<string, Distribution>();
const rulesKeys = new WeakMap<object, string>();
function rulesKey(rules: TableRules): string {
  let k = rulesKeys.get(rules);
  if (!k) {
    k = JSON.stringify({ f: rules.fieldPays, v: rules.vig, u: rules.payoutUnit });
    rulesKeys.set(rules, k);
  }
  return k;
}

export function distributionFor(bet: BetLike, ctx: BetCtx): Distribution {
  if (isBonusType(bet.type)) return bonusDistribution(bet.type, bet.amount, bet.progress);
  const key = `${bet.type}|${bet.amount}|${bet.point}|${ctx.phase}|${ctx.point}|${rulesKey(ctx.rules)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const vigPaid = upfrontVig(bet.type, bet.amount, ctx.rules);
  const t = bet.type;
  let d: Distribution;
  if (LINES.has(t) && ctx.phase === 'come-out') {
    d = distribution(synth(t, bet.amount, null, vigPaid), 'come-out', null, ctx.rules, '');
  } else if (LINES.has(t)) {
    d = distribution(synth(t, bet.amount, null, vigPaid), 'point', ctx.point, ctx.rules, '');
  } else if (COMES.has(t)) {
    // Come box (point null) or already on a number.
    d = distribution(
      synth(t, bet.amount, bet.point, vigPaid),
      'point',
      bet.point ?? ctx.point ?? 6,
      ctx.rules,
      '',
    );
  } else if (ODDS.has(t)) {
    const p = bet.point ?? ctx.point;
    if (p === null) throw new Error(`${t} needs a point`);
    d = distribution(synth(t, bet.amount, p, vigPaid), 'point', p, ctx.rules, '');
  } else {
    d = distribution(
      synth(t, bet.amount, bet.point, vigPaid),
      'point',
      ctx.point ?? 6,
      ctx.rules,
      '',
    );
  }
  if (cache.size > 5000) cache.clear();
  cache.set(key, d);
  return d;
}

export function toOutcomes(d: Distribution): Outcome[] {
  return d.rows.map((r) => ({
    label: r.label,
    // Dice combinations out of the rolls that decide the bet ("1 of 9", "5 of 11"; "6 of 36" for
    // one-roll bets). Compound rows (line / come bets) fall back to the reduced probability.
    ways: r.ways ?? Number(r.probability.n),
    outOf: r.outOf ?? Number(r.probability.d),
    probability: r.probability,
    net: r.net,
  }));
}
