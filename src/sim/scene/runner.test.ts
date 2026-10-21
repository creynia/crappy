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

describe('autoRoll.bankroll', () => {
  it('accepts integer cents from $5 to $1,000,000 and rejects others', () => {
    expect(
      validateScene({ id: 'x', version: 1, autoRoll: { enabled: true, bankroll: 50_000 } }).ok,
    ).toBe(true);
    const bad = validateScene({
      id: 'x',
      version: 1,
      autoRoll: { enabled: true, bankroll: 499.5 },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join('\n')).toContain('autoRoll.bankroll');
  });
  it('uses the scene table minimum for the bankroll floor', () => {
    const bad = validateScene({
      id: 'x',
      version: 1,
      rules: { tableMin: 1000 },
      autoRoll: { enabled: true, bankroll: 500 },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join('\n')).toContain('autoRoll.bankroll');
  });
  it('checks stopLoss against the auto-roll bankroll, not only the scene bankroll', () => {
    const bad = validateScene({
      id: 'x',
      version: 1,
      bankroll: 100_000,
      autoRoll: { enabled: true, bankroll: 20_000, stopLoss: 25_000 },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join('\n')).toContain('autoRoll.stopLoss');
  });
});
