import type { Cents, GameState } from '../engine/types';
import { observe } from '../scene';
import type { SceneConfig, SceneInput, SceneRuntime } from '../scene/types';
import type { SimulatorEvent } from './types';

/** The live game plus the scene runtime that observes it. */
export interface Core {
  game: GameState;
  rt: SceneRuntime;
}

export const SANDBOX_SCENE: SceneConfig = {
  id: 'sandbox',
  version: 1,
  bankroll: 50_000,
  allowedBets: 'all',
  ui: { showSettings: true, showBankroll: true, showHistory: true },
};

export function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]! & 0x7fffffff;
  } catch {
    return Math.floor(Math.random() * 0x7fffffff);
  }
}

/** The starting chip: the saved one, else the scene default, else $5, else the smallest. */
export function initialChip(chips: Cents[], defaultChip?: Cents, saved?: Cents): Cents {
  return saved && chips.includes(saved)
    ? saved
    : defaultChip && chips.includes(defaultChip)
      ? defaultChip
      : chips.includes(500)
        ? 500
        : chips[0]!;
}

/** Feeds a scene input to the runner and emits `step-completed` / `scene-completed` for the result. */
export function emitObserve(
  sc: SceneConfig,
  rt: SceneRuntime,
  g: GameState,
  input: SceneInput,
  emit: (e: SimulatorEvent) => void,
): ReturnType<typeof observe> {
  const r = observe(sc, rt, g, input);
  if (r.completedStep) {
    const idx = sc.steps!.findIndex((s) => s.id === r.completedStep);
    emit({ type: 'step-completed', stepId: r.completedStep, index: idx });
  }
  if (r.sceneCompleted) emit({ type: 'scene-completed', sceneId: sc.id, state: r.game });
  return r;
}
