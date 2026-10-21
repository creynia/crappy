import { useEffect, useRef, useState } from 'preact/hooks';
import type { Action } from '../engine/types';
import type { PlayFrame, SceneStep } from '../scene/types';
import type { Speed } from './animation';
import type { Core } from './simCore';
import type { ToastItem } from './Toasts';

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
  pushToast: (text: string, tone?: ToastItem['tone']) => void;
  /** stop roll animations (replay and skip) */
  clearAnimation: () => void;
  skipAnimation: () => void;
}

/**
 * Demo steps (`SceneStep.play`): plays the scripted actions one at a time with captions when the
 * step starts, then hands control back. `replay` restores the state the step started from and plays
 * again; `skip` runs the remaining frames at once. At instant speed everything plays in one go.
 */
export function useDemoPlayback(o: DemoPlaybackOptions) {
  const [playing, setPlaying] = useState(false);
  const [epoch, setEpoch] = useState(0);
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
    setPlaying(false);
  };
  const dispatch = (f: PlayFrame) => {
    if (f.say) opts.current.pushToast(f.say, 'info');
    opts.current.doAction(f.action, { scripted: true });
  };
  const next = () => {
    timer.current = null;
    const f = queue.current.shift();
    if (!f) return finish();
    dispatch(f);
    if (queue.current.length === 0) return finish();
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
  useEffect(() => () => stopTimer(), []);

  return {
    playing,
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
      if (queue.current.length === 0 && timer.current === null) return;
      stopTimer();
      opts.current.skipAnimation();
      while (queue.current.length) dispatch(queue.current.shift()!);
      finish();
    },
  };
}
