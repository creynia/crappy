import { describe, expect, it } from 'vitest';
import { DRILLS, getDrill } from '../../src/app/practice/drills';
import { createDrillRng, deriveSeed } from '../../src/app/practice/rng';
import {
  MAX_REPEATS,
  REVIEW_GAP,
  REVIEW_PER_ROUND,
  ROUND_SIZE,
  answerRound,
  createRound,
  currentEntry,
  isRoundDone,
  itemFor,
  missedEntries,
  nextItem,
  type Round,
} from '../../src/app/practice/round';
import { defineDrill, type DrillItem } from '../../src/app/practice/types';

// A tiny drill with a known answer: "what is n?" for n drawn from 0..99 (level scales the range).
interface NItem extends DrillItem {
  n: number;
}
const numbers = defineDrill<NItem, number>({
  id: 'numbers',
  title: 'Numbers',
  summary: 'test',
  levels: ['a', 'b'],
  generate(rng, level) {
    const n = rng.int(0, level * 100 - 1);
    return { key: String(n), prompt: `n=${n}`, answer: { kind: 'number' }, n };
  },
  check(item, answer) {
    return { ok: answer === item.n, expected: String(item.n), explain: '' };
  },
});

const right = (r: Round) => (currentEntry(r)!.item as NItem).n;
const answer = (r: Round, ok: boolean) => {
  const out = answerRound(numbers, r, ok ? right(r) : -1);
  return { ...out, round: nextItem(out.round) };
};

describe('drill rng', () => {
  it('is deterministic by seed and in range', () => {
    const a = createDrillRng(42);
    const b = createDrillRng(42);
    const xs = Array.from({ length: 50 }, () => a.int(3, 9));
    expect(Array.from({ length: 50 }, () => b.int(3, 9))).toEqual(xs);
    expect(xs.every((x) => x >= 3 && x <= 9)).toBe(true);
    expect(new Set(xs).size).toBe(7);
    const d = createDrillRng(1).dice();
    expect(d[0]).toBeGreaterThanOrEqual(1);
    expect(d[1]).toBeLessThanOrEqual(6);
    expect(createDrillRng(7).shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(() => createDrillRng(1).pick([])).toThrow();
  });
  it('derives distinct child seeds', () => {
    const seeds = Array.from({ length: 100 }, (_, i) => deriveSeed(5, i));
    expect(new Set(seeds).size).toBe(100);
    expect(deriveSeed(5, 3)).toBe(seeds[3]);
    expect(deriveSeed(6, 3)).not.toBe(seeds[3]);
  });
});

describe('createRound', () => {
  it('is deterministic by seed: same seed, same items', () => {
    const a = createRound(numbers, { seed: 9, level: 1 });
    const b = createRound(numbers, { seed: 9, level: 1 });
    const c = createRound(numbers, { seed: 10, level: 1 });
    const keys = (r: Round) => r.queue.map((e) => e.item.key);
    expect(keys(a)).toEqual(keys(b));
    expect(keys(a)).not.toEqual(keys(c));
    expect(a.queue).toHaveLength(ROUND_SIZE);
    expect(new Set(keys(a)).size).toBe(ROUND_SIZE);
  });
  it('regenerates items from their refs', () => {
    const r = createRound(numbers, { seed: 3, level: 2 });
    for (const e of r.queue) expect(itemFor(numbers, e.ref)).toEqual(e.item);
  });
  it('clamps the level', () => {
    expect(createRound(numbers, { seed: 1, level: 7 }).level).toBe(2);
    expect(createRound(numbers, { seed: 1, level: 0 }).level).toBe(1);
  });
  it('opens with saved review items (up to the per-round cap), then new ones', () => {
    const review = [11, 12, 13, 14, 15].map((seed) => ({ seed, level: 1 }));
    const r = createRound(numbers, { seed: 1, level: 1, review });
    const head = r.queue.slice(0, REVIEW_PER_ROUND);
    expect(head.map((e) => e.ref.seed)).toEqual([11, 12, 13]);
    expect(head.every((e) => e.fromReview && e.scored)).toBe(true);
    expect(r.queue.slice(REVIEW_PER_ROUND).some((e) => e.fromReview)).toBe(false);
    expect(r.queue).toHaveLength(ROUND_SIZE);
  });
});

describe('answering a round', () => {
  it('scores first tries and finishes after 10 correct answers', () => {
    let r = createRound(numbers, { seed: 1, level: 1 });
    for (let i = 0; i < ROUND_SIZE; i++) {
      expect(isRoundDone(r)).toBe(false);
      r = answer(r, true).round;
    }
    expect(isRoundDone(r)).toBe(true);
    expect(r.score).toBe(10);
    expect(r.scoredCount).toBe(10);
    expect(r.bestStreak).toBe(10);
    expect(missedEntries(r)).toHaveLength(0);
  });

  it('shows feedback until nextItem', () => {
    const r0 = createRound(numbers, { seed: 1, level: 1 });
    const { round } = answerRound(numbers, r0, right(r0));
    expect(round.feedback?.result.ok).toBe(true);
    expect(currentEntry(round)).toBeNull();
    expect(() => answerRound(numbers, round, 0)).toThrow();
    expect(currentEntry(nextItem(round))?.item.key).toBe(r0.queue[1]!.item.key);
  });

  it('re-queues a missed item after REVIEW_GAP others, unscored, and asks for review persistence', () => {
    let r = createRound(numbers, { seed: 2, level: 1 });
    const missedKey = currentEntry(r)!.item.key;
    const out = answer(r, false);
    expect(out.effects.addReview).toEqual(r.queue[0]!.ref);
    r = out.round;
    expect(r.queue[REVIEW_GAP]!.item.key).toBe(missedKey);
    expect(r.queue[REVIEW_GAP]!.scored).toBe(false);
    expect(r.queue).toHaveLength(ROUND_SIZE);
    for (let i = 0; i < REVIEW_GAP; i++) r = answer(r, true).round;
    expect(currentEntry(r)!.item.key).toBe(missedKey);
    const again = answer(r, true);
    expect(again.effects).toEqual({}); // re-asks never touch the saved review list
    expect(again.round.score).toBe(REVIEW_GAP);
    r = again.round;
    while (!isRoundDone(r)) r = answer(r, true).round;
    expect(r.score).toBe(9);
    expect(r.scoredCount).toBe(10);
    expect(r.answered).toHaveLength(11);
    expect(missedEntries(r).map((a) => a.entry.item.key)).toEqual([missedKey]);
  });

  it('stops re-asking after MAX_REPEATS misses', () => {
    let r = createRound(numbers, { seed: 4, level: 1 });
    let n = 0;
    while (!isRoundDone(r)) {
      r = answer(r, false).round;
      n++;
    }
    expect(n).toBe(ROUND_SIZE * (1 + MAX_REPEATS));
    expect(r.score).toBe(0);
    expect(r.streak).toBe(0);
  });

  it('clears a saved review item answered right on the first try', () => {
    const ref = { seed: 77, level: 1 };
    const r = createRound(numbers, { seed: 1, level: 1, review: [ref] });
    expect(answer(r, true).effects).toEqual({ clearReview: ref });
    expect(answer(r, false).effects).toEqual({ addReview: ref });
  });
});

describe('registry', () => {
  it('has unique ids, levels, and deterministic generation for every drill', () => {
    expect(new Set(DRILLS.map((d) => d.id)).size).toBe(DRILLS.length);
    for (const d of DRILLS) {
      expect(getDrill(d.id)).toBe(d);
      expect(d.levels.length).toBeGreaterThan(0);
      for (let level = 1; level <= d.levels.length; level++)
        for (let s = 0; s < 50; s++) {
          const a = d.generate(createDrillRng(s), level);
          expect(d.generate(createDrillRng(s), level)).toEqual(a);
          if (a.answer.kind === 'custom') expect(d.Input).toBeTypeOf('function');
          if (a.answer.kind === 'choice')
            expect(new Set(a.answer.choices.map((c) => c.id)).size).toBe(a.answer.choices.length);
        }
    }
    expect(getDrill('nope')).toBeUndefined();
  });
});
