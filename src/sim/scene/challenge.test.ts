import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine';
import type { Action, BetTypeId, Dice, GameState } from '../engine';
import {
  bandFor,
  bandLabel,
  challengeConfig,
  challengeScene,
  dailySeed,
  emptyTally,
  observeChallenge,
  resolvedEdge,
  scoreChallenge,
  type ChallengeTally,
} from './challenge';
import { initScene, observe } from './runner';
import { validateScene } from './validate';

/** Feeds the tally the way the Simulator does: action-confirmed after every action, rolled after rolls. */
function feed(tally: ChallengeTally, state: GameState, action: Action) {
  const r = applyAction(state, action);
  if (!r.ok) throw new Error(`${action.type} rejected: ${r.error.message}`);
  let t = observeChallenge(tally, {
    type: 'action-confirmed',
    action,
    events: r.events,
    state: r.state,
  });
  if (action.type === 'roll')
    t = observeChallenge(t, { type: 'rolled', events: r.events, state: r.state });
  return { tally: t, state: r.state };
}

/** Plays a strategy for `rolls` rolls: `decide(state)` returns the actions to take before each roll. */
function play(
  seed: number,
  rolls: number,
  decide: (s: GameState) => Action[],
  rules: 'standard-vegas' | 'odds-10x' = 'standard-vegas',
) {
  let state = createGame({ seed, bankroll: 10_000_000, rules });
  let tally = emptyTally();
  for (let i = 0; i < rolls; i++) {
    for (const a of decide(state)) ({ tally, state } = feed(tally, state, a));
    ({ tally, state } = feed(tally, state, { type: 'roll' }));
  }
  return { tally, state };
}
const scored = (t: ChallengeTally) =>
  scoreChallenge(t, challengeConfig({ scoring: { minResolved: 0 } }), {
    actualNet: 0,
    expectedLoss: 0,
  });
const bet = (betType: BetTypeId, amount: number, parentId?: string): Action => ({
  type: 'place-bet',
  betType,
  amount,
  ...(parentId ? { parentId } : {}),
});
const has = (s: GameState, t: BetTypeId) => s.bets.some((b) => b.type === t);

/** Pass line $10 with full 3-4-5x odds. */
const passMaxOdds = (s: GameState): Action[] => {
  const out: Action[] = [];
  if (s.phase === 'come-out' && !has(s, 'pass-line')) out.push(bet('pass-line', 1000));
  if (s.phase === 'point' && has(s, 'pass-line') && !has(s, 'pass-odds'))
    out.push(bet('pass-odds', 1000 * s.rules.maxOdds[s.point!]));
  return out;
};
/** Don't pass $10 with full 6x lay odds. */
const dontMaxLay = (s: GameState): Action[] => {
  const out: Action[] = [];
  if (s.phase === 'come-out' && !has(s, 'dont-pass')) out.push(bet('dont-pass', 1000));
  if (s.phase === 'point' && has(s, 'dont-pass') && !has(s, 'dont-pass-odds'))
    out.push(bet('dont-pass-odds', 1000 * s.rules.maxLayOdds[s.point!]));
  return out;
};

const pp = (x: number) => x * 100; // fraction -> percentage points

describe('challenge scoring: house edge on action, measured at resolution', () => {
  it('pass line + 3-4-5x odds scores 0.374% (+-0.03 pp) on every one of 20 seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { tally } = play(seed, 4000, passMaxOdds);
      expect(Math.abs(pp(scored(tally).score!) - 0.374), `seed ${seed}`).toBeLessThan(0.03);
    }
  });

  it('perfect play over a 300-roll challenge lands in the Perfect band on at least 9 seeds in 10', () => {
    const scores: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const { tally } = play(seed, 300, passMaxOdds);
      scores.push(scored(tally).score!);
    }
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(pp(mean)).toBeGreaterThan(0.33);
    expect(pp(mean)).toBeLessThan(0.43);
    const perfect = scores.filter((s) => bandFor(s).id === 'perfect').length;
    expect(perfect / scores.length).toBeGreaterThanOrEqual(0.9);
  });

  it("don't pass + 6x lay odds lands near 0.273% (1.36% on the flat bet, odds on 2/3 of decisions)", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { tally } = play(seed, 4000, dontMaxLay);
      expect(Math.abs(pp(scored(tally).score!) - 0.273), `seed ${seed}`).toBeLessThan(0.03);
    }
  });

  it('a $1 hard 8 kept up raises the score by its edge share', () => {
    const withHard = (s: GameState): Action[] => [
      ...passMaxOdds(s),
      ...(has(s, 'hard-8') ? [] : [bet('hard-8', 100)]),
    ];
    const a = scored(play(3, 4000, passMaxOdds).tally).score!;
    const b = scored(play(3, 4000, withHard).tally);
    expect(b.score!).toBeGreaterThan(a);
    expect(b.redDecisions).toBeGreaterThan(0);
    // every hard-8 resolution adds $1 at 9.09%, so the lift is small but real
    expect(pp(b.score! - a)).toBeGreaterThan(0.05);
    expect(pp(b.score! - a)).toBeLessThan(1);
  });

  it('toggling odds on and off before they resolve does not change the score', () => {
    const toggling = (s: GameState): Action[] => {
      const out = passMaxOdds(s);
      const odds = s.bets.find((b) => b.type === 'pass-odds');
      if (odds && s.phase === 'point') {
        // take the odds down and put them straight back: nothing was decided
        out.push({ type: 'remove-bet', betId: odds.id });
        out.push(bet('pass-odds', odds.amount));
      }
      return out;
    };
    const plain = scored(play(5, 2000, passMaxOdds).tally);
    const toggled = scored(play(5, 2000, toggling).tally);
    expect(toggled.score).toBe(plain.score);
    expect(toggled.resolved).toBe(plain.resolved);
    expect(toggled.decisions).toBe(plain.decisions);
  });

  it('winning or losing a bet never moves the score: the same hand from either side', () => {
    let s = createGame({ seed: 1, bankroll: 50_000 });
    let t = emptyTally();
    ({ tally: t, state: s } = feed(t, s, bet('pass-line', 1000)));
    ({ tally: t, state: s } = feed(t, s, { type: 'roll', dice: [4, 4] as Dice }));
    ({ tally: t, state: s } = feed(t, s, bet('pass-odds', 5000)));
    const won = feed(t, s, { type: 'roll', dice: [6, 2] as Dice }).tally;
    const lost = feed(t, s, { type: 'roll', dice: [3, 4] as Dice }).tally;
    expect(won.weightedEdge).toBe(lost.weightedEdge);
    expect(won.resolved).toBe(lost.resolved);
    expect(won.resolved).toBe(6000);
    expect(scored(won).score).toBeCloseTo(7 / 495 / 6, 12); // $10 at 1.414% over $60 of action
  });

  it('uses the real amount and rules: buy 4 for $10 vs $20, place 6 at $5 vs $6', () => {
    const rules = createGame({ seed: 1 }).rules;
    expect(resolvedEdge('buy-4', 2000, rules)).toBeCloseTo(1 / 60, 12);
    expect(resolvedEdge('buy-4', 1000, rules)).toBeGreaterThan(resolvedEdge('buy-4', 2000, rules));
    expect(resolvedEdge('place-6', 600, rules)).toBeCloseTo(1 / 66, 12);
    expect(resolvedEdge('place-6', 500, rules)).toBeGreaterThan(1 / 66);
    expect(resolvedEdge('pass-odds', 3000, rules)).toBe(0);
    expect(resolvedEdge('pass-line', 1000, rules)).toBeCloseTo(7 / 495, 12);
    expect(resolvedEdge('come', 1000, rules)).toBeCloseTo(7 / 495, 12);
    expect(resolvedEdge('any-7', 500, rules)).toBeCloseTo(1 / 6, 12);
  });

  it('observations: red bets decided and point cycles played without odds, not in the score', () => {
    const noOdds = (s: GameState): Action[] =>
      s.phase === 'come-out' && !has(s, 'pass-line') ? [bet('pass-line', 1000)] : [];
    const r = scored(play(2, 1000, noOdds).tally);
    expect(r.noOddsCycles).toBeGreaterThan(0);
    expect(r.redDecisions).toBe(0);
    expect(pp(r.score!)).toBeCloseTo(pp(7 / 495), 6); // flat pass: exactly 1.414%
    const dont = scored(
      play(2, 1000, (s) =>
        s.phase === 'come-out' && !has(s, 'dont-pass') ? [bet('dont-pass', 1000)] : [],
      ).tally,
    );
    expect(dont.noOddsCycles).toBeGreaterThan(0);
    expect(pp(dont.score!)).toBeCloseTo(pp(3 / 220), 6);
  });

  it('needs enough decided action for a score, then ranks by band', () => {
    let s = createGame({ seed: 1, bankroll: 50_000 });
    let t = emptyTally();
    ({ tally: t, state: s } = feed(t, s, bet('pass-line', 500)));
    ({ tally: t } = feed(t, s, { type: 'roll', dice: [3, 4] as Dice }));
    const r = scoreChallenge(t, challengeConfig(), { actualNet: 500, expectedLoss: 7 });
    expect(r.score).toBeNull();
    expect(r.band).toBe('no-action');
    expect(bandFor(0.003).id).toBe('perfect');
    expect(bandFor(0.0045).id).toBe('perfect');
    expect(bandFor(0.0046).id).toBe('sharp');
    expect(bandFor(0.015).id).toBe('solid');
    expect(bandFor(0.04).id).toBe('leaky');
    expect(bandFor(0.2).id).toBe('sucker');
    expect(bandLabel('sharp')).toBe('Sharp');
    expect(bandLabel('no-action')).toBe('Not enough action');
    expect(
      scoreChallenge(emptyTally(), challengeConfig(), { actualNet: 0, expectedLoss: 0 }).band,
    ).toBe('no-action');
  });
});

describe('challenge scene', () => {
  it('is a valid scene without Restart that completes after the configured rolls', () => {
    const scene = challengeScene({ seed: 7, rolls: 3 });
    const v = validateScene(scene);
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(scene.challenge).toEqual({ rolls: 3, scoring: { minResolved: 30_000 } });
    expect(scene.ui).toMatchObject({ showRestart: false, stepPanelLabel: 'Challenge' });
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
