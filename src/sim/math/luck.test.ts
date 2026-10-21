import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine';
import type { BetTypeId, GameState } from '../engine';
import { luckFrom, luckOf, luckText, makeVarianceFn, normalCdf } from './luck';
import { tableExpectedLossPerRoll } from './ev';
import { toNumber } from './fraction';

type Layout = [BetTypeId, number][]; // [type, dollars]

/** Keep the layout up (placing what is missing and legal) for `rolls` rolls. */
function session(seed: number, layout: Layout, rolls: number): GameState {
  const expectedLossFn = (s: GameState) => toNumber(tableExpectedLossPerRoll(s));
  const varianceFn = makeVarianceFn();
  let s = createGame({ seed, bankroll: 10_000_000 });
  for (let i = 0; i < rolls; i++) {
    for (const [type, dollars] of layout) {
      if (s.bets.some((b) => b.type === type)) continue;
      const parent =
        type === 'pass-odds'
          ? s.bets.find((b) => b.type === 'pass-line')
          : type === 'come-odds'
            ? s.bets.find((b) => b.type === 'come' && b.point !== null)
            : undefined;
      const r = applyAction(s, {
        type: 'place-bet',
        betType: type,
        amount: dollars * 100,
        ...(parent ? { parentId: parent.id } : {}),
      });
      if (r.ok) s = r.state;
    }
    const r = applyAction(s, { type: 'roll' }, { expectedLossFn, varianceFn });
    if (!r.ok) throw new Error('roll failed');
    s = r.state;
  }
  return s;
}

const LAYOUTS: [string, Layout][] = [
  [
    'come + odds',
    [
      ['come', 10],
      ['come-odds', 20],
    ],
  ],
  ['pass line', [['pass-line', 10]]],
  ["don't pass", [['dont-pass', 10]]],
  [
    'pass + 2x odds',
    [
      ['pass-line', 10],
      ['pass-odds', 20],
    ],
  ],
  [
    'place 6 + 8',
    [
      ['place-6', 12],
      ['place-8', 12],
    ],
  ],
  [
    'pass + odds + place 6/8 + field',
    [
      ['pass-line', 10],
      ['pass-odds', 20],
      ['place-6', 12],
      ['place-8', 12],
      ['field', 5],
    ],
  ],
  [
    'field + any 7',
    [
      ['field', 10],
      ['any-7', 5],
    ],
  ],
];

describe('luck z-score', () => {
  for (const [name, layout] of LAYOUTS) {
    it(`${name}: SD of z is about 1`, () => {
      const zs: number[] = [];
      for (let i = 0; i < 400; i++) {
        const z = luckOf(session(2000 + i, layout, 60).stats).z;
        expect(z).not.toBeNull();
        zs.push(z as number);
      }
      const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
      const sd = Math.sqrt(zs.reduce((a, b) => a + (b - mean) ** 2, 0) / zs.length);
      expect(Math.abs(mean)).toBeLessThan(0.15);
      expect(sd).toBeGreaterThan(0.9);
      expect(sd).toBeLessThan(1.1);
    });
  }

  for (const [name, layout] of [
    ['fire', [['fire', 5]]],
    ['all', [['all', 5]]],
    [
      'pass + tall + small',
      [
        ['pass-line', 10],
        ['tall', 5],
        ['small', 5],
      ],
    ],
  ] as [string, Layout][]) {
    it(`${name}: luck is reported as unavailable, not a wrong z`, () => {
      const l = luckOf(session(7, layout, 40).stats);
      expect(l.unknown).toBe(true);
      expect(l.z).toBeNull();
    });
  }

  it('adds nothing without bets', () => {
    expect(makeVarianceFn()(createGame({ seed: 1 }))).toBe(0);
  });

  it('verdicts follow the rounded z and split at 2 swings', () => {
    expect(luckFrom(0, 0, 0).z).toBeNull();
    expect(luckFrom(150, 0, 10_000).verdict).toBe('normal'); // z = 1.5
    expect(luckFrom(195, 0, 10_000).verdict).toBe('lucky'); // 1.95 shows as 2.0
    expect(luckFrom(250, 0, 10_000).verdict).toBe('lucky');
    expect(luckFrom(-250, 0, 10_000).verdict).toBe('unlucky');
  });

  it('says how often that happens', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
    expect(normalCdf(-2)).toBeCloseTo(0.02275, 4);
    expect(luckText(luckFrom(80, 0, 10_000))).toBe(
      'within the normal range (about 0.8 typical swings above expected, about 1 in 5 sessions do better)',
    );
    expect(luckText(luckFrom(-100, 0, 10_000))).toContain('1 in 6 sessions do worse');
    expect(luckText(luckFrom(-200, 0, 10_000))).toContain('1 in 44 sessions do worse');
  });

  it('unknown variance is reported as such', () => {
    const l = luckFrom(-500, 100, NaN);
    expect(l.unknown).toBe(true);
    expect(l.z).toBeNull();
    expect(luckText(l)).toContain('not available');
  });
});
