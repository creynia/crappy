import { describe, expect, it } from 'vitest';
import { applyAction } from '../engine';
import { gateAction, initScene, observe, rollLock, validateScene, type SceneConfig } from './index';

const base: SceneConfig = {
  id: 's',
  version: 1,
  bankroll: 10000,
  phase: 'come-out',
  forcedDice: [[3, 4]],
  allowedBets: ['pass-line'],
  steps: [
    {
      id: 'a',
      text: 'a',
      hint: 'place it',
      expect: [{ type: 'place-bet', betType: 'pass-line', amount: 500 }],
      completeWhen: { betOnTable: { type: 'pass-line' } },
    },
    { id: 'b', text: 'b', advance: 'button', completeWhen: { event: 'natural' } },
    { id: 'c', text: 'c', completeWhen: { acknowledged: true } },
  ],
};

describe('scene runner', () => {
  it('gates with the step hint and completes steps', () => {
    let { game, runtime } = initScene(base);
    const bad = gateAction(base, runtime, game, {
      type: 'place-bet',
      betType: 'pass-line',
      amount: 1000,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toBe('place it');
    expect(rollLock(base, runtime, game)).toBeTruthy();
    const action = { type: 'place-bet', betType: 'pass-line', amount: 500 } as const;
    const res = applyAction(game, action);
    if (!res.ok) throw new Error('x');
    let r = observe(base, runtime, res.state, { kind: 'action', action, events: res.events });
    expect(r.completedStep).toBe('a');
    game = r.game;
    runtime = r.runtime;
    const roll = applyAction(game, { type: 'roll' });
    if (!roll.ok) throw new Error('x');
    r = observe(base, runtime, roll.state, {
      kind: 'action',
      action: { type: 'roll' },
      events: roll.events,
    });
    expect(r.completedStep).toBe('b');
    expect(r.runtime.satisfied).toBe(true);
    expect(r.runtime.stepIndex).toBe(1);
    r = observe(base, r.runtime, r.game, { kind: 'acknowledged' });
    expect(r.runtime.stepIndex).toBe(2);
    r = observe(base, r.runtime, r.game, { kind: 'acknowledged' });
    expect(r.sceneCompleted).toBe(true);
  });

  it('rejects bad scenes strictly', () => {
    const r = validateScene({
      id: 'x',
      version: 1,
      bankroll: 10.5,
      allowedBets: ['nope'],
      forcedDice: [[7, 1]],
      oops: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const t = r.errors.join('\n');
      expect(t).toContain('bankroll');
      expect(t).toContain('allowedBets[0]');
      expect(t).toContain('forcedDice[0]');
      expect(t).toContain('unknown key "oops"');
    }
  });

  it('accepts autoRoll.compare specs', () => {
    const r = validateScene({
      id: 'x',
      version: 1,
      autoRoll: {
        enabled: true,
        compare: [
          { id: 'pass-max-odds', unit: 500, oddsMultiple: 0 },
          { id: 'field-every-roll', unit: 500 },
        ],
      },
    });
    expect(r.ok).toBe(true);
  });

  it('accepts autoRoll stopWin / stopLoss defaults in integer cents and rejects other values', () => {
    const ok = validateScene({
      id: 'x',
      version: 1,
      autoRoll: { enabled: true, stopWin: 5000, stopLoss: 10000 },
    });
    expect(ok.ok).toBe(true);
    const bad = validateScene({
      id: 'x',
      version: 1,
      autoRoll: { enabled: true, stopWin: 50.5, stopLoss: 0 },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      const t = bad.errors.join('\n');
      expect(t).toContain('autoRoll.stopWin');
      expect(t).toContain('autoRoll.stopLoss');
    }
  });
  it('validates autoRoll.sweep', () => {
    const mk = (sweep: unknown) =>
      validateScene({ id: 'x', version: 1, autoRoll: { enabled: true, sweep } });
    expect(mk({ strategy: 'pass-max-odds', oddsMultiples: [0, 1, 'max', 100] }).ok).toBe(true);
    const bad = mk({ strategy: 'nope', oddsMultiples: [0, 'big'] });
    expect(bad.ok).toBe(false);
  });
});

describe('step ask (in-sim question)', () => {
  const ask = {
    q: 'What happens?',
    options: ['a', 'b', 'c'],
    answer: 1,
    explain: 'because',
  };
  const scene = (cond: 'correct' | true, mode?: 'any'): SceneConfig => ({
    id: 'q',
    version: 1,
    bankroll: 10000,
    phase: 'come-out',
    forcedDice: [[3, 4]],
    allowedActions: ['roll'],
    steps: [
      {
        id: 'ask',
        text: 'call it',
        ask: { ...ask, ...(mode ? { mode } : {}) },
        completeWhen: { all: [{ answered: cond }, { rolls: 1 }] },
      },
      { id: 'end', text: 'end', completeWhen: { acknowledged: true } },
    ],
  });
  it('locks Roll until answered, then unlocks (any answer)', () => {
    const sc = scene(true);
    const { game, runtime } = initScene(sc);
    expect(rollLock(sc, runtime, game)).toBe('Answer the question first.');
    const r = observe(sc, runtime, game, { kind: 'answered', correct: false });
    expect(rollLock(sc, r.runtime, r.game)).toBeNull();
  });
  it("'correct' stays locked after a wrong answer and allows retry", () => {
    const sc = scene('correct');
    const { game, runtime } = initScene(sc);
    let r = observe(sc, runtime, game, { kind: 'answered', correct: false });
    expect(rollLock(sc, r.runtime, r.game)).toBe('Answer the question first.');
    expect(r.runtime.stepIndex).toBe(0);
    r = observe(sc, r.runtime, r.game, { kind: 'answered', correct: true });
    expect(rollLock(sc, r.runtime, r.game)).toBeNull();
    // answering alone does not complete the step: the roll still has to happen
    expect(r.completedStep).toBeUndefined();
    const roll = applyAction(r.game, { type: 'roll' });
    if (!roll.ok) throw new Error('roll');
    const done = observe(sc, r.runtime, roll.state, {
      kind: 'action',
      action: { type: 'roll' },
      events: roll.events,
    });
    expect(done.completedStep).toBe('ask');
  });
  it("mode 'any' never locks the roll", () => {
    const sc = scene(true, 'any');
    const { game, runtime } = initScene(sc);
    expect(rollLock(sc, runtime, game)).toBeNull();
  });
  it('validates ask shape, answer range and answered-without-ask', () => {
    const mkScene = (a: unknown, cw: unknown = { answered: true }, advance?: 'button') => ({
      id: 'v',
      version: 1,
      steps: [
        {
          id: 's',
          text: 't',
          ...(a === undefined ? {} : { ask: a }),
          ...(advance ? { advance } : {}),
          completeWhen: cw,
        },
      ],
    });
    // the feedback must be seen: a bare answered condition needs advance: button
    expect(validateScene(mkScene(ask)).ok).toBe(false);
    expect(validateScene(mkScene(ask, { answered: true }, 'button')).ok).toBe(true);
    expect(validateScene(mkScene(ask, { all: [{ answered: true }, { rolls: 1 }] })).ok).toBe(true);
    expect(validateScene(mkScene(ask, { all: [{ answered: true }] })).ok).toBe(false);
    expect(validateScene(mkScene({ ...ask, answer: 3 }, { answered: true }, 'button')).ok).toBe(
      false,
    );
    expect(validateScene(mkScene({ ...ask, answer: -1 }, { answered: true }, 'button')).ok).toBe(
      false,
    );
    expect(
      validateScene(mkScene({ ...ask, options: ['only'] }, { answered: true }, 'button')).ok,
    ).toBe(false);
    expect(validateScene(mkScene({ ...ask, mode: 'never' }, { answered: true }, 'button')).ok).toBe(
      false,
    );
    expect(validateScene(mkScene({ ...ask, extra: 1 }, { answered: true }, 'button')).ok).toBe(
      false,
    );
    expect(validateScene(mkScene(undefined)).ok).toBe(false);
    expect(validateScene(mkScene(ask, { answered: 'wrong' }, 'button')).ok).toBe(false);
    expect(validateScene(mkScene(ask, { answered: 'correct' }, 'button')).ok).toBe(true);
  });
});
