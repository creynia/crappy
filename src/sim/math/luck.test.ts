import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine';
import type { GameState } from '../engine';
import { luckFrom, luckOf, luckText, makeVarianceFn } from './luck';
import { tableExpectedLossPerRoll } from './ev';
import { toNumber } from './fraction';

/** One session: keep a $10 pass line up and roll until `decisions` line decisions resolved. */
function session(seed: number, decisions: number): GameState {
  const expectedLossFn = (s: GameState) => toNumber(tableExpectedLossPerRoll(s));
  const varianceFn = makeVarianceFn();
  let s = createGame({ seed, bankroll: 1_000_000 });
  let done = 0;
  while (done < decisions) {
    if (s.bets.length === 0) {
      const p = applyAction(s, { type: 'place-bet', betType: 'pass-line', amount: 1000 });
      if (!p.ok) throw new Error('place failed');
      s = p.state;
    }
    const r = applyAction(s, { type: 'roll' }, { expectedLossFn, varianceFn });
    if (!r.ok) throw new Error('roll failed');
    s = r.state;
    done += r.events.filter((e) => e.type === 'bet-won' || e.type === 'bet-lost').length;
  }
  return s;
}

describe('luck z-score', () => {
  it('after 10k pass-line resolutions across sessions, mean z ~ 0 and SD ~ 1', () => {
    const zs: number[] = [];
    for (let i = 0; i < 400; i++) {
      const s = session(1000 + i, 25);
      const l = luckOf(s.stats);
      expect(l.z).not.toBeNull();
      zs.push(l.z as number);
    }
    const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
    const sd = Math.sqrt(zs.reduce((a, b) => a + (b - mean) ** 2, 0) / zs.length);
    expect(Math.abs(mean)).toBeLessThan(0.1);
    expect(Math.abs(sd - 1)).toBeLessThan(0.1);
  });

  it('is n/a without variance and verdicts split at 2 swings', () => {
    expect(luckFrom(0, 0, 0).z).toBeNull();
    expect(luckFrom(150, 0, 10_000).verdict).toBe('normal'); // z = 1.5
    expect(luckFrom(250, 0, 10_000).verdict).toBe('lucky');
    expect(luckFrom(-250, 0, 10_000).verdict).toBe('unlucky');
    expect(luckText(luckFrom(80, 0, 10_000))).toBe(
      'within the normal range (about 0.8 typical swings)',
    );
  });
});
