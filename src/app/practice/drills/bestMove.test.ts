import { describe, expect, it } from 'vitest';
import { previewAction, toNumber } from '../../../sim/math';
import { validateAction } from '../../../sim/engine';
import { createDrillRng } from '../rng';
import { bestMove, bestOf, MIN_MARGIN, rankedLines, type BestMoveItem } from './bestMove';

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
    expect(wrong.explain).toContain('per bet resolved');
    expect(wrong.explain).toContain('swings');
    const list = wrong.explainList!;
    expect(list).toHaveLength(it_.options.length);
    expect(list[0]).toMatch(/^1\. /);
    for (const o of it_.options) expect(list.some((l) => l.includes(o.headline))).toBe(true);
    // the house edge is stated once (in the headline), not again in a trailing parenthesis
    for (const l of list) expect(l).not.toMatch(/house edge [\d.]+%\).*of the money at risk/);
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

  it('every template appears at every level that offers it', () => {
    const want: Record<number, string[]> = {
      1: ['odds-first', 'come-out', 'field-vs-props'],
      2: ['odds-first', 'numbers', 'come-out', 'which-number', 'buy-or-place', 'field-vs-props'],
      3: [
        'odds-first',
        'numbers',
        'dont-side',
        'come-out',
        'which-number',
        'buy-or-place',
        'field-vs-props',
      ],
    };
    for (const level of [1, 2, 3]) {
      const seen = new Set<string>();
      for (let seed = 0; seed < 400; seed++) seen.add(item(seed, level).template);
      expect([...seen].sort(), `level ${level}`).toEqual([...want[level]!].sort());
    }
  });

  it('the new templates have a best move that is neither free odds nor a line bet', () => {
    const bestOfTemplate = (t: string) => {
      const out = new Set<string>();
      for (let seed = 0; seed < 600; seed++) {
        const x = item(seed, 3);
        if (x.template === t) out.add(x.best);
      }
      return [...out];
    };
    expect(bestOfTemplate('numbers')).toEqual(['buy-30']);
    expect(bestOfTemplate('which-number')).toEqual(['place-6']);
    expect(bestOfTemplate('buy-or-place')).toEqual(['buy']);
    expect(bestOfTemplate('field-vs-props')).toEqual(['field']);
  });

  it('ranked lines number ties alike', () => {
    for (let seed = 0; seed < 300; seed++) {
      const x = item(seed, 3);
      if (x.template !== 'buy-or-place') continue;
      const lines = rankedLines(x);
      // place the n for $20 and for $10 have the same edge: they share a rank
      expect(lines.filter((l) => l.includes('(tied)'))).toHaveLength(2);
      return;
    }
    throw new Error('no buy-or-place item');
  });

  it("places the point at a full-pay amount in the don't-side template", () => {
    for (let seed = 0; seed < 300; seed++) {
      const x = item(seed, 3);
      const p = x.options.find((o) => o.id === 'place');
      if (x.template !== 'dont-side' || !p) continue;
      const pt = x.state.point!;
      expect(p.stake).toBe(pt === 6 || pt === 8 ? 1200 : 1000);
    }
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
