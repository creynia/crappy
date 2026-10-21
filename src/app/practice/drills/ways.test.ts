import { describe, expect, it } from 'vitest';
import { WAYS, pointWinProb } from '../../../sim/math';
import { POINT_NUMBERS } from '../../../sim/engine';
import { createDrillRng } from '../rng';
import { ways, pairsFor } from './ways';

const gen = (level: number, n = 400) => {
  const items = [];
  for (let i = 0; i < n; i++) items.push(ways.generate(createDrillRng(i + 1), level));
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
    for (const it of gen(3)) {
      if (it.kind === 'ways') {
        expect(it.answerId).toBe(String(WAYS[it.total]));
        expect(it.combos.length).toBe(WAYS[it.total]);
      }
      if (it.kind === 'point') {
        const p = pointWinProb(it.point!);
        expect(it.answerId).toBe(`${p.n}/${p.d}`);
      }
    }
  });

  it('the correct choice is among the choices and explanations name the combinations', () => {
    for (const it of gen(3, 200)) {
      const ids = it.answer.kind === 'choice' ? it.answer.choices.map((c) => c.id) : [];
      expect(ids).toContain(it.answerId);
      expect(new Set(ids).size).toBe(ids.length);
      const r = ways.check(it, it.answerId);
      expect(r.ok).toBe(true);
      if (it.kind === 'ways') expect(r.explain).toContain(`${it.combos.length} ways`);
      if (it.kind === 'hard') expect(r.explain).toContain('equal dice');
    }
  });

  it('hard-way answers are equal pairs; the wrong answer fails', () => {
    for (const it of gen(3, 200).filter((i) => i.kind === 'hard')) {
      const [a, b] = it.answerId.split('-');
      expect(a).toBe(b);
      expect(ways.check(it, 'nope').ok).toBe(false);
    }
  });
});
