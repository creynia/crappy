import { describe, expect, it } from 'vitest';
import { answeredRequirements } from './conditions';
import { applyAction } from '../engine';
import {
  gateAction,
  initScene,
  observe,
  rollLock,
  runScript,
  stageFor,
  validateScene,
  type SceneConfig,
} from './index';
import type { Dice } from '../engine/types';
import type { Condition } from './types';

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

  it('accepts autoRoll.chart edge and bankroll, rejects others', () => {
    const base = { id: 'x', version: 1 as const };
    for (const chart of ['edge', 'bankroll']) {
      expect(validateScene({ ...base, autoRoll: { enabled: true, chart } }).ok).toBe(true);
    }
    const bad = validateScene({ ...base, autoRoll: { enabled: true, chart: 'pie' } });
    expect(bad.ok).toBe(false);
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

describe('answeredRequirements', () => {
  it('finds answered conditions in nested trees and ignores bad shapes', () => {
    expect(
      answeredRequirements({
        all: [{ any: [{ answered: 'correct' }, { rolls: 1 }] }, { answered: true }],
      }),
    ).toEqual(['correct', true]);
    expect(answeredRequirements({ rolls: 2 })).toEqual([]);
    expect(answeredRequirements({ all: 'x' })).toEqual([]);
    expect(answeredRequirements(null)).toEqual([]);
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
    // an `all` of only answered conditions still has nothing to wait for
    expect(
      validateScene(mkScene(ask, { all: [{ answered: true }, { answered: 'correct' }] })).ok,
    ).toBe(false);
    // the walker finds answered conditions nested at any depth
    expect(
      validateScene(mkScene(undefined, { all: [{ any: [{ answered: 'correct' }] }, { rolls: 1 }] }))
        .ok,
    ).toBe(false); // answered without an ask
    expect(
      validateScene(mkScene(ask, { all: [{ any: [{ answered: 'correct' }] }, { rolls: 1 }] })).ok,
    ).toBe(true);
    expect(validateScene(mkScene(ask, { answered: 'wrong' }, 'button')).ok).toBe(false);
    expect(validateScene(mkScene(ask, { answered: 'correct' }, 'button')).ok).toBe(true);
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

// ---- richer conditions (I018) ----

type Act = Parameters<typeof applyAction>[1];

/** Plays actions through the runner; returns the step completed by each action (undefined if none). */
function play(scene: SceneConfig, actions: Act[]) {
  let { game, runtime } = initScene(scene);
  const completed: (string | undefined)[] = [];
  for (const action of actions) {
    const res = applyAction(game, action);
    if (!res.ok) throw new Error(`illegal ${action.type}`);
    const r = observe(scene, runtime, res.state, { kind: 'action', action, events: res.events });
    completed.push(r.completedStep);
    game = r.game;
    runtime = r.runtime;
  }
  return completed;
}

const place = (betType: string, amount: number): Act =>
  ({ type: 'place-bet', betType, amount }) as Act;

describe('richer step conditions', () => {
  const comeScene = (completeWhen: Condition): SceneConfig => ({
    id: 'come',
    version: 1,
    bankroll: 10000,
    phase: 'point',
    point: 8,
    forcedDice: [[3, 3]],
    allowedBets: ['come'],
    steps: [{ id: 'come', text: 'come', completeWhen }],
  });

  it('betOnTable with point: a come bet travelled to 6 completes, to 5 does not', () => {
    expect(
      play(comeScene({ betOnTable: { type: 'come', point: 6 } }), [
        place('come', 500),
        { type: 'roll' },
      ]),
    ).toEqual([undefined, 'come']);
    expect(
      play(comeScene({ betOnTable: { type: 'come', point: 5 } }), [
        place('come', 500),
        { type: 'roll' },
      ]),
    ).toEqual([undefined, undefined]);
  });

  it('betResolved: won completes on the win, lost does not', () => {
    const passScene = (result: 'won' | 'lost', dice: [number, number]): SceneConfig => ({
      id: 'pass',
      version: 1,
      bankroll: 10000,
      phase: 'come-out',
      forcedDice: [dice as Dice],
      allowedBets: ['pass-line'],
      steps: [
        { id: 'bet', text: 'bet', completeWhen: { betOnTable: { type: 'pass-line' } } },
        { id: 'res', text: 'res', completeWhen: { betResolved: { type: 'pass-line', result } } },
      ],
    });
    expect(play(passScene('won', [3, 4]), [place('pass-line', 500), { type: 'roll' }])).toEqual([
      'bet',
      'res',
    ]);
    expect(play(passScene('lost', [3, 4]), [place('pass-line', 500), { type: 'roll' }])).toEqual([
      'bet',
      undefined,
    ]);
    // craps (2) loses the pass line: 'lost' completes, and an unqualified betResolved completes too
    expect(play(passScene('lost', [1, 1]), [place('pass-line', 500), { type: 'roll' }])).toEqual([
      'bet',
      'res',
    ]);
  });

  it('equity bounds nest inside all and not; a losing roll drops equity to 9500', () => {
    // equity = bankroll + bets. Placing a bet does not change it, and a condition already true at
    // step start completes at once, so the equity step waits for the craps roll that loses $5.
    const scene: SceneConfig = {
      id: 'eq',
      version: 1,
      bankroll: 10000,
      phase: 'come-out',
      forcedDice: [[1, 1]],
      allowedBets: ['pass-line'],
      steps: [
        { id: 'bet', text: 'bet', completeWhen: { betOnTable: { type: 'pass-line' } } },
        {
          id: 'lost',
          text: 'lost',
          completeWhen: {
            all: [{ equityAtMost: 9500 }, { not: { equityAtLeast: 9501 } }],
          },
        },
      ],
    };
    expect(play(scene, [place('pass-line', 500), { type: 'roll' }])).toEqual(['bet', 'lost']);
    // before the roll the same step is not complete: equity is still $100
    expect(play(scene, [place('pass-line', 500)])).toEqual(['bet']);
    const anyScene: SceneConfig = {
      ...scene,
      steps: [
        scene.steps![0]!,
        {
          id: 'any',
          text: 'any',
          completeWhen: { any: [{ equityAtLeast: 10001 }, { equityAtMost: 9500 }] },
        },
      ],
    };
    expect(play(anyScene, [place('pass-line', 500), { type: 'roll' }])).toEqual(['bet', 'any']);
  });

  it('not inverts a bet condition inside all', () => {
    const scene: SceneConfig = {
      id: 'not',
      version: 1,
      bankroll: 10000,
      phase: 'come-out',
      allowedBets: ['pass-line', 'dont-pass'],
      steps: [
        {
          id: 'a',
          text: 'a',
          completeWhen: {
            all: [
              { betOnTable: { type: 'dont-pass' } },
              { not: { betOnTable: { type: 'pass-line' } } },
            ],
          },
        },
      ],
    };
    expect(play(scene, [place('dont-pass', 500)])).toEqual(['a']);
    expect(play(scene, [place('pass-line', 500), place('dont-pass', 500)])).toEqual([
      undefined,
      undefined,
    ]);
  });
});

describe('validate richer conditions', () => {
  const scene = (completeWhen: unknown) => ({
    id: 'v',
    version: 1,
    allowedBets: ['come'],
    steps: [{ id: 's', text: 's', completeWhen }],
  });

  it('accepts the new condition kinds', () => {
    expect(validateScene(scene({ betOnTable: { type: 'come', point: 6 } })).ok).toBe(true);
    expect(validateScene(scene({ betResolved: { type: 'come', result: 'won' } })).ok).toBe(true);
    expect(validateScene(scene({ equityAtLeast: 0 })).ok).toBe(true);
    expect(validateScene(scene({ equityAtLeast: -500 })).ok).toBe(false);
    expect(validateScene(scene({ not: { equityAtMost: 0 } })).ok).toBe(true);
  });

  it('rejects bad values with a path', () => {
    const r = validateScene(scene({ betOnTable: { type: 'come', point: 7 } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain('betOnTable.point');
    const r2 = validateScene(scene({ betResolved: { type: 'come', result: 'push' } }));
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.errors.join('\n')).toContain('betResolved.result');
    const r3 = validateScene(scene({ not: { equityAtLeast: 1.5 } }));
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.errors.join('\n')).toContain('not.equityAtLeast');
  });
});

describe('richer conditions: resolution edge cases (I018 review)', () => {
  it("betResolved 'pushed': dont-pass on a 12 is a push", () => {
    const scene: SceneConfig = {
      id: 'push',
      version: 1,
      bankroll: 10000,
      phase: 'come-out',
      forcedDice: [[6, 6]],
      allowedBets: ['dont-pass'],
      steps: [
        { id: 'bet', text: 'bet', completeWhen: { betOnTable: { type: 'dont-pass' } } },
        {
          id: 'res',
          text: 'res',
          completeWhen: { betResolved: { type: 'dont-pass', result: 'pushed' } },
        },
      ],
    };
    expect(play(scene, [place('dont-pass', 500), { type: 'roll' }])).toEqual(['bet', 'res']);
  });

  it('a come bet that travels to 6 does not count as resolved', () => {
    const scene: SceneConfig = {
      id: 'travel',
      version: 1,
      bankroll: 10000,
      phase: 'point',
      point: 8,
      forcedDice: [[3, 3]],
      allowedBets: ['come'],
      steps: [
        { id: 'a', text: 'a', completeWhen: { betOnTable: { type: 'come', point: 6 } } },
        { id: 'b', text: 'b', completeWhen: { betResolved: { type: 'come' } } },
      ],
    };
    // travelling happens on the roll and completes step a; step b (resolution) stays open
    expect(play(scene, [place('come', 500), { type: 'roll' }])).toEqual([undefined, 'a']);
  });

  it('an unqualified betResolved completes on a win', () => {
    const scene: SceneConfig = {
      id: 'any',
      version: 1,
      bankroll: 10000,
      phase: 'come-out',
      forcedDice: [[3, 4]],
      allowedBets: ['pass-line'],
      steps: [
        { id: 'bet', text: 'bet', completeWhen: { betOnTable: { type: 'pass-line' } } },
        { id: 'res', text: 'res', completeWhen: { betResolved: { type: 'pass-line' } } },
      ],
    };
    expect(play(scene, [place('pass-line', 500), { type: 'roll' }])).toEqual(['bet', 'res']);
  });
});

describe('validate richer conditions: rejections (I018 review)', () => {
  const scene = (completeWhen: unknown) => ({
    id: 'v',
    version: 1,
    allowedBets: ['come', 'pass-line'],
    steps: [{ id: 's', text: 's', completeWhen }],
  });

  it('rejects an unknown bet id in betResolved and betOnTable', () => {
    const r = validateScene(scene({ betResolved: { type: 'nope' } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain('betResolved.type');
    expect(validateScene(scene({ betOnTable: { type: 'nope' } })).ok).toBe(false);
  });

  it('rejects an empty not', () => {
    const r = validateScene(scene({ not: {} }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join('\n')).toContain('exactly one condition key');
  });

  it('rejects point on a bet that is not a come, dont-come or odds bet', () => {
    const r = validateScene(scene({ betOnTable: { type: 'pass-line', point: 6 } }));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors.join('\n')).toContain('point only applies to come, dont-come and odds bets');
    expect(validateScene(scene({ betOnTable: { type: 'pass-odds', point: 6 } })).ok).toBe(true);
    expect(validateScene(scene({ betOnTable: { type: 'come', point: 6 } })).ok).toBe(true);
  });
});

describe('demo scripts (SceneStep.play)', () => {
  const demo: SceneConfig = {
    id: 'demo',
    version: 1,
    bankroll: 50_000,
    phase: 'point',
    point: 6,
    bets: [{ type: 'pass-line', amount: 1000 }],
    steps: [
      {
        id: 'watch',
        text: 'Watch the dealer',
        completeWhen: { acknowledged: true },
        play: [
          { action: { type: 'place-bet', betType: 'come', amount: 1000 }, say: 'A Come bet' },
          { action: { type: 'roll', dice: [5, 4] }, say: '9 moves it' },
          { action: { type: 'place-bet', betType: 'come', amount: 1000 } },
          { action: { type: 'roll', dice: [3, 6] }, pauseMs: 100 },
        ],
      },
    ],
  };

  it('plays a 4-action script deterministically to the expected state', () => {
    const play = demo.steps![0]!.play!;
    const stage = stageFor(demo, 0);
    const r = runScript(stage, play);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error('x');
    expect(r.frames).toHaveLength(4);
    // the same actions applied by hand
    let g = stage;
    for (const f of play) {
      const a = applyAction(g, f.action);
      if (!a.ok) throw new Error('x');
      g = a.state;
    }
    expect(r.game).toEqual(g);
    // the older Come bet won on the 9 while the new one travelled to it
    const second = r.frames[3]!.events.map((e) => e.type);
    expect(second).toContain('bet-won');
    expect(second).toContain('bet-travelled');
    expect(runScript(stage, play).game).toEqual(r.game); // deterministic
  });

  it('stops at an illegal frame and says which', () => {
    const stage = stageFor({ ...demo, phase: 'come-out', point: null }, 0);
    const r = runScript(stage, [{ action: { type: 'place-bet', betType: 'come', amount: 1000 } }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.index).toBe(0);
  });

  it('validate accepts the script and rejects illegal or malformed frames with the step id', () => {
    expect(validateScene(demo).ok).toBe(true);
    const bad: SceneConfig = {
      ...demo,
      phase: 'come-out',
      point: null,
      bets: [],
    };
    const r = validateScene(bad);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors.join('\n')).toMatch(/step "watch".*play\[0\]|play\[0\].*step "watch"/);
    const malformed = validateScene({
      ...demo,
      steps: [{ ...demo.steps![0]!, play: [{ action: { type: 'dance' } }] }],
    });
    expect(malformed.ok).toBe(false);
  });

  it('validate: a demo step must complete with acknowledged and roll with forced dice', () => {
    const step0 = demo.steps![0]!;
    const noAck = validateScene({ ...demo, steps: [{ ...step0, completeWhen: { rolls: 1 } }] });
    expect(noAck.ok).toBe(false);
    if (!noAck.ok) expect(noAck.errors.join('\n')).toContain('must complete with acknowledged');
    const unforced = validateScene({
      ...demo,
      steps: [{ ...step0, play: [{ action: { type: 'roll' } }] }],
    });
    expect(unforced.ok).toBe(false);
  });

  it('validate: a demo step after the first must stage its own table', () => {
    const first = { id: 'a', text: 'a', completeWhen: { acknowledged: true } } as const;
    const second = demo.steps![0]!;
    const bad = validateScene({ ...demo, steps: [first, { ...second, id: 'b' }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join('\n')).toMatch(/step "b".*replaceBets/);
    const good = validateScene({
      ...demo,
      steps: [
        first,
        { ...second, id: 'b', setup: { replaceBets: true, phase: 'come-out', bets: [] } },
      ],
    });
    // come bets are illegal on a come-out: the staged table is what the script is checked against
    expect(good.ok).toBe(false);
    const ok = validateScene({
      ...demo,
      steps: [
        first,
        {
          ...second,
          id: 'b',
          setup: {
            replaceBets: true,
            phase: 'point',
            point: 6,
            bets: [{ type: 'pass-line', amount: 1000 }],
          },
        },
      ],
    });
    expect(ok.ok).toBe(true);
  });
});
