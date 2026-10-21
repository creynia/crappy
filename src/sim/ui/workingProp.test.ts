import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine';
import type { GameState } from '../engine/types';
import { workingProp } from './workingProp';

const betOf = (g: GameState, type: string) => g.bets.find((b) => b.type === type)!;
const setWorking = (g: GameState, type: string, working: 'on' | 'off'): GameState =>
  applyAction(g, { type: 'set-working', betId: betOf(g, type).id, working }).state;

describe('workingProp copy', () => {
  it('place 6 $12 at the come-out is off by convention, and ON costs about $0.06 per come-out roll', () => {
    const g = createGame({ bankroll: 100_000, bets: [{ type: 'place-6', amount: 1200 }] });
    const p = workingProp(g, betOf(g, 'place-6'), 100);
    expect(p.value).toBe(false);
    expect(p.copy).toContain('Off on the come-out by table convention.');
    expect(p.copy).toContain('Turning it ON costs about $0.06 per come-out roll');
    expect(p.copy).toContain('risks the 7, which comes up 6 of 36 ways');
  });

  it('after turning it ON, the copy shows the saving from turning it OFF', () => {
    const g = setWorking(
      createGame({ bankroll: 100_000, bets: [{ type: 'place-6', amount: 1200 }] }),
      'place-6',
      'on',
    );
    const p = workingProp(g, betOf(g, 'place-6'), 100);
    expect(p.value).toBe(true);
    expect(p.copy).toBe(
      'Working on the come-out. Turning it OFF saves about $0.06 per come-out roll.',
    );
  });

  it('in the point phase the copy says per roll, not per come-out roll', () => {
    const g = createGame({
      phase: 'point',
      point: 6,
      bankroll: 100_000,
      bets: [{ type: 'place-6', amount: 1200 }],
    });
    expect(workingProp(g, betOf(g, 'place-6'), 100).copy).toBe(
      'Working. Turning it OFF saves about $0.06 per roll.',
    );
    const off = setWorking(g, 'place-6', 'off');
    const p = workingProp(off, betOf(off, 'place-6'), 100);
    expect(p.copy).toContain('You turned this bet off.');
    expect(p.copy).toContain('per roll');
    expect(p.copy).not.toContain('come-out');
  });

  it('come odds never claim a cost: odds have no house edge', () => {
    const g = createGame({
      phase: 'point',
      point: 6,
      bankroll: 100_000,
      bets: [
        { ref: 'c', type: 'come', amount: 1000, point: 4 },
        { type: 'come-odds', amount: 2000, parentRef: 'c' },
      ],
    });
    const p = workingProp(g, betOf(g, 'come-odds'), 100);
    expect(p.copy).toContain('Odds have no house edge, so ON costs nothing on average.');
    expect(p.copy).not.toContain('$0.00');
  });

  it('a lay bet gets no reason, since it wins on the 7', () => {
    const g = createGame({
      phase: 'point',
      point: 6,
      bankroll: 100_000,
      bets: [{ type: 'lay-6', amount: 1200 }],
    });
    expect(workingProp(g, betOf(g, 'lay-6'), 100).copy).toBeUndefined();
  });

  it('hard 6 at the come-out says it loses on 10 of 36 rolls', () => {
    const g = createGame({ bankroll: 100_000, bets: [{ type: 'hard-6', amount: 500 }] });
    const p = workingProp(g, betOf(g, 'hard-6'), 100);
    expect(p.copy).toContain('Hard 6 loses on 10 of 36 rolls (6 sevens and 4 easy ways).');
    expect(p.copy).not.toContain('risks the 7');
  });
});
