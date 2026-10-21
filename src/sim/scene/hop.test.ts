import { describe, expect, it } from 'vitest';
import { applyAction } from '../engine';
import type { Action } from '../engine';
import { gateAction, initScene, observe, validateScene, type SceneConfig } from './index';

const scene = (extra: Record<string, unknown> = {}) => ({ id: 'hop', version: 1, ...extra });

describe('scene validation: hop', () => {
  it('accepts a hop BetInit with a pair and a hop matcher', () => {
    const r = validateScene(
      scene({
        bets: [{ type: 'hop', amount: 100, hop: [4, 2] }],
        steps: [
          {
            id: 'a',
            text: 'Bet the 3-3 hop',
            expect: [{ type: 'place-bet', betType: 'hop', hop: [3, 3] }],
            completeWhen: { action: { type: 'place-bet', betType: 'hop', hop: [3, 3] } },
            setup: { bets: [{ type: 'hop', amount: 100, hop: [1, 2] }] },
          },
        ],
      }),
    );
    expect(r).toMatchObject({ ok: true });
  });
  it('rejects a hop BetInit without a pair or with a bad pair', () => {
    const r = validateScene(
      scene({
        bets: [
          { type: 'hop', amount: 100 },
          { type: 'hop', amount: 100, hop: [0, 7] },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toContain('bets[0].hop: a hop bet needs a dice pair, e.g. [2, 4]');
    expect(r.errors).toContain('bets[1].hop: must be a pair of dice, each an integer 1-6');
  });
  it('rejects a pair on a non-hop BetInit or matcher', () => {
    const r = validateScene(
      scene({
        bets: [{ type: 'field', amount: 500, hop: [1, 1] }],
        steps: [
          {
            id: 'a',
            text: 'x',
            completeWhen: { action: { type: 'place-bet', betType: 'any-7', hop: [1, 1] } },
          },
          { id: 'b', text: 'y', completeWhen: { action: { type: 'place-bet', hop: [1, 1] } } },
        ],
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual([
      'bets[0].hop: only applies to the "hop" bet type',
      'steps[0].completeWhen.action.hop: only applies to the "hop" bet type',
      'steps[1].completeWhen.action.hop: only applies to the "hop" bet type',
    ]);
  });
  it('rejects the same hop twice in one BetInit list (engine-backed check)', () => {
    const r = validateScene(
      scene({
        bets: [
          { type: 'hop', amount: 100, hop: [2, 5] },
          { type: 'hop', amount: 100, hop: [5, 2] },
        ],
      }),
    );
    expect(r.ok).toBe(false);
  });
});

describe('scene runner: hop matchers', () => {
  const sc: SceneConfig = {
    id: 'hop-run',
    version: 1,
    bankroll: 10_000,
    allowedBets: ['hop'],
    steps: [
      {
        id: 'a',
        text: 'Bet $1 on the 2-4 hop',
        hint: 'Pick 2-4',
        expect: [{ type: 'place-bet', betType: 'hop', amount: 100, hop: [2, 4] }],
        completeWhen: { action: { type: 'place-bet', betType: 'hop', hop: [4, 2] } },
      },
      { id: 'b', text: 'done', completeWhen: { acknowledged: true } },
    ],
  };
  const place = (hop: [number, number]): Action => ({
    type: 'place-bet',
    betType: 'hop',
    amount: 100,
    hop: hop as never,
  });

  it('gates on the pair (either order) and completes the step', () => {
    const { game, runtime } = initScene(sc);
    const wrong = gateAction(sc, runtime, game, place([3, 3]));
    expect(wrong).toMatchObject({ ok: false, message: 'Pick 2-4' });
    expect(gateAction(sc, runtime, game, place([4, 2])).ok).toBe(true);
    const a = place([4, 2]);
    const res = applyAction(game, a);
    if (!res.ok) throw new Error(res.error.message);
    const r = observe(sc, runtime, res.state, { kind: 'action', action: a, events: res.events });
    expect(r.completedStep).toBe('a');
  });
  it('a hop matcher does not match a different pair', () => {
    const { game, runtime } = initScene({
      ...sc,
      steps: [{ ...sc.steps![0]!, expect: undefined }],
    });
    const a = place([1, 2]);
    const res = applyAction(game, a);
    if (!res.ok) throw new Error(res.error.message);
    const r = observe(sc, runtime, res.state, { kind: 'action', action: a, events: res.events });
    expect(r.completedStep).toBeUndefined();
  });
  it('initScene builds hop bets from the scene', () => {
    const { game } = initScene({
      id: 'x',
      version: 1,
      bets: [{ type: 'hop', amount: 200, hop: [6, 5] }],
    });
    expect(game.bets[0]).toMatchObject({ type: 'hop', amount: 200, hop: [5, 6] });
  });
});
