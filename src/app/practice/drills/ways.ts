// Drill: ways and probability. How many ways to roll a total, the chance of the point before a 7,
// and which pair is a hard way. The answers come from the simulator's dice math (WAYS, pointWinProb),
// and each explanation lists the combinations, so the learner can count them.
import { WAYS, pointWinProb } from '../../../sim/math';
import { POINT_NUMBERS } from '../../../sim/engine';
import type { Dice, Die, PointNumber } from '../../../sim/engine';
import { defineDrill, type Choice, type DrillItem } from '../types';
import type { DrillRng } from '../rng';

type WaysKind = 'ways' | 'point' | 'hard';

export interface WaysItem extends DrillItem {
  kind: WaysKind;
  /** ways: the total; point: the point number; hard: the total of the hard way */
  total: number;
  point?: PointNumber;
  /** the correct choice's id (a number as text, "n/d", or "a-b" dice) */
  answerId: string;
  /** the correct choice's label, shown to a learner who answers wrong */
  answerLabel: string;
  /** combinations, for the explanation */
  combos: string[];
}

const TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const HARD_TOTALS = [4, 6, 8, 10] as const;

/** Every ordered dice pair that sums to the total. */
export function pairsFor(total: number): Dice[] {
  const out: Dice[] = [];
  for (let a = 1; a <= 6; a++) {
    const b = total - a;
    if (b >= 1 && b <= 6) out.push([a as Die, b as Die]);
  }
  return out;
}

const pairText = (d: Dice) => `${d[0]} and ${d[1]}`;
const oneWay = (n: number) => (n === 1 ? '1 way' : `${n} ways`);

/** The chance of the point before a 7 as "n in d" (W / (W + 6)). */
function chanceOf(point: PointNumber): { id: string; text: string } {
  const p = pointWinProb(point);
  return { id: `${p.n}/${p.d}`, text: `${p.n} in ${p.d}` };
}

/** Up to `n` distinct options from `pool`, excluding `exclude` (compared by id). */
function distinctOthers<T extends { id: string }>(
  rng: DrillRng,
  exclude: string,
  pool: readonly T[],
  n: number,
): T[] {
  const seen = new Set([exclude]);
  const out: T[] = [];
  for (const x of rng.shuffle(pool)) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push(x);
    if (out.length === n) break;
  }
  return out;
}

/** Four choices, the right one among them, in a random order. */
function fourChoices(rng: DrillRng, right: Choice, others: readonly Choice[]): Choice[] {
  return rng.shuffle([right, ...others.slice(0, 3)]);
}

function generate(rng: DrillRng, level: number): WaysItem {
  const kinds: WaysKind[] =
    level === 1 ? ['ways'] : level === 2 ? ['ways', 'point'] : ['ways', 'point', 'hard'];
  const kind = rng.pick(kinds);
  if (kind === 'ways') {
    const total = rng.pick(TOTALS);
    const right = WAYS[total] ?? 0;
    const pool = [1, 2, 3, 4, 5, 6].map((n) => ({ id: String(n), label: oneWay(n) }));
    const choices = fourChoices(
      rng,
      { id: String(right), label: oneWay(right) },
      distinctOthers(rng, String(right), pool, 3),
    );
    return {
      key: `ways|${total}`,
      prompt: `How many ways can two dice total ${total}?`,
      visuals: [],
      answer: { kind: 'choice', choices },
      kind,
      total,
      answerId: String(right),
      answerLabel: oneWay(right),
      combos: pairsFor(total).map(pairText),
    };
  }
  if (kind === 'point') {
    const point = rng.pick(POINT_NUMBERS);
    const right = chanceOf(point);
    const pool: Choice[] = [
      ...POINT_NUMBERS.map((p) => chanceOf(p)),
      { id: '1/2', text: '1 in 2' },
      { id: '3/5', text: '3 in 5' },
    ].map((c) => ('text' in c ? { id: c.id, label: c.text } : c));
    // dedupe by the text shown (6 and 8 both read "5 in 11"), and never offer the right text twice
    const byText = new Map<string, Choice>();
    for (const c of pool) if (!byText.has(c.label)) byText.set(c.label, c);
    byText.delete(right.text);
    const others = distinctOthers(rng, '', [...byText.values()], 3);
    const choices = fourChoices(rng, { id: right.id, label: right.text }, others);
    return {
      key: `point|${point}`,
      prompt: `The point is ${point}. What is the chance it rolls before a 7?`,
      visuals: [{ kind: 'puck', point }],
      answer: { kind: 'choice', choices },
      kind,
      total: point,
      point,
      answerId: right.id,
      answerLabel: right.text,
      combos: pairsFor(point).map(pairText),
    };
  }
  // hard way: the pair of equal dice for an even total of 4 to 10
  const total = rng.pick(HARD_TOTALS);
  const hard = [total / 2, total / 2] as Dice;
  const easy = pairsFor(total).filter((d) => d[0] !== d[1]);
  const asChoice = (d: Dice): Choice => ({
    id: `${d[0]}-${d[1]}`,
    label: pairText(d),
    dice: d,
  });
  const choices = fourChoices(rng, asChoice(hard), easy.slice(0, 3).map(asChoice));
  return {
    key: `hard|${total}`,
    prompt: `Which pair is a hard ${total}?`,
    visuals: [],
    answer: { kind: 'choice', choices },
    kind,
    total,
    answerId: `${hard[0]}-${hard[1]}`,
    answerLabel: pairText(hard),
    combos: pairsFor(total).map(pairText),
  };
}

function explain(item: WaysItem): string {
  if (item.kind === 'ways')
    return `${item.total} comes from ${item.combos.join(', ')}: ${oneWay(item.combos.length)}.`;
  if (item.kind === 'point') {
    const p = pointWinProb(item.point!);
    return `The point ${item.point} comes up in ${oneWay(WAYS[item.point!] ?? 0)} and a 7 in 6 ways, so it rolls first ${p.n} out of every ${p.d}.`;
  }
  const easy = item.combos.filter((c) => c !== `${item.total / 2} and ${item.total / 2}`);
  return `A hard ${item.total} is a pair of equal dice: ${item.total / 2} and ${item.total / 2}. The easy way to roll ${item.total} is ${easy.join(' or ')}.`;
}

export const ways = defineDrill<WaysItem, string>({
  id: 'ways',
  title: 'Ways and probability',
  summary: 'How many ways to roll it, the point before a 7, and hard ways.',
  levels: ['Totals', 'Totals and points', 'Add hard ways'],
  generate,
  check(item, answer) {
    return {
      ok: answer === item.answerId,
      expected: item.answerLabel,
      correct: item.answerId,
      explain: explain(item),
    };
  },
});
