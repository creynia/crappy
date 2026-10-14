import { describe, expect, it } from 'vitest';
import { nextDice, createGame, nextU32, rollDice, rollDie, seedRng } from '../index';
import { D } from './helpers';

describe('rng', () => {
  it('is deterministic and never all-zero', () => {
    expect(seedRng(42)).toEqual(seedRng(42));
    expect(seedRng(42)).not.toEqual(seedRng(43));
    for (const seed of [0, 1, -1, 2 ** 31, 2 ** 32 - 1, 123456789]) {
      expect(seedRng(seed).s.some((x) => x !== 0)).toBe(true);
    }
  });

  it('golden sequence for seed 42', () => {
    let r = seedRng(42);
    const dice: number[] = [];
    for (let i = 0; i < 12; i++) {
      const [d, n] = rollDice(r);
      r = n;
      dice.push(d[0] * 10 + d[1]);
    }
    expect(dice).toMatchInlineSnapshot(`
      [
        63,
        14,
        16,
        33,
        26,
        45,
        41,
        65,
        61,
        15,
        51,
        66,
      ]
    `);
    const [u] = nextU32(seedRng(42));
    expect(u).toMatchInlineSnapshot(`660444221`);
  });

  it('does not mutate the input state', () => {
    const r = seedRng(5);
    const copy = JSON.stringify(r);
    rollDice(r);
    expect(JSON.stringify(r)).toBe(copy);
  });

  it('rejection sampling: values at or above 4294967292 are rejected', () => {
    // Fake a state whose next outputs we cannot easily set, so check the bound maths instead.
    expect(Math.floor(2 ** 32 / 6) * 6).toBe(4294967292);
    let r = seedRng(99);
    for (let i = 0; i < 1000; i++) {
      const [d, n] = rollDie(r);
      r = n;
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    }
  });

  it('chi-square over 360k dice is plausible (p > 0.001)', () => {
    let r = seedRng(2024);
    const counts = Array<number>(13).fill(0);
    const N = 360_000;
    for (let i = 0; i < N; i++) {
      const [d, n] = rollDice(r);
      r = n;
      counts[d[0] + d[1]] = (counts[d[0] + d[1]] ?? 0) + 1;
    }
    let chi = 0;
    for (let t = 2; t <= 12; t++) {
      const ways = 6 - Math.abs(t - 7);
      const e = (N * ways) / 36;
      chi += ((counts[t] ?? 0) - e) ** 2 / e;
    }
    // df = 10; chi-square critical value for p = 0.001 is 29.59
    expect(chi).toBeLessThan(29.59);
    // each die face too
    r = seedRng(77);
    const faces = Array<number>(7).fill(0);
    for (let i = 0; i < N; i++) {
      const [d, n] = rollDie(r);
      r = n;
      faces[d] = (faces[d] ?? 0) + 1;
    }
    let chiF = 0;
    for (let f = 1; f <= 6; f++) chiF += ((faces[f] ?? 0) - N / 6) ** 2 / (N / 6);
    expect(chiF).toBeLessThan(20.52); // df = 5, p = 0.001
  });

  it('forced queue is consumed before the RNG', () => {
    const s = createGame({ seed: 3, forcedDice: [D(1, 2), D(6, 6)] });
    const a = nextDice(s);
    expect(a.dice).toEqual([1, 2]);
    expect(a.forced).toBe(true);
    expect(a.state.rng).toEqual(s.rng);
    const b = nextDice(a.state);
    expect(b.dice).toEqual([6, 6]);
    const c = nextDice(b.state);
    expect(c.forced).toBe(false);
    expect(c.dice).toEqual(rollDice(s.rng)[0]);
    expect(c.state.forcedDice).toEqual([]);
  });
});
