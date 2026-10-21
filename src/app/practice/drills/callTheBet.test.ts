import { describe, expect, it } from 'vitest';
import { createGame, validateAction } from '../../../sim/engine';
import type { BetInit, CreateGameOptions, Dice, PointNumber } from '../../../sim/engine';
import { createDrillRng } from '../rng';
import { callTheBet, callsFor, resolveCalls, type CallTheBetItem } from './callTheBet';

const game = (point: PointNumber | null, bets: BetInit[], extra: CreateGameOptions = {}) =>
  createGame({
    seed: 1,
    bankroll: 1_000_000,
    phase: point === null ? 'come-out' : 'point',
    point,
    bets,
    ...extra,
  });
const callsOf = (point: PointNumber | null, bets: BetInit[], dice: Dice) => {
  const s = game(point, bets);
  const { truth } = resolveCalls(s, dice);
  return s.bets.map((b) => [b.type, b.point, truth[b.id]]);
};
const gen = (seed: number, level: number) =>
  callTheBet.generate(createDrillRng(seed), level) as unknown as CallTheBetItem;

describe('call the bet: answer key from the engine', () => {
  it('come odds are off on a come-out 7: the come loses, its odds come back', () => {
    expect(
      callsOf(
        null,
        [
          { ref: 'c', type: 'come', amount: 1000, point: 6 },
          { type: 'come-odds', amount: 2000, parentRef: 'c' },
          { type: 'pass-line', amount: 1000 },
        ],
        [3, 4],
      ),
    ).toEqual([
      ['come', 6, 'lose'],
      ['come-odds', 6, 'off'],
      ['pass-line', null, 'win'],
    ]);
  });

  it("don't pass is barred on a come-out 12: push", () => {
    expect(
      callsOf(
        null,
        [
          { type: 'dont-pass', amount: 1000 },
          { type: 'pass-line', amount: 1000 },
        ],
        [6, 6],
      ),
    ).toEqual([
      ['dont-pass', null, 'push'],
      ['pass-line', null, 'lose'],
    ]);
  });

  it('a new come travels to 8 while the old come on 8 wins', () => {
    expect(
      callsOf(
        5,
        [
          { type: 'pass-line', amount: 1000 },
          { ref: 'old', type: 'come', amount: 1000, point: 8 },
          { type: 'come-odds', amount: 2000, parentRef: 'old' },
          { type: 'come', amount: 1000 },
        ],
        [4, 4],
      ),
    ).toEqual([
      ['pass-line', null, 'stays'],
      ['come', 8, 'win'],
      ['come-odds', 8, 'win'],
      ['come', null, 'travel'],
    ]);
  });

  it('place and hardways are off on the come-out; on a point a 7 takes them', () => {
    const bets: BetInit[] = [
      { type: 'pass-line', amount: 1000 },
      { type: 'place-6', amount: 1200 },
      { type: 'hard-8', amount: 500 },
      { type: 'field', amount: 500 },
    ];
    expect(callsOf(null, bets, [3, 3]).map((x) => x[2])).toEqual(['stays', 'off', 'off', 'lose']);
    expect(callsOf(4, bets, [3, 4]).map((x) => x[2])).toEqual(['lose', 'lose', 'lose', 'lose']);
    expect(callsOf(4, bets, [4, 4]).map((x) => x[2])).toEqual(['stays', 'stays', 'win', 'lose']);
  });
});

describe('call the bet: generator', () => {
  it('builds legal layouts with a verdict for every bet at every level', () => {
    for (let level = 1; level <= 3; level++) {
      for (let seed = 0; seed < 300; seed++) {
        const item = gen(seed, level);
        expect(item.bets.length).toBeGreaterThan(0);
        // bets come out of createGame, which validates every one (odds limits, phases, parents)
        expect(new Set(item.bets.map((b) => b.id)).size).toBe(item.bets.length);
        for (const b of item.bets) {
          expect(item.truth[b.id], `${seed}/${level} ${b.type}`).toBeDefined();
          expect(callsFor(level)).toContain(item.truth[b.id]);
          expect(item.why[b.id]).toBeTruthy();
        }
        const types = new Set(item.bets.map((b) => b.type));
        if (level === 1) for (const t of types) expect(['pass-line', 'dont-pass']).toContain(t);
        // the roll itself is legal
        const s = createGame({ seed: 1 });
        expect(validateAction(s, { type: 'roll', dice: item.dice }).ok).toBe(true);
      }
    }
  });

  it('levels add bet families: come/odds at 2, place/hard/props at 3', () => {
    const seen = (level: number) => {
      const t = new Set<string>();
      for (let s = 0; s < 200; s++) for (const b of gen(s, level).bets) t.add(b.type);
      return t;
    };
    const l2 = seen(2);
    const l3 = seen(3);
    for (const t of ['come', 'come-odds', 'pass-odds', 'dont-come'])
      expect(l2.has(t), t).toBe(true);
    expect([...l2].some((t) => t.startsWith('place-'))).toBe(false);
    for (const t of ['place-6', 'field', 'any-7']) expect(l3.has(t), t).toBe(true);
    expect([...l3].some((t) => t.startsWith('hard-'))).toBe(true);
  });

  it('check: all calls right is ok; a miss is explained', () => {
    const item = gen(7, 2);
    const right = { ...item.truth };
    expect(callTheBet.check(item, right).ok).toBe(true);
    const b = item.bets[0]!;
    const wrong = { ...right, [b.id]: right[b.id] === 'win' ? 'lose' : 'win' };
    const r = callTheBet.check(item, wrong);
    expect(r.ok).toBe(false);
    expect(r.explain).toMatch(/calls right\.$/);
    expect(r.explain).toContain(`${item.bets.length - 1} of ${item.bets.length}`);
    expect(r.expected).toContain(':');
  });
});

describe('call the bet: center crop', () => {
  it('keeps only the regions that hold bets, shifted into a tight viewBox', async () => {
    const { cropLayout } = await import('./callTheBet');
    const { centerLayout } = await import('../../../sim');
    const c = cropLayout(centerLayout, new Set(['any-7', 'yo-11'] as const));
    expect(c.regions.map((r) => r.id).sort()).toEqual(['any-7', 'yo-11']);
    expect(c.viewBox.h).toBeLessThan(centerLayout.viewBox.h);
    for (const r of c.regions) {
      expect(r.rect.x).toBeGreaterThanOrEqual(0);
      expect(r.rect.y).toBeGreaterThanOrEqual(0);
      expect(r.rect.y + r.rect.h).toBeLessThanOrEqual(c.viewBox.h);
    }
  });
  it('reasons: "an 8", and a come-out point for line bets', () => {
    const s = game(null, [{ type: 'pass-line', amount: 1000 }]);
    expect(resolveCalls(s, [4, 4]).why[s.bets[0]!.id]).toBe(
      'Pass Line stays: the 8 becomes the point.',
    );
    const p = game(4, [{ type: 'place-6', amount: 1200 }]);
    expect(resolveCalls(p, [5, 6]).why[p.bets[0]!.id]).toBe('Place 6 stays: no decision on an 11.');
  });
});
