import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine';
import type { Action, BetTypeId, Dice, GameState } from '../engine';
import {
  bandFor,
  challengeConfig,
  challengeScene,
  dailySeed,
  emptyTally,
  observeChallenge,
  scoreChallenge,
  type ChallengeTally,
} from './challenge';
import { initScene, observe } from './runner';
import { validateScene } from './validate';

/** Drives a game with a script of actions and forced dice, feeding the tally like the Simulator does. */
function play(
  seed: number,
  script: Array<Action | Dice>,
): { tally: ChallengeTally; state: GameState } {
  let state = createGame({ seed, bankroll: 50_000 });
  let tally = observeChallenge(emptyTally(), { type: 'ready', state });
  for (const item of script) {
    const action: Action = Array.isArray(item)
      ? { type: 'roll', dice: item as Dice }
      : (item as Action);
    const r = applyAction(state, action);
    if (!r.ok) throw new Error(`${action.type} rejected: ${r.error.message}`);
    state = r.state;
    tally = observeChallenge(tally, {
      type: 'action-confirmed',
      action,
      events: r.events,
      state,
    });
    if (action.type === 'roll')
      tally = observeChallenge(tally, { type: 'rolled', events: r.events, state });
  }
  return { tally, state };
}
const cfg = challengeConfig({
  scoring: { redBetPenalty: 0.005, noOddsPenalty: 0.0025, minWagered: 0 },
});
const score = (t: ChallengeTally) => scoreChallenge(t, cfg, { actualNet: 0, expectedLoss: 0 });
const pass = (amount: number): Action => ({ type: 'place-bet', betType: 'pass-line', amount });
const bet = (betType: BetTypeId, amount: number): Action => ({
  type: 'place-bet',
  betType,
  amount,
});

describe('challenge scoring is about decisions, not dice', () => {
  it('same decisions on different dice and seeds give the same score', () => {
    const a = play(1, [pass(1000), [4, 4], bet('pass-odds', 2000), [3, 4]]); // point 8, seven-out
    const b = play(2, [pass(1000), [5, 5], bet('pass-odds', 2000), [2, 2], [3, 4]]); // point 10
    expect(a.state.history.map((r) => r.total)).not.toEqual(b.state.history.map((r) => r.total));
    expect(score(a.tally).score).toBe(score(b.tally).score);
    expect(score(a.tally)).toMatchObject({ wagered: 3000, redBets: 0, noOddsCycles: 0 });
    // the hand that won and the hand that lost score the same
    const won = play(3, [pass(1000), [4, 4], bet('pass-odds', 2000), [6, 2]]);
    expect(score(won.tally).score).toBe(score(a.tally).score);
    // pass + odds: 7/495 on the $10, nothing on the $20 odds
    expect(score(a.tally).edgePerDollar).toBeCloseTo((1000 * (7 / 495)) / 3000, 12);
  });

  it('red-tier decisions add a penalty each', () => {
    const t = play(1, [pass(1000), bet('any-7', 500), [2, 2]]).tally;
    expect(t.redBets).toBe(1);
    const r = score(t);
    expect(r.score).toBeCloseTo(r.edgePerDollar + 0.005, 12);
    expect(r.edgePerDollar).toBeCloseTo((1000 * (7 / 495) + 500 * (1 / 6)) / 1500, 12);
    const two = play(1, [pass(1000), bet('any-7', 500), [2, 2], bet('hard-8', 100)]).tally;
    expect(two.redBets).toBe(2);
  });

  it('a point cycle with a line bet and no odds costs a penalty; with odds it does not', () => {
    const none = play(1, [pass(1000), [4, 4], [3, 4]]).tally;
    expect(none.noOddsCycles).toBe(1);
    expect(score(none).score).toBeCloseTo(7 / 495 + 0.0025, 12);
    const odds = play(1, [pass(1000), [4, 4], bet('pass-odds', 1000), [3, 4]]).tally;
    expect(odds.noOddsCycles).toBe(0);
    const dont = play(1, [bet('dont-pass', 1000), [4, 4], [3, 4]]).tally;
    expect(dont.noOddsCycles).toBe(1);
    // no line bet: a point cycle on place bets alone is not an odds opportunity
    const place = play(1, [[4, 4], bet('place-6', 1200), [3, 4]]).tally;
    expect(place.noOddsCycles).toBe(0);
  });

  it('set-amount increases count as new money; decreases and removals do not', () => {
    let s = createGame({ seed: 1, bankroll: 50_000 });
    let t = emptyTally();
    const feed = (a: Action) => {
      const r = applyAction(s, a);
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
      t = observeChallenge(t, { type: 'action-confirmed', action: a, events: r.events, state: s });
    };
    feed(pass(1000));
    feed({ type: 'set-amount', betId: 'b1', amount: 2500 });
    expect(t.wagered).toBe(2500);
    feed({ type: 'set-amount', betId: 'b1', amount: 500 });
    expect(t.wagered).toBe(2500);
    feed({ type: 'remove-bet', betId: 'b1' });
    expect(t.wagered).toBe(2500);
  });

  it('needs enough action for a score, then ranks by band', () => {
    const t = play(1, [pass(500), [3, 4]]).tally;
    const r = scoreChallenge(t, challengeConfig(), { actualNet: 500, expectedLoss: 7 });
    expect(r.score).toBeNull();
    expect(r.band).toBe('no-action');
    expect(bandFor(0.003).id).toBe('perfect');
    expect(bandFor(0.004).id).toBe('perfect');
    expect(bandFor(0.0041).id).toBe('sharp');
    expect(bandFor(0.015).id).toBe('solid');
    expect(bandFor(0.04).id).toBe('leaky');
    expect(bandFor(0.2).id).toBe('sucker');
    // no decisions at all is "no action", never a perfect score
    expect(
      scoreChallenge(emptyTally(), challengeConfig(), { actualNet: 0, expectedLoss: 0 }).band,
    ).toBe('no-action');
  });
});

describe('challenge scene', () => {
  it('is a valid scene that completes after the configured rolls', () => {
    const scene = challengeScene({ seed: 7, rolls: 3 });
    const v = validateScene(scene);
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(scene.challenge).toEqual({
      rolls: 3,
      scoring: { redBetPenalty: 0.005, noOddsPenalty: 0.0025, minWagered: 30_000 },
    });
    let { game, runtime } = initScene(scene);
    expect(game.seed).toBe(7);
    for (let i = 0; i < 3; i++) {
      const r = applyAction(game, { type: 'roll' });
      if (!r.ok) throw new Error('roll rejected');
      const o = observe(scene, runtime, r.state, {
        kind: 'action',
        action: { type: 'roll' },
        events: r.events,
      });
      game = o.game;
      runtime = o.runtime;
      expect(!!o.sceneCompleted).toBe(i === 2);
    }
  });
  it('rejects a malformed challenge block', () => {
    const bad = { ...challengeScene({ seed: 1 }), challenge: { rolls: 0, scoring: {} } };
    const v = validateScene(bad);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.errors.join(' ')).toMatch(/challenge\.rolls/);
  });
  it('seed of the day is YYYYMMDD', () => {
    expect(dailySeed(new Date(2026, 9, 21))).toBe(20261021);
  });
});
