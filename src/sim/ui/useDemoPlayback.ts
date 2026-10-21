import { useEffect, useRef, useState } from 'preact/hooks';
import type { Action } from '../engine/types';
import type { PlayFrame, SceneStep } from '../scene/types';
import type { Speed } from './animation';
import type { Core } from './simCore';

/** Pause after a frame when it sets none, by speed (instant plays everything at once). */
const DEFAULT_PAUSE: Record<Speed, number> = { normal: 1600, fast: 800, instant: 0 };

export interface DemoPlaybackOptions {
  step: SceneStep | undefined;
  stepIndex: number;
  done: boolean;
  coreRef: { current: Core };
  setCore: (c: Core) => void;
  /** dispatches through the engine and the scene runner; `scripted` skips the step's action gate */
  doAction: (action: Action, opts?: { scripted?: boolean }) => unknown;
  getSpeed: () => Speed;
  /** the one live announcer, so narration reaches screen readers */
  announce: (text: string) => void;
  /** stop roll animations (replay and skip) */
  clearAnimation: () => void;
  skipAnimation: () => void;
  /** a roll animation is running: the demo only counts as over once the last one has played */
  animBusy: boolean;
}

/**
 * Demo steps (`SceneStep.play`): plays the scripted actions one at a time with captions when the
 * step starts, then hands control back. `replay` restores the state the step started from and plays
 * again; `skip` runs the remaining frames at once. At instant speed everything plays in one go.
 */
export function useDemoPlayback(o: DemoPlaybackOptions) {
  const [playing, setPlaying] = useState(false);
  const [epoch, setEpoch] = useState(0);
  /** every frame has been dispatched; waiting for the last roll animation */
  const [tail, setTail] = useState(false);
  /** the demo of the current step has played at least once, so Replay makes sense */
  const [canReplay, setCanReplay] = useState(false);
  /** the captions of the demo so far, shown in the step panel (at instant speed they all arrive at once) */
  const [captions, setCaptions] = useState<string[]>([]);
  /** true from the first frame until the last roll animation ends: scripted rolls stay out of the roll log */
  const active = useRef(false);
  const spoken = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queue = useRef<PlayFrame[]>([]);
  const startedFor = useRef(-1);
  const snapshot = useRef<Core | null>(null);
  const opts = useRef(o);
  opts.current = o;

  const stopTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  const finish = () => {
    stopTimer();
    queue.current = [];
    active.current = false;
    // at instant speed the narration is announced once, whole, instead of being overwritten
    if (spoken.current.length) opts.current.announce(spoken.current.join(' '));
    spoken.current = [];
    setPlaying(false);
    setTail(false);
    setCanReplay(startedFor.current >= 0);
  };
  /** plays one frame; false when the engine refused it (the demo stops there) */
  const dispatch = (f: PlayFrame): boolean => {
    if (f.say) {
      setCaptions((c) => [...c, f.say!]);
      if (opts.current.getSpeed() === 'instant') spoken.current.push(f.say);
      else opts.current.announce(f.say);
    }
    const r = opts.current.doAction(f.action, { scripted: true }) as { ok?: boolean };
    return r.ok !== false;
  };
  const next = () => {
    timer.current = null;
    const f = queue.current.shift();
    if (!f) return finish();
    if (!dispatch(f)) return finish();
    if (queue.current.length === 0) {
      stopTimer();
      setTail(true);
      return;
    }
    const wait =
      opts.current.getSpeed() === 'instant'
        ? 0
        : (f.pauseMs ?? DEFAULT_PAUSE[opts.current.getSpeed()]);
    if (wait === 0) next();
    else timer.current = setTimeout(next, wait);
  };
  const start = (frames: readonly PlayFrame[]) => {
    stopTimer();
    queue.current = [...frames];
    active.current = true;
    spoken.current = [];
    setCaptions([]);
    setCanReplay(false);
    setPlaying(true);
    next();
  };

  // a demo step starts playing when the step starts
  useEffect(() => {
    const { step, stepIndex, done } = o;
    if (done || !step?.play || startedFor.current === stepIndex) return;
    startedFor.current = stepIndex;
    snapshot.current = o.coreRef.current;
    start(step.play);
    return undefined;
  }, [o.stepIndex, o.done, epoch]);
  useEffect(() => {
    if (tail && !o.animBusy) {
      setTail(false);
      finish();
    }
  }, [tail, o.animBusy]);
  useEffect(() => () => stopTimer(), []);

  return {
    playing,
    canReplay,
    captions,
    /** scripted rolls are not logged while this is true */
    isActive: () => active.current,
    /** the scene was reset: the next step 0 may play again */
    reset: () => {
      startedFor.current = -1;
      finish();
      setEpoch((n) => n + 1);
    },
    replay: () => {
      const play = opts.current.step?.play;
      if (!play || !snapshot.current) return;
      opts.current.clearAnimation();
      opts.current.setCore(snapshot.current);
      start(play);
    },
    skip: () => {
      if (queue.current.length === 0 && timer.current === null) {
        // every frame is out and the last roll is still animating: skip that animation
        if (tail) {
          opts.current.skipAnimation();
          finish();
        }
        return;
      }
      stopTimer();
      opts.current.skipAnimation();
      while (queue.current.length) if (!dispatch(queue.current.shift()!)) break;
      opts.current.skipAnimation();
      finish();
    },
  };
}
