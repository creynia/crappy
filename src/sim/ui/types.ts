import type {
  ApplyResult,
  Action,
  GameEvent,
  GameState,
  RollRecord,
  RulePresetId,
  Validation,
} from '../engine/types';
import type { ActionPreview } from '../math/types';
import type { SceneConfig } from '../scene/types';
import type { ManyResult, SessionResult } from '../strategy/types';

export interface SimSettings {
  speed: 'normal' | 'fast' | 'instant';
  skipPreview: boolean;
  rulesPreset: RulePresetId;
  sound: boolean;
}

export interface SimulatorProps {
  scene?: SceneConfig; // absent = sandbox
  mode?: 'sandbox' | 'embedded';
  persistKey?: string;
  initialSettings?: Partial<SimSettings>;
  onEvent?: (e: SimulatorEvent) => void;
}

export type SimulatorEvent =
  | { type: 'ready'; state: GameState }
  | { type: 'previewed'; preview: ActionPreview }
  | { type: 'action-confirmed'; action: Action; events: GameEvent[]; state: GameState }
  | { type: 'action-rejected'; action: Action; error: Extract<Validation, { ok: false }> }
  | { type: 'rolled'; roll: RollRecord; events: GameEvent[]; state: GameState }
  | { type: 'step-started'; stepId: string; index: number }
  | { type: 'step-completed'; stepId: string; index: number }
  | { type: 'step-answered'; stepId: string; index: number; choice: number; correct: boolean }
  | { type: 'scene-completed'; sceneId: string; state: GameState }
  | { type: 'auto-roll-completed'; result: SessionResult | ManyResult };

export interface SimulatorHandle {
  unmount(): void;
  getState(): GameState;
  dispatch(action: Action): ApplyResult;
  reset(scene?: SceneConfig): void;
}
