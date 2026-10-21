import { useEffect } from 'preact/hooks';
import type { Cents, GameState } from '../engine/types';
import type { SceneConfig } from '../scene/types';
import { saveSandbox } from './persist';
import type { ResolvedSimSettings } from './settings';

/** Saves the sandbox table (game, bankroll, preset, chip) whenever it changes; no key = off. */
export function useSandboxPersist(
  persistKey: string | undefined,
  scene: SceneConfig,
  settings: ResolvedSimSettings,
  game: GameState,
  chip: Cents,
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
    });
  }, [game, chip, persistKey, scene.bankroll, scene.rules, settings.rulesPreset]);
}
