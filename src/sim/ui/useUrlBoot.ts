import { useEffect, useState } from 'preact/hooks';
import { equity } from '../engine/game';
import type { Cents, Dice as DicePair, GameState, RulePresetId } from '../engine/types';
import { initScene } from '../scene';
import type { SceneConfig, SceneRuntime } from '../scene/types';
import { loadSandbox, saveSandbox } from './persist';
import { resolveSettings, type ResolvedSimSettings } from './settings';
import type { SimulatorProps } from './types';

export const SANDBOX_SCENE: SceneConfig = {
  id: 'sandbox',
  version: 1,
  bankroll: 50_000,
  allowedBets: 'all',
  ui: { showSettings: true, showBankroll: true, showHistory: true },
};
const PRESETS: RulePresetId[] = ['standard-vegas', 'field-3x-12', 'odds-10x', 'odds-100x'];

export interface Core {
  game: GameState;
  rt: SceneRuntime;
}

export function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0]! & 0x7fffffff;
  } catch {
    return Math.floor(Math.random() * 0x7fffffff);
  }
}

/** Sandbox URL params (supported in production): seed, dice, rules, speed. Read from ?search and #/path?query. */
export function readUrlParams(): URLSearchParams {
  const p = new URLSearchParams();
  try {
    new URLSearchParams(location.search).forEach((v, k) => p.set(k, v));
    const h = location.hash;
    const q = h.indexOf('?');
    if (q >= 0) new URLSearchParams(h.slice(q + 1)).forEach((v, k) => p.set(k, v));
  } catch {
    /* no location */
  }
  return p;
}

export function parseDice(s: string | null): DicePair[] {
  if (!s) return [];
  const out: DicePair[] = [];
  for (const part of s.split(',')) {
    const m = /^([1-6])-([1-6])$/.exec(part.trim());
    if (m) out.push([Number(m[1]), Number(m[2])] as unknown as DicePair);
  }
  return out;
}

function isPreset(s: string): s is RulePresetId {
  return (PRESETS as string[]).includes(s);
}

export function buildCore(
  scene: SceneConfig,
  settings: ResolvedSimSettings,
  mode: 'sandbox' | 'embedded',
  persistKey: string | undefined,
  url: URLSearchParams,
): { core: Core; startEquity: Cents; chip?: Cents } {
  const sandbox = mode === 'sandbox';
  const hasUrl = sandbox && (url.has('seed') || url.has('dice') || url.has('rules'));
  const urlRules = url.get('rules');
  const rules: SceneConfig['rules'] =
    scene.rules ??
    (urlRules && isPreset(urlRules) ? urlRules : sandbox ? settings.rulesPreset : undefined);
  const withRules: SceneConfig = rules !== undefined ? { ...scene, rules } : scene;
  if (sandbox && persistKey && !hasUrl && !scene.steps?.length) {
    const saved = loadSandbox(persistKey);
    if (
      saved &&
      saved.startBankroll === (scene.bankroll ?? 50_000) &&
      saved.presetId === String(typeof rules === 'string' ? rules : 'custom')
    ) {
      return {
        core: {
          game: saved.game,
          rt: { stepIndex: 0, stepStartRoll: 0, counters: {}, done: true },
        },
        startEquity: saved.startBankroll,
        ...(saved.chip ? { chip: saved.chip } : {}),
      };
    }
  }
  const seedParam = url.get('seed');
  const seed = sandbox && seedParam && /^\d+$/.test(seedParam) ? Number(seedParam) : undefined;
  const dice = sandbox ? parseDice(url.get('dice')) : [];
  const sc: SceneConfig = {
    ...withRules,
    ...(dice.length ? { forcedDice: [...(scene.forcedDice ?? []), ...dice] } : {}),
  };
  const init = initScene(sc, { seed: seed ?? (scene.steps?.length ? 1 : randomSeed()) });
  return { core: { game: init.game, rt: init.runtime }, startEquity: equity(init.game) };
}

/** Initial settings (with the sandbox `speed` URL param) and the boot core (URL params or saved sandbox). */
export function useUrlBoot(
  props: SimulatorProps,
  scene: SceneConfig,
  mode: 'sandbox' | 'embedded',
) {
  const sandbox = mode === 'sandbox';
  const [settings, setSettings] = useState<ResolvedSimSettings>(() => {
    const base = resolveSettings(props.initialSettings, scene.ui?.speed);
    const sp = sandbox ? readUrlParams().get('speed') : null;
    return sp === 'normal' || sp === 'fast' || sp === 'instant' ? { ...base, speed: sp } : base;
  });
  const [boot] = useState(() =>
    buildCore(
      scene,
      settings,
      mode,
      props.persistKey,
      sandbox ? readUrlParams() : new URLSearchParams(),
    ),
  );
  return { settings, setSettings, boot };
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
