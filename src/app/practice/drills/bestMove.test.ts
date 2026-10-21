import { describe, expect, it } from 'vitest';
import { previewAction, toNumber } from '../../../sim/math';
import { validateAction } from '../../../sim/engine';
import { createDrillRng } from '../rng';
import { bestMove, bestOf, MIN_MARGIN, type BestMoveItem } from './bestMove';

const item = (seed: number, level: number) =>
  bestMove.generate(createDrillRng(seed), level) as BestMoveItem;

describe('best move drill', () => {
  it('over 500 seeds per level the marked answer has the top EV per dollar, with no ties', () => {
    for (let level = 1; level <= bestMove.levels.length; level++) {
      for (let seed = 0; seed < 500; seed++) {
        const it_ = item(seed, level);
        expect(it_.options.length).toBeGreaterThanOrEqual(3);
        expect(it_.options.length).toBeLessThanOrEqual(4);
        const best = it_.options.find((o) => o.id === it_.best)!;
        for (const o of it_.options) {
          // every option is a legal action in the situation
          expect(validateAction(it_.state, o.action).ok, `${seed}/${level} ${o.label}`).toBe(true);
          if (o.id !== it_.best)
            expect(best.evPerDollar - o.evPerDollar, `${seed}/${level}`).toBeGreaterThanOrEqual(
              MIN_MARGIN,
            );
        }
        // choices are the options, with the same ids
        expect(it_.answer.kind).toBe('choice');
        if (it_.answer.kind === 'choice')
          expect(it_.answer.choices.map((c) => c.id).sort()).toEqual(
            it_.options.map((o) => o.id).sort(),
          );
      }
    }
  });

  it('prices every option with the bet sheet preview and reuses its headline', () => {
    for (let seed = 0; seed < 60; seed++) {
      const it_ = item(seed, 3);
      for (const o of it_.options) {
        const p = previewAction(it_.state, o.action);
        expect(o.headline).toBe(p.headline);
        expect(o.evCents).toBeCloseTo(toNumber(p.evCents), 9);
        expect(o.evPerDollar).toBeCloseTo(o.evCents / o.stake, 12);
      }
    }
  });

  it('checks answers and explains with the ranked headlines', () => {
    const it_ = item(7, 1);
    const right = bestMove.check(it_, it_.best);
    expect(right.ok).toBe(true);
    expect(right.correct).toBe(it_.best);
    const other = it_.options.find((o) => o.id !== it_.best)!;
    const wrong = bestMove.check(it_, other.id);
    expect(wrong.ok).toBe(false);
    expect(wrong.expected).toBe(it_.options.find((o) => o.id === it_.best)!.label);
    for (const o of it_.options) expect(wrong.explain).toContain(o.headline);
    expect(wrong.explain).toMatch(/^Ranked by expected value per dollar: 1\./);
  });

  it('level 1 always offers free odds and marks them best; level 3 prices taking down a winning DP', () => {
    for (let seed = 0; seed < 100; seed++) {
      const l1 = item(seed, 1);
      const odds = l1.options.find((o) => o.id === 'odds');
      if (odds) {
        expect(l1.best).toBe('odds');
        expect(odds.evCents).toBe(0);
        expect(odds.headline).toContain('no house edge');
      }
    }
    let seen = false;
    for (let seed = 0; seed < 200 && !seen; seed++) {
      const l3 = item(seed, 3);
      const down = l3.options.find((o) => o.id === 'take-down');
      if (!down) continue;
      seen = true;
      expect(down.headline).toMatch(/^Taking this down gives up \+?\$\d/);
      expect(down.evCents).toBeLessThan(0);
      expect(l3.best).toBe('lay-odds');
    }
    expect(seen).toBe(true);
  });

  it('bestOf rejects ties', () => {
    const o = (id: string, evPerDollar: number) =>
      ({
        id,
        label: id,
        action: { type: 'roll' },
        evCents: 0,
        stake: 100,
        evPerDollar,
        headline: '',
      }) as const;
    expect(bestOf([o('a', -0.01), o('b', -0.0105)])).toBeNull();
    expect(bestOf([o('a', -0.01), o('b', -0.02)])?.id).toBe('a');
  });
});
