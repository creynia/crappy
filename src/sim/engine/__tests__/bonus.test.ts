import { describe, expect, it } from 'vitest';
import { applyAction, createGame, isHandStart, legalBetTypes, validateAction } from '../index';
import type { GameEvent, GameState } from '../index';
import { $, act, bet, betsOf, game, roll, rollTotals } from './helpers';

const types = (ev: GameEvent[]) => ev.map((e) => e.type);
const only = (s: GameState, t: string) => betsOf(s, t)[0];

describe('bonus bets: placement timing', () => {
  it('are legal before a new shooter rolls, use propMin and cannot be taken down', () => {
    const s = game();
    expect(isHandStart(s)).toBe(true);
    expect(legalBetTypes(s)).toEqual(expect.arrayContaining(['fire', 'all', 'tall', 'small']));
    const v = validateAction(s, { type: 'place-bet', betType: 'fire', amount: 100 });
    expect(v.ok).toBe(true);
    const placed = bet(s, 'fire', 1);
    expect(placed.bankroll).toBe(s.bankroll - 100);
    const rm = validateAction(placed, { type: 'remove-bet', betId: only(placed, 'fire')!.id });
    expect(rm).toMatchObject({ ok: false, code: 'not-removable' });
  });

  it('are refused once the hand is under way, until the shooter sevens out', () => {
    let s = roll(game(), 3, 4).state; // come-out natural: same shooter
    expect(isHandStart(s)).toBe(false);
    expect(validateAction(s, { type: 'place-bet', betType: 'small', amount: 100 })).toMatchObject({
      ok: false,
      code: 'wrong-phase',
    });
    expect(legalBetTypes(s)).not.toContain('fire');
    s = rollTotals(s, [2, 4], [3, 3]); // point 6 made: come-out again, still the same shooter
    expect(s.phase).toBe('come-out');
    expect(isHandStart(s)).toBe(false);
    s = rollTotals(s, [4, 4], [3, 4]); // point 8 then seven-out: new shooter
    expect(isHandStart(s)).toBe(true);
    expect(validateAction(s, { type: 'place-bet', betType: 'small', amount: 100 }).ok).toBe(true);
    // amounts can only change at a hand start as well
    const placed = bet(s, 'small', 1);
    expect(
      validateAction(placed, { type: 'set-amount', betId: only(placed, 'small')!.id, amount: 300 })
        .ok,
    ).toBe(true);
    const rolled = roll(placed, 1, 3).state;
    expect(
      validateAction(rolled, { type: 'set-amount', betId: only(rolled, 'small')!.id, amount: 300 }),
    ).toMatchObject({ ok: false, code: 'wrong-phase' });
  });

  it('a scene can start mid-hand with progress; invalid progress is rejected', () => {
    const s = createGame({
      phase: 'point',
      point: 8,
      bets: [
        { type: 'fire', amount: 100, progress: [4, 5] },
        { type: 'small', amount: 100, progress: [2, 2, 6] },
      ],
    });
    expect(only(s, 'fire')!.progress).toEqual([4, 5]);
    expect(only(s, 'small')!.progress).toEqual([2, 6]);
    expect(() => createGame({ bets: [{ type: 'fire', amount: 100, progress: [2] }] })).toThrow(
      /progress/,
    );
    expect(() => createGame({ bets: [{ type: 'place-6', amount: 600, progress: [6] }] })).toThrow(
      /progress/,
    );
  });
});

describe('Fire Bet resolution', () => {
  it('counts distinct points made, pays 24 to 1 on the seven-out with 4 of them', () => {
    let s = bet(game(), 'fire', 1);
    s = rollTotals(s, [2, 2], [2, 2]); // point 4 made
    expect(only(s, 'fire')!.progress).toEqual([4]);
    s = rollTotals(s, [2, 2], [1, 3]); // point 4 made again: still one point
    expect(only(s, 'fire')!.progress).toEqual([4]);
    s = rollTotals(s, [2, 3], [4, 1], [3, 3], [5, 1]); // 5 and 6 made
    expect(only(s, 'fire')!.progress).toEqual([4, 5, 6]);
    s = rollTotals(s, [4, 4], [2, 6]); // 8 made: 4 points
    const r = roll(rollTotals(s, [4, 5]), 3, 4); // point 9, seven-out
    expect(r.events).toContainEqual({
      type: 'bet-won',
      betId: 'b1',
      betType: 'fire',
      amount: 100,
      profit: 2400,
      vig: 0,
      staysUp: false,
    });
    expect(betsOf(r.state, 'fire')).toHaveLength(0);
    expect(r.state.bankroll).toBe($(1000) + 2400);
  });

  it('loses on a seven-out with fewer than 4 points; come-out 7s do not touch it', () => {
    let s = bet(game(), 'fire', 1);
    s = roll(s, 3, 4).state; // natural
    expect(betsOf(s, 'fire')).toHaveLength(1);
    s = rollTotals(s, [5, 5], [5, 5], [2, 4]); // 10 made, then point 6
    const r = roll(s, 1, 6);
    expect(types(r.events)).toContain('bet-lost');
    expect(betsOf(r.state, 'fire')).toHaveLength(0);
    expect(r.state.bankroll).toBe($(1000) - 100);
  });

  it('pays 249 to 1 for 5 points and 999 to 1 at once on the 6th', () => {
    const five = createGame({
      bankroll: $(100),
      phase: 'point',
      point: 10,
      bets: [{ type: 'fire', amount: 100, progress: [4, 5, 6, 8, 9] }],
    });
    const out = roll(five, 3, 4);
    expect(out.events).toContainEqual(expect.objectContaining({ type: 'bet-won', profit: 24_900 }));
    const made = roll(five, 5, 5);
    expect(made.events).toContainEqual(
      expect.objectContaining({ type: 'bet-won', profit: 99_900 }),
    );
    expect(betsOf(made.state, 'fire')).toHaveLength(0);
    expect(made.state.bankroll).toBe($(100) - 100 + 100 + 99_900);
  });

  it('emits bet-progressed only when the set grows', () => {
    let s = bet(game(), 'fire', 1);
    s = roll(s, 2, 2).state;
    const first = roll(s, 1, 3);
    expect(first.events).toContainEqual({
      type: 'bet-progressed',
      betId: 'b1',
      betType: 'fire',
      progress: [4],
    });
    const again = roll(rollTotals(first.state, [2, 2]), 2, 2);
    expect(types(again.events)).not.toContain('bet-progressed');
  });
});

describe('All / Tall / Small resolution', () => {
  it('Small completes on the roll that hits the last number, is paid at once and comes down', () => {
    let s = bet(game(), 'small', 1);
    s = rollTotals(s, [1, 1], [1, 2], [2, 2], [2, 3]); // 2,3,4,5 (point 4 set on the way)
    expect(only(s, 'small')!.progress).toEqual([2, 3, 4, 5]);
    s = roll(s, 1, 2).state; // 3 again: no change
    expect(only(s, 'small')!.progress).toEqual([2, 3, 4, 5]);
    const r = roll(s, 3, 3);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'bet-won', profit: 3400 }));
    expect(betsOf(r.state, 'small')).toHaveLength(0);
    expect(r.state.bankroll).toBe($(1000) + 3400);
    expect(r.state.stats.byType.small).toMatchObject({ count: 1, won: 3400 });
  });

  it('every 7 loses, including a come-out natural; Tall ignores small numbers', () => {
    let s = bet(bet(game(), 'tall', 1), 'small', 1);
    s = rollTotals(s, [6, 6], [1, 1]);
    expect(only(s, 'tall')!.progress).toEqual([12]);
    expect(only(s, 'small')!.progress).toEqual([2]);
    const r = roll(s, 3, 4);
    expect(r.events.filter((e) => e.type === 'bet-lost')).toHaveLength(2);
    expect(r.state.bets).toHaveLength(0);
  });

  it('All needs every number and pays 175 to 1', () => {
    const s = createGame({
      bankroll: $(100),
      bets: [{ type: 'all', amount: 500, progress: [2, 3, 4, 5, 6, 8, 9, 10, 11] }],
    });
    const r = roll(s, 6, 6);
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'bet-won', profit: 87_500 }));
  });
});

describe('persistence', () => {
  it('saved states without progress still load and resolve', () => {
    const s = bet(game(), 'small', 1);
    const legacy = JSON.parse(JSON.stringify(s)) as GameState;
    // strip the field as an older save would not have it
    legacy.bets = legacy.bets.map((b) => {
      const { progress: _p, ...rest } = b;
      return rest;
    });
    expect(legacy.bets[0]).not.toHaveProperty('progress');
    const r = roll(legacy, 1, 1);
    expect(only(r.state, 'small')!.progress).toEqual([2]);
    const r2 = applyAction(r.state, { type: 'roll', dice: [3, 4] });
    expect(r2.ok && r2.state.bets).toHaveLength(0);
  });
  it('replaying actions is deterministic', () => {
    const a = act(bet(game(), 'fire', 1), { type: 'roll' });
    const b = act(bet(game(), 'fire', 1), { type: 'roll' });
    expect(a.state).toEqual(b.state);
  });
});
