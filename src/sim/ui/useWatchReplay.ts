import { useEffect, useRef, useState } from 'preact/hooks';
import { equity } from '../engine/game';
import type { Cents, GameEvent, GameState } from '../engine/types';
import { replayRoll, replayStart, replayTo, simulateSession } from '../strategy';
import type { SessionConfig, SessionLogEntry } from '../strategy';
import type { Speed } from './animation';
import type { Core } from './simCore';

export type WatchSpeed = 1 | 4 | 16;

export interface WatchState {
  cfg: SessionConfig;
  log: SessionLogEntry[];
  /** rolls shown so far */
  index: number;
  playing: boolean;
  speed: WatchSpeed;
  /** the run's own final bankroll: the replay must end here */
  finalEquity: Cents;
}

interface Options {
  coreRef: { current: Core };
  setCore: (c: Core) => void;
  startEquity: { current: Cents };
  /** the animation player: busy flag, run a roll's timeline, clear overlays */
  anim: {
    busy: boolean;
    run: (pre: GameState, post: GameState, events: GameEvent[]) => void;
    clear: () => void;
  };
  /** animation speed the replay overrides while it is active (null = the player's own setting) */
  speedRef: { current: Speed | null };
  /** the player's own animation speed, used for 1x */
  baseSpeed: () => Speed;
}

const SPEED: Record<WatchSpeed, (base: Speed) => Speed> = {
  1: (base) => base,
  4: () => 'fast',
  16: () => 'instant',
};
const GAP_MS: Record<WatchSpeed, number> = { 1: 450, 4: 120, 16: 0 };

/**
 * Watch mode: replay a recorded auto-roll run on the table itself. The player's own table is saved on
 * start and put back on exit. Replayed rolls go through the normal animation player, bypassing scene
 * gating, so lessons do not react to them.
 */
export function useWatchReplay(o: Options) {
  const [watch, setWatch] = useState<WatchState | null>(null);
  const saved = useRef<{ core: Core; startEquity: Cents } | null>(null);
  const watchRef = useRef(watch);
  watchRef.current = watch;

  const applySpeed = (w: WatchState | null) => {
    o.speedRef.current = w ? SPEED[w.speed](o.baseSpeed()) : null;
  };
  const update = (patch: Partial<WatchState>) => {
    const w = watchRef.current;
    if (!w) return;
    const next = { ...w, ...patch };
    watchRef.current = next;
    applySpeed(next);
    setWatch(next);
  };

  const start = (cfg: SessionConfig) => {
    const result = simulateSession({ ...cfg, record: true });
    const log = result.log ?? [];
    o.anim.clear();
    if (!saved.current)
      saved.current = { core: o.coreRef.current, startEquity: o.startEquity.current };
    const game = replayStart(cfg);
    o.startEquity.current = equity(game);
    o.setCore({ game, rt: o.coreRef.current.rt });
    const w: WatchState = {
      cfg,
      log,
      index: 0,
      playing: log.length > 0,
      speed: 1,
      finalEquity: result.finalEquity,
    };
    watchRef.current = w;
    applySpeed(w);
    setWatch(w);
  };

  const stepOne = () => {
    const w = watchRef.current;
    if (!w || w.index >= w.log.length) return;
    const { pre, post, events } = replayRoll(o.coreRef.current.game, w.log[w.index]!);
    o.setCore({ game: post, rt: o.coreRef.current.rt });
    o.anim.run(pre, post, events);
    update({ index: w.index + 1, playing: w.playing && w.index + 1 < w.log.length });
  };

  const scrub = (k: number) => {
    const w = watchRef.current;
    if (!w) return;
    const n = Math.max(0, Math.min(k, w.log.length));
    o.anim.clear();
    o.setCore({ game: replayTo(w.cfg, w.log, n), rt: o.coreRef.current.rt });
    update({ index: n, playing: false });
  };

  const exit = () => {
    o.anim.clear();
    const s = saved.current;
    saved.current = null;
    if (s) {
      o.startEquity.current = s.startEquity;
      o.setCore({ game: s.core.game, rt: s.core.rt });
    }
    watchRef.current = null;
    applySpeed(null);
    setWatch(null);
  };

  // advance while playing, one roll per finished animation
  const w = watch;
  useEffect(() => {
    if (!w || !w.playing || o.anim.busy) return;
    if (w.index >= w.log.length) {
      update({ playing: false });
      return;
    }
    const t = setTimeout(stepOne, GAP_MS[w.speed]);
    return () => clearTimeout(t);
  }, [w?.playing, w?.index, w?.speed, o.anim.busy]);

  return {
    watch,
    start,
    exit,
    scrub,
    step: () => {
      if (!o.anim.busy) update({ playing: false });
      if (!o.anim.busy) stepOne();
    },
    toggle: () => {
      const cur = watchRef.current;
      if (!cur) return;
      if (cur.index >= cur.log.length) scrub(0);
      update({ playing: !(watchRef.current?.playing ?? false) });
    },
    setSpeed: (speed: WatchSpeed) => update({ speed }),
  };
}
