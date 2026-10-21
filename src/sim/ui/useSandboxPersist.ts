import { useEffect } from 'preact/hooks';
import type { Cents, GameState } from '../engine/types';
import type { SceneConfig } from '../scene/types';
import { saveSandbox } from './persist';
import { LOG_PERSIST, type RollLogEntry } from './rollLog';
import type { ResolvedSimSettings } from './settings';

/** Saves the sandbox table (game, bankroll, preset, chip) whenever it changes; no key = off. */
export function useSandboxPersist(
  persistKey: string | undefined,
  scene: SceneConfig,
  settings: ResolvedSimSettings,
  game: GameState,
  chip: Cents,
  log: readonly RollLogEntry[] = [],
  /** rolls the seed has produced so far (see shareLink.rngDraws) */
  rngSkip = 0,
) {
  useEffect(() => {
    if (!persistKey) return;
    const rules = scene.rules ?? settings.rulesPreset;
    saveSandbox(persistKey, {
      v: 1,
      game,
      startBankroll: scene.bankroll ?? 50_000,
      presetId: String(typeof rules === 'string' ? rules : 'custom'),
      chip,
      log: log.slice(-LOG_PERSIST),
      rngSkip,
    });
  }, [game, chip, log, rngSkip, persistKey, scene.bankroll, scene.rules, settings.rulesPreset]);
}
