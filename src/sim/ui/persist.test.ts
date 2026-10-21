import { beforeEach, describe, expect, it } from 'vitest';
import { createGame } from '../engine';
import { loadSandbox } from './persist';

describe('loadSandbox migration', () => {
  beforeEach(() => localStorage.clear());
  it('fills in missing stats.variance with 0', () => {
    const game = createGame({ seed: 1 });
    const { variance: _v, ...stats } = game.stats;
    const old = { ...game, stats };
    localStorage.setItem(
      'crappy:sim:k:v1',
      JSON.stringify({ v: 1, game: old, startBankroll: 50000, presetId: 'x' }),
    );
    expect(loadSandbox('k')?.game.stats.variance).toBe(0);
  });
  it('marks luck unknown when an old save already has results', () => {
    const game = createGame({ seed: 1 });
    const { variance: _v, ...stats } = game.stats;
    const old = {
      ...game,
      stats: { ...stats, expectedLoss: 250, totalLost: 900, totalWagered: 900 },
    };
    localStorage.setItem(
      'crappy:sim:k:v1',
      JSON.stringify({ v: 1, game: old, startBankroll: 50000, presetId: 'x' }),
    );
    expect(loadSandbox('k')?.game.stats.variance).toBeNaN();
  });
});
