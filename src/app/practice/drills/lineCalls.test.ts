import { describe, expect, it } from 'vitest';
import { POINT_NUMBERS, type Dice, type Die, type PointNumber } from '../../../sim/engine';
import { createDrillRng } from '../rng';
import { createRound } from '../round';
import { lineCalls, resolveLineBet, type LineCallItem, type LineOutcome } from './lineCalls';

// Independent statement of the line-bet rules, to cross-check the engine-derived answers.
function rule(
  bet: 'pass-line' | 'dont-pass',
  point: PointNumber | null,
  total: number,
): LineOutcome {
  if (point === null) {
    if (total === 7 || total === 11) return bet === 'pass-line' ? 'win' : 'lose';
    if (total === 2 || total === 3) return bet === 'pass-line' ? 'lose' : 'win';
    if (total === 12) return bet === 'pass-line' ? 'lose' : 'push';
    return 'none';
  }
  if (total === point) return bet === 'pass-line' ? 'win' : 'lose';
  if (total === 7) return bet === 'pass-line' ? 'lose' : 'win';
  return 'none';
}

const ALL: Dice[] = [];
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) ALL.push([a as Die, b as Die]);

describe('line calls drill', () => {
  it('engine answers match the rules for every bet, point and roll', () => {
    for (const bet of ['pass-line', 'dont-pass'] as const)
      for (const point of [null, ...POINT_NUMBERS])
        for (const d of ALL)
          expect([bet, point, d, resolveLineBet(bet, point, d).outcome]).toEqual([
            bet,
            point,
            d,
            rule(bet, point, d[0] + d[1]),
          ]);
  });

  it('levels: 1 come-out pass only; 2 adds points; 3 adds don’t pass and push', () => {
    const items = (level: number) =>
      Array.from(
        { length: 300 },
        (_, s) => lineCalls.generate(createDrillRng(s), level) as LineCallItem,
      );
    const l1 = items(1);
    expect(l1.every((i) => i.point === null && i.bet === 'pass-line')).toBe(true);
    expect(new Set(l1.map((i) => i.outcome))).toEqual(new Set(['win', 'lose', 'none']));
    const l2 = items(2);
    expect(l2.some((i) => i.point !== null)).toBe(true);
    expect(l2.every((i) => i.bet === 'pass-line')).toBe(true);
    const l3 = items(3);
    expect(l3.some((i) => i.bet === 'dont-pass')).toBe(true);
    expect(l3.some((i) => i.outcome === 'push')).toBe(true);
    for (const i of [...l1, ...l2, ...l3]) {
      expect(i.outcome).toBe(rule(i.bet, i.point, i.dice[0] + i.dice[1]));
      const ids = i.answer.kind === 'choice' ? i.answer.choices.map((c) => c.id) : [];
      expect(ids).toContain(i.outcome);
    }
  });

  it('checks answers and explains them', () => {
    const item = lineCalls.generate(createDrillRng(0), 1) as LineCallItem;
    const right = lineCalls.check(item, item.outcome);
    expect(right.ok).toBe(true);
    expect(right.explain).toMatch(/\d/);
    expect(lineCalls.check(item, 'nonsense').ok).toBe(false);

    const explain = (bet: 'pass-line' | 'dont-pass', point: PointNumber | null, dice: Dice) => {
      const { outcome, events } = resolveLineBet(bet, point, dice);
      return lineCalls.check(
        { ...item, bet, point, dice, outcome, events } as LineCallItem,
        outcome,
      ).explain;
    };
    expect(explain('pass-line', null, [3, 4])).toBe(
      '7 on the come-out is a natural (7 or 11). Pass Line wins even money.',
    );
    expect(explain('dont-pass', null, [6, 6])).toMatch(/barred on 12: it pushes/);
    expect(explain('pass-line', 6, [3, 4])).toBe(
      '7 before the point (6): seven-out. Pass Line loses.',
    );
    expect(explain('dont-pass', 6, [2, 4])).toMatch(/^6 is the point.*Don't Pass loses\.$/);
    expect(explain('pass-line', 6, [4, 5])).toMatch(/neither 7 nor the point \(6\)/);
    expect(explain('pass-line', null, [2, 2])).toMatch(/puck goes ON 4/);
  });

  it('builds a full round without repeated questions', () => {
    const r = createRound(lineCalls, { seed: 12345, level: 1 });
    expect(new Set(r.queue.map((e) => e.item.key)).size).toBe(10);
  });
});
