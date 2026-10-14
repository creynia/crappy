import type { RulePresetId } from '../engine/types';
import { RULE_PRESETS } from '../engine/rules';
import { effectiveSpeed, prefersReducedMotion, type Speed } from './animation';
import type { SimSettings } from './types';

/** Everything the simulator reads from `initialSettings` (the app passes these from its Settings screen). */
export interface SimSettingsInput extends Partial<SimSettings> {
  /** alias of `speed` used by the app's settings screen */
  animationSpeed?: Speed;
  /** default 100; used for the "per hour" EV lines */
  rollsPerHour?: number;
  /** default true: avoid-tier (sucker) bets need a second "Place anyway" tap */
  confirmSuckerBets?: boolean;
}

export interface ResolvedSimSettings {
  speed: Speed;
  skipPreview: boolean;
  rulesPreset: RulePresetId;
  sound: boolean;
  rollsPerHour: number;
  confirmSuckerBets: boolean;
}

export function resolveSettings(
  input?: SimSettingsInput,
  sceneSpeed?: Speed,
  reduced: boolean = prefersReducedMotion(),
): ResolvedSimSettings {
  const i = input ?? {};
  const rph = i.rollsPerHour;
  const preset = i.rulesPreset;
  const requested = i.animationSpeed ?? i.speed ?? sceneSpeed;
  return {
    // reduced motion forces instant unless the viewer explicitly picked a speed
    speed:
      reduced && !i.animationSpeed && !i.speed ? 'instant' : effectiveSpeed(requested, reduced),
    skipPreview: i.skipPreview ?? false,
    rulesPreset:
      preset && Object.prototype.hasOwnProperty.call(RULE_PRESETS, preset)
        ? preset
        : 'standard-vegas',
    sound: false,
    rollsPerHour: typeof rph === 'number' && rph > 0 ? Math.round(rph) : 100,
    confirmSuckerBets: i.confirmSuckerBets ?? true,
  };
}
