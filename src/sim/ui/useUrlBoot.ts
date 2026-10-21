import { useState } from 'preact/hooks';
import { equity } from '../engine/game';
import type { Cents, Dice as DicePair, RulePresetId, TableRules } from '../engine/types';
import { initScene } from '../scene';
import type { SceneConfig } from '../scene/types';
import { loadSandbox } from './persist';
import type { RollLogEntry } from './rollLog';
import { resolveSettings, type ResolvedSimSettings } from './settings';
import { randomSeed, type Core } from './simCore';
import { loadAskAfterWin } from './winPrompt';
import type { SimulatorProps } from './types';

const PRESETS: RulePresetId[] = ['standard-vegas', 'field-3x-12', 'odds-10x', 'odds-100x'];

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

/** Custom rules carry no preset id (resolveRules fills in the default). */
function withoutPreset(r: TableRules): Partial<TableRules> {
  const { presetId: _preset, ...rest } = r;
  return rest;
}

export function buildCore(
  scene: SceneConfig,
  settings: ResolvedSimSettings,
  mode: 'sandbox' | 'embedded',
  persistKey: string | undefined,
  url: URLSearchParams,
): {
  core: Core;
  startEquity: Cents;
  chip?: Cents;
  log?: RollLogEntry[];
  customRules?: Partial<TableRules>;
} {
  const sandbox = mode === 'sandbox';
  const hasUrl = sandbox && (url.has('seed') || url.has('dice') || url.has('rules'));
  const urlRules = url.get('rules');
  const rules: SceneConfig['rules'] =
    scene.rules ??
    (urlRules && isPreset(urlRules) ? urlRules : sandbox ? settings.rulesPreset : undefined);
  const withRules: SceneConfig = rules !== undefined ? { ...scene, rules } : scene;
  if (sandbox && persistKey && !hasUrl && !scene.steps?.length) {
    const saved = loadSandbox(persistKey);
    // I033: a sandbox saved with custom rules comes back with them, unless a scene or URL picks rules
    const custom = saved?.presetId === 'custom' && scene.rules === undefined && !url.has('rules');
    if (
      saved &&
      saved.startBankroll === (scene.bankroll ?? 50_000) &&
      (custom || saved.presetId === String(typeof rules === 'string' ? rules : 'custom'))
    ) {
      return {
        core: {
          game: saved.game,
          rt: { stepIndex: 0, stepStartRoll: 0, counters: {}, done: true },
        },
        startEquity: saved.startBankroll,
        ...(saved.chip ? { chip: saved.chip } : {}),
        ...(saved.log ? { log: saved.log } : {}),
        ...(custom ? { customRules: withoutPreset(saved.game.rules) } : {}),
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
    const resolved = resolveSettings(props.initialSettings, scene.ui?.speed);
    // the sandbox asks after place wins unless the player chose "Always same bet"; scenes opt in
    const base = {
      ...resolved,
      winPrompt: sandbox
        ? (props.initialSettings?.winPrompt ?? loadAskAfterWin())
        : scene.ui?.winPrompt === true,
    };
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
