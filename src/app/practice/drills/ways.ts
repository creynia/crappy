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
  /** the correct answer's id (a number as text, "n in d", or "a-b" dice) */
  answerId: string;
  /** combinations, for the explanation */
  combos: string[];
}

const TOTALS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

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

/** "n in d" for the chance of the point before a 7 (W / (W + 6)). */
function chanceText(point: PointNumber): { id: string; text: string } {
  const p = pointWinProb(point);
  return { id: `${p.n}/${p.d}`, text: `${p.n} in ${p.d}` };
}

function distractors<T>(rng: DrillRng, correct: T, pool: readonly T[], n: number): T[] {
  const others = pool.filter((x) => x !== correct);
  return rng.shuffle(others).slice(0, n);
}

function choicesOf(rng: DrillRng, items: { id: string; label: string }[]): Choice[] {
  return rng.shuffle(items).map((c) => ({ id: c.id, label: c.label }));
}

function generate(rng: DrillRng, level: number): WaysItem {
  const kinds: WaysKind[] =
    level === 1 ? ['ways'] : level === 2 ? ['ways', 'point'] : ['ways', 'point', 'hard'];
  const kind = rng.pick(kinds);
  if (kind === 'ways') {
    const total = rng.pick(TOTALS);
    const correct = WAYS[total] ?? 0;
    const wrong = distractors(rng, correct, [1, 2, 3, 4, 5, 6], 3);
    const choices = choicesOf(
      rng,
      [correct, ...wrong].map((n) => ({
        id: String(n),
        label: `${n} ${n === 1 ? 'way' : 'ways'}`,
      })),
    );
    return {
      key: `ways|${total}`,
      prompt: `How many ways can two dice total ${total}?`,
      visuals: [],
      answer: { kind: 'choice', choices },
      kind,
      total,
      answerId: String(correct),
      combos: pairsFor(total).map(pairText),
    };
  }
  if (kind === 'point') {
    const point = rng.pick(POINT_NUMBERS);
    const right = chanceText(point);
    const pool = POINT_NUMBERS.map((p) => chanceText(p));
    const wrong = distractors(rng, right, pool, 3);
    // distractors by text, so the same fraction is not offered twice
    const seen = new Set([right.text]);
    const wrongUnique = wrong.filter((w) => (seen.has(w.text) ? false : (seen.add(w.text), true)));
    const choices = choicesOf(
      rng,
      [right, ...wrongUnique].map((c) => ({ id: c.id, label: c.text })),
    );
    return {
      key: `point|${point}`,
      prompt: `The point is ${point}. What is the chance it rolls before a 7?`,
      visuals: [{ kind: 'puck', point }],
      answer: { kind: 'choice', choices },
      kind,
      total: point,
      point,
      answerId: right.id,
      combos: pairsFor(point).map(pairText),
    };
  }
  // hard way: the pair of equal dice for an even total of 4 to 10
  const hardTotals = [4, 6, 8, 10] as const;
  const total = rng.pick(hardTotals);
  const hard = [total / 2, total / 2] as Dice;
  const easy = pairsFor(total).filter((d) => d[0] !== d[1]);
  const wrong = distractors(rng, hard, easy, 3);
  const choices = choicesOf(
    rng,
    [hard, ...wrong].map((d) => ({ id: `${d[0]}-${d[1]}`, label: pairText(d) })),
  );
  return {
    key: `hard|${total}`,
    prompt: `Which pair is a hard ${total}?`,
    visuals: [],
    answer: { kind: 'choice', choices },
    kind,
    total,
    answerId: `${hard[0]}-${hard[1]}`,
    combos: pairsFor(total).map(pairText),
  };
}

function explain(item: WaysItem): string {
  if (item.kind === 'ways')
    return `${item.total} comes from ${item.combos.join(', ')}: ${item.combos.length} ways.`;
  if (item.kind === 'point') {
    const p = pointWinProb(item.point!);
    return `The point ${item.point} comes up in ${WAYS[item.point!]} ways and a 7 in 6 ways, so it rolls first ${p.n} times in ${p.d}.`;
  }
  return `A hard ${item.total} is a pair of equal dice: ${item.total / 2} and ${item.total / 2}. ${item.total} the easy way is ${item.combos.filter((c) => c !== `${item.total / 2} and ${item.total / 2}`).join(', ')}.`;
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
      expected: item.answerId,
      correct: item.answerId,
      explain: explain(item),
    };
  },
});
