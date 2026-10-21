import { describe, expect, it, vi } from 'vitest';
import type { GameEvent } from '../engine/types';
import {
  buildAnimationQueue,
  effectiveSpeed,
  playTimeline,
  prefersReducedMotion,
  type Scheduler,
} from './animation';

const events: GameEvent[] = [
  {
    type: 'dice-rolled',
    roll: {
      n: 1,
      dice: [3, 3],
      total: 6,
      hard: true,
      phaseBefore: 'point',
      pointBefore: 6,
      forced: false,
      net: 0,
    },
  },
  { type: 'point-made', point: 6 },
  { type: 'bet-lost', betId: 'b2', betType: 'field', amount: 500 },
  {
    type: 'bet-won',
    betId: 'b1',
    betType: 'pass-line',
    amount: 1000,
    profit: 1000,
    vig: 0,
    staysUp: true,
  },
];

describe('buildAnimationQueue', () => {
  it('instant speed is an empty timeline', () => {
    expect(buildAnimationQueue(events, 'instant')).toEqual({ steps: [], totalMs: 0 });
  });
  it('normal: about 1.1s in total, in order', () => {
    const t = buildAnimationQueue(events, 'normal');
    expect(t.steps.map((s) => [s.kind, s.at, s.duration])).toEqual([
      ['dice', 0, 650],
      ['puck', 650, 100],
      ['lose', 750, 150],
      ['win', 900, 200],
    ]);
    expect(t.totalMs).toBe(1100);
  });
  it('normal totals for the common rolls are unchanged by the travel step', () => {
    const dice = events[0]!;
    const total = (evs: GameEvent[]) => buildAnimationQueue(evs, 'normal').totalMs;
    const travel: GameEvent = { type: 'bet-travelled', betId: 'b3', betType: 'come', point: 6 };
    // sweep (dice + lose), seven-out (dice + puck + lose), point made (dice + puck + win)
    expect(total([dice, events[2]!])).toBe(800);
    expect(total([dice, { type: 'seven-out', point: 6 }, events[2]!])).toBe(900);
    expect(total([dice, events[1]!, events[3]!])).toBe(950);
    // a come bet travelling on a plain number: just the dice plus a short slide
    expect(total([dice, travel])).toBeLessThanOrEqual(650 + 200);
    // the worst case (point made, travel, sweep and payout) grows by the travel step only
    expect(total([dice, events[1]!, travel, events[2]!, events[3]!])).toBeLessThanOrEqual(
      1100 + 200,
    );
  });
  it('come-bet travel plays after the puck and before sweeps and payouts', () => {
    const withTravel: GameEvent[] = [
      events[0]!,
      { type: 'bet-travelled', betId: 'b3', betType: 'come', point: 6 },
      { type: 'point-established', point: 6 },
      events[2]!,
      events[3]!,
      { type: 'bet-pushed', betId: 'b4', betType: 'dont-pass', amount: 500 },
    ];
    const t = buildAnimationQueue(withTravel, 'normal');
    expect(t.steps.map((s) => s.kind)).toEqual(['dice', 'puck', 'travel', 'lose', 'win', 'push']);
    expect(t.steps[2]!.events).toEqual([withTravel[1]]);
    expect(t.totalMs).toBeLessThanOrEqual(1400);
    expect(buildAnimationQueue(withTravel, 'fast').totalMs).toBeLessThan(700);
    expect(buildAnimationQueue(withTravel, 'instant').steps).toEqual([]);
  });
  it('fast is shorter', () => {
    expect(buildAnimationQueue(events, 'fast').totalMs).toBeLessThan(1000);
  });
});

describe('speed defaults', () => {
  it('reduced motion forces instant, otherwise the setting applies', () => {
    expect(effectiveSpeed(undefined, true)).toBe('instant');
    expect(effectiveSpeed(undefined, false)).toBe('normal');
    expect(effectiveSpeed('fast', true)).toBe('instant');
    expect(effectiveSpeed('fast', false)).toBe('fast');
  });
  it('reads matchMedia', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(prefersReducedMotion()).toBe(true);
    expect(effectiveSpeed(undefined)).toBe('instant');
    vi.unstubAllGlobals();
  });
});

describe('playTimeline', () => {
  const manual = () => {
    const q: { fn: () => void; h: number }[] = [];
    let id = 0;
    const s: Scheduler = {
      set: (fn) => {
        q.push({ fn, h: ++id });
        return id;
      },
      clear: (h) => {
        const i = q.findIndex((x) => x.h === h);
        if (i >= 0) q.splice(i, 1);
      },
    };
    return { s, q };
  };
  it('plays steps sequentially', () => {
    const { s, q } = manual();
    const log: string[] = [];
    const p = playTimeline(
      buildAnimationQueue(events, 'normal'),
      {
        onStart: (x) => log.push('+' + x.kind),
        onEnd: (x) => log.push('-' + x.kind),
        onDone: () => log.push('done'),
      },
      s,
    );
    expect(log).toEqual(['+dice']);
    q.shift()!.fn();
    expect(log).toEqual(['+dice', '-dice', '+puck']);
    expect(p.done).toBe(false);
  });
  it('skip flushes the rest and finishes once', () => {
    const { s } = manual();
    const log: string[] = [];
    const p = playTimeline(
      buildAnimationQueue(events, 'normal'),
      {
        onStart: (x) => log.push('+' + x.kind),
        onEnd: (x) => log.push('-' + x.kind),
        onDone: () => log.push('done'),
      },
      s,
    );
    p.skip();
    p.skip();
    expect(log).toEqual([
      '+dice',
      '-dice',
      '+puck',
      '-puck',
      '+lose',
      '-lose',
      '+win',
      '-win',
      'done',
    ]);
    expect(p.done).toBe(true);
  });
  it('an empty timeline is done immediately', () => {
    const onDone = vi.fn();
    const p = playTimeline({ steps: [], totalMs: 0 }, { onDone });
    expect(onDone).toHaveBeenCalledOnce();
    expect(p.done).toBe(true);
  });
});
