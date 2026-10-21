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
      if (item.kind === 'ways') expect(r.explain).toContain(`${item.combos.length} ways`);
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
});
