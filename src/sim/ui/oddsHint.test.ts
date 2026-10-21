import { describe, expect, it } from 'vitest';
import { createGame } from '../engine';
import { oddsRoom } from './oddsHint';

describe('oddsRoom (one-time odds nudge)', () => {
  it('points at a pass line bet on a point that has odds room', () => {
    const g = createGame({
      phase: 'point',
      point: 6,
      bankroll: 100000,
      bets: [{ ref: 'p', type: 'pass-line', amount: 1000 }],
    });
    const r = oddsRoom(g);
    expect(r).not.toBeNull();
    expect(r!.label).toBe('Pass line');
    expect(r!.point).toBe(6);
    expect(r!.room).toBeGreaterThan(0);
  });

  it('is null once odds are on the bet', () => {
    const g = createGame({
      phase: 'point',
      point: 6,
      bankroll: 100000,
      bets: [
        { ref: 'p', type: 'pass-line', amount: 1000 },
        { type: 'pass-odds', amount: 1000, parentRef: 'p' },
      ],
    });
    expect(oddsRoom(g)).toBeNull();
  });

  it('is null on the come-out, with no bets, or with the bet off a point', () => {
    expect(oddsRoom(createGame({ bankroll: 100000 }))).toBeNull();
    const co = createGame({
      phase: 'come-out',
      bankroll: 100000,
      bets: [{ ref: 'p', type: 'pass-line', amount: 1000 }],
    });
    expect(oddsRoom(co)).toBeNull();
  });
});
