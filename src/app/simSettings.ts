import type { SimSettings } from '../sim';
import type { Settings } from './storage';
import { effectiveSpeed } from './theme';

/**
 * Settings handed to the Simulator as `initialSettings`. `rollsPerHour` and `confirmSuckerBets`
 * are the app-level options added by decisions.md (design review round 1); the simulator reads
 * them from the same bag.
 */
export type AppSimSettings = Partial<SimSettings> & {
  rollsPerHour: number;
  confirmSuckerBets: boolean;
};

export function simSettings(s: Settings): AppSimSettings {
  return {
    speed: effectiveSpeed(s),
    rollsPerHour: s.rollsPerHour,
    confirmSuckerBets: s.confirmSuckerBets,
  };
}
