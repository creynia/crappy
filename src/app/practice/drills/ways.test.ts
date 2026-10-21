import { describe, expect, it } from 'vitest';
import { POINT_NUMBERS } from '../../../sim/engine';
import { WAYS, pointWinProb } from '../../../sim/math';
import { createDrillRng, type DrillRng } from '../rng';
import { ways, pairsFor, type WaysItem } from './ways';

// defineDrill erases the item type, so the test names the generator's signature.
const generate = (rng: DrillRng, level: number): WaysItem =>
  (ways.generate as unknown as (r: DrillRng, l: number) => WaysItem)(rng, level);
const gen = (level: number, n = 400): WaysItem[] => {
  const items: WaysItem[] = [];
  for (let i = 0; i < n; i++) items.push(generate(createDrillRng(i + 1), level));
  return items;
};

describe('ways drill', () => {
  it('pairsFor lists every ordered pair that sums to the total', () => {
    expect(pairsFor(7)).toHaveLength(6);
    expect(pairsFor(2)).toEqual([[1, 1]]);
    expect(pairsFor(12)).toEqual([[6, 6]]);
  });

  it('covers the totals 2 to 12 and every point', () => {
    const items = gen(3, 800);
    const totals = new Set(items.filter((i) => i.kind === 'ways').map((i) => i.total));
    for (let t = 2; t <= 12; t++) expect(totals.has(t)).toBe(true);
    const points = new Set(items.filter((i) => i.kind === 'point').map((i) => i.point));
    for (const p of POINT_NUMBERS) expect(points.has(p)).toBe(true);
  });

  it('answers match WAYS and pointWinProb', () => {
    for (const item of gen(3)) {
      if (item.kind === 'ways') {
        expect(item.answerId).toBe(String(WAYS[item.total]));
        expect(item.combos.length).toBe(WAYS[item.total]);
      }
      if (item.kind === 'point') {
        const p = pointWinProb(item.point!);
        expect(item.answerId).toBe(`${p.n}/${p.d}`);
      }
    }
  });

  it('the correct choice is offered once and explanations name the combinations', () => {
    for (const item of gen(3, 200)) {
      const ids = item.answer.kind === 'choice' ? item.answer.choices.map((c) => c.id) : [];
      expect(ids).toContain(item.answerId);
      expect(new Set(ids).size).toBe(ids.length);
      const r = ways.check(item, item.answerId);
      expect(r.ok).toBe(true);
      if (item.kind === 'ways') expect(r.explain).toContain(`${item.combos.length} way`);
      if (item.kind === 'hard') expect(r.explain).toContain('equal dice');
    }
  });

  it('hard-way answers are equal pairs; a wrong answer fails', () => {
    for (const item of gen(3, 200).filter((i) => i.kind === 'hard')) {
      const [a, b] = item.answerId.split('-');
      expect(a).toBe(b);
      expect(ways.check(item, 'nope').ok).toBe(false);
    }
  });

  it('point questions always offer four choices with the right one among them', () => {
    const points = gen(3, 800).filter((i) => i.kind === 'point');
    expect(points.length).toBeGreaterThan(50);
    for (const item of points) {
      const choices = item.answer.kind === 'choice' ? item.answer.choices : [];
      expect(choices).toHaveLength(4);
      expect(new Set(choices.map((c) => c.label)).size).toBe(4);
    }
  });

  it('a wrong answer reports the right answer as its label, not its id', () => {
    for (const item of gen(3, 200)) {
      const r = ways.check(item, 'nope');
      expect(r.expected).toBe(item.answerLabel);
      expect(r.correct).toBe(item.answerId);
      const choice =
        item.answer.kind === 'choice'
          ? item.answer.choices.find((c) => c.id === item.answerId)
          : undefined;
      expect(choice?.label).toBe(item.answerLabel);
    }
  });

  it('hard-way choices carry dice pictures', () => {
    for (const item of gen(3, 200).filter((i) => i.kind === 'hard')) {
      const choices = item.answer.kind === 'choice' ? item.answer.choices : [];
      for (const c of choices) expect(c.dice).toBeDefined();
    }
  });

  it('the same seed and level give the same item', () => {
    for (let level = 1; level <= 3; level++)
      for (let seed = 1; seed <= 30; seed++) {
        expect(generate(createDrillRng(seed), level)).toEqual(
          generate(createDrillRng(seed), level),
        );
      }
  });

  it('explanations use singular "way" and "out of every" wording', () => {
    const all = gen(3, 400);
    for (const item of all) {
      const r = ways.check(item, item.answerId);
      expect(r.explain).not.toMatch(/\b1 ways\b/);
      if (item.kind === 'point') expect(r.explain).toMatch(/ out of every \d+/);
      if (item.kind === 'hard') expect(r.explain).toMatch(/The easy way to roll \d+ is/);
    }
  });
});
