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

describe('loadSandbox roll log', () => {
  beforeEach(() => localStorage.clear());
  const save = (log: unknown) => {
    const game = createGame({ seed: 1 });
    localStorage.setItem(
      'crappy:sim:k:v1',
      JSON.stringify({ v: 1, game, startBankroll: 50000, presetId: 'x', log }),
    );
    return loadSandbox('k')?.log;
  };
  const good = {
    id: 'r1',
    kind: 'roll',
    n: 1,
    dice: [3, 4],
    total: 7,
    text: 'ok',
    point: 'natural',
    outcomes: ['win'],
    net: 500,
    bankroll: 50500,
  };
  it('keeps well-formed entries', () => expect(save([good])).toEqual([good]));
  it('drops a log that is not an array', () => {
    expect(save('nope')).toEqual([]);
    expect(save({ a: 1 })).toEqual([]);
  });
  it('drops bad entries one by one', () => {
    const { outcomes: _o, ...noOutcomes } = good;
    expect(
      save([null, good, noOutcomes, { ...good, dice: [9, 9] }, { ...good, net: 'x' }]),
    ).toEqual([good]);
  });
});
