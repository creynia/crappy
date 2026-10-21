import type { GameEvent } from '../engine/types';

export type Speed = 'normal' | 'fast' | 'instant';

export type StepKind = 'dice' | 'puck' | 'travel' | 'lose' | 'win' | 'push';
export interface TimelineStep {
  kind: StepKind;
  /** ms from the start of the timeline */
  at: number;
  duration: number;
  events: GameEvent[];
}
export interface Timeline {
  steps: TimelineStep[];
  totalMs: number;
}

const DUR: Record<Exclude<Speed, 'instant'>, Record<StepKind, number>> = {
  normal: { dice: 650, puck: 100, travel: 300, lose: 200, win: 250, push: 100 },
  fast: { dice: 250, puck: 60, travel: 120, lose: 80, win: 100, push: 60 },
};
const TOAST_MS: Record<Speed, number> = { normal: 2500, fast: 1500, instant: 2500 };

export function prefersReducedMotion(): boolean {
  try {
    return (
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  } catch {
    return false;
  }
}

/** OS reduced motion forces instant; otherwise the user's setting (default normal). */
export function effectiveSpeed(
  setting: Speed | undefined,
  reducedMotion: boolean = prefersReducedMotion(),
): Speed {
  return reducedMotion ? 'instant' : (setting ?? 'normal');
}

export function toastDurationMs(speed: Speed): number {
  return TOAST_MS[speed];
}

export function durationFor(kind: StepKind, speed: Speed): number {
  return speed === 'instant' ? 0 : DUR[speed][kind];
}

/** Builds the sequential animation queue from resolved events. Instant speed yields an empty timeline. */
export function buildAnimationQueue(events: readonly GameEvent[], speed: Speed): Timeline {
  if (speed === 'instant') return { steps: [], totalMs: 0 };
  const groups: [StepKind, GameEvent[]][] = [
    ['dice', events.filter((e) => e.type === 'dice-rolled')],
    [
      'puck',
      events.filter(
        (e) => e.type === 'point-established' || e.type === 'point-made' || e.type === 'seven-out',
      ),
    ],
    // come / don't-come chips move to their number before anything is paid or swept
    ['travel', events.filter((e) => e.type === 'bet-travelled')],
    ['lose', events.filter((e) => e.type === 'bet-lost')],
    ['win', events.filter((e) => e.type === 'bet-won')],
    ['push', events.filter((e) => e.type === 'bet-pushed' || e.type === 'bet-returned')],
  ];
  const steps: TimelineStep[] = [];
  let t = 0;
  for (const [kind, evs] of groups) {
    if (!evs.length) continue;
    const duration = durationFor(kind, speed);
    steps.push({ kind, at: t, duration, events: evs });
    t += duration;
  }
  return { steps, totalMs: t };
}

export interface Scheduler {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}
const defaultScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface Player {
  /** Flush everything that has not played yet and finish. Safe to call repeatedly. */
  skip(): void;
  cancel(): void;
  readonly done: boolean;
}

/**
 * Plays a timeline. `onStart(step)` fires when a step begins, `onEnd(step)` when it ends; `onDone` once at the end.
 * `skip()` runs the remaining starts/ends synchronously (tap to skip): the engine state is already final,
 * so only the visuals are flushed.
 */
export function playTimeline(
  timeline: Timeline,
  handlers: {
    onStart?: (s: TimelineStep) => void;
    onEnd?: (s: TimelineStep) => void;
    onDone?: () => void;
  },
  scheduler: Scheduler = defaultScheduler,
): Player {
  let done = false;
  let index = 0;
  let handle: unknown = null;
  let started = false;

  const finish = () => {
    if (done) return;
    done = true;
    handlers.onDone?.();
  };
  const next = () => {
    handle = null;
    if (done) return;
    if (started) handlers.onEnd?.(timeline.steps[index]!);
    if (started) index += 1;
    started = false;
    const step = timeline.steps[index];
    if (!step) return finish();
    started = true;
    handlers.onStart?.(step);
    handle = scheduler.set(next, step.duration);
  };
  next();

  return {
    skip() {
      if (done) return;
      if (handle !== null) scheduler.clear(handle);
      handle = null;
      // end the running step, then start/end each remaining one
      if (started) {
        handlers.onEnd?.(timeline.steps[index]!);
        index += 1;
        started = false;
      }
      for (; index < timeline.steps.length; index++) {
        handlers.onStart?.(timeline.steps[index]!);
        handlers.onEnd?.(timeline.steps[index]!);
      }
      finish();
    },
    cancel() {
      if (handle !== null) scheduler.clear(handle);
      handle = null;
      done = true;
    },
    get done() {
      return done;
    },
  };
}

/** Random intermediate faces for the dice tumble (3 by default). */
export function tumbleFaces(rand: () => number = Math.random, n = 3): [number, number][] {
  const face = () => 1 + Math.floor(rand() * 6);
  return Array.from({ length: n }, () => [face(), face()] as [number, number]);
}
