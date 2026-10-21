import { useState } from 'preact/hooks';
import { equity } from '../engine/game';
import type { Cents, Dice as DicePair, RulePresetId, TableRules } from '../engine/types';
import { initScene } from '../scene';
import type { SceneConfig } from '../scene/types';
import { loadSandbox } from './persist';
import type { RollLogEntry } from './rollLog';
import { resolveSettings, type ResolvedSimSettings } from './settings';
import { bootFromParams, type RngPosition } from './shareLink';
import { randomSeed, type Core } from './simCore';
import type { SimulatorProps } from './types';

const PRESETS: RulePresetId[] = ['standard-vegas', 'field-3x-12', 'odds-10x', 'odds-100x'];

/**
 * Sandbox URL params (supported in production): seed, dice, rules, speed, and the share-link set
 * bankroll, point, bets, skip (see shareLink.ts). Read from ?search and #/path?query.
 */
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
  /** parts of a shared link the table could not use */
  skipped?: string[];
  /** RNG position of a shared link (so re-sharing keeps the place in the dice sequence) */
  rng?: RngPosition;
} {
  const sandbox = mode === 'sandbox';
  const hasUrl =
    sandbox &&
    ['seed', 'dice', 'rules', 'bankroll', 'point', 'bets', 'skip'].some((k) => url.has(k));
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
        // forced rolls never drew from the RNG (the history keeps the last 200, plenty for a sandbox)
        // the saved draw count (or, for older saves, the unforced rolls in the history); every roll
        // already in the saved game is accounted for, so later rolls add to it from here
        rng: {
          bootSkip:
            saved.rngSkip ??
            saved.game.rollCount - saved.game.history.filter((r) => r.forced).length,
          bootForced: saved.game.rollCount,
        },
      };
    }
  }
  const seedParam = url.get('seed');
  const seed = sandbox && seedParam && /^\d+$/.test(seedParam) ? Number(seedParam) : undefined;
  const dice = sandbox ? parseDice(url.get('dice')) : [];
  // A shared table: rules, rack, point and layout from the link; forced dice still apply first.
  const shared =
    sandbox && !scene.steps?.length
      ? bootFromParams(url, {
          rules: typeof rules === 'string' ? rules : settings.rulesPreset,
          bankroll: scene.bankroll ?? 50_000,
          seed: seed ?? randomSeed(),
          forced: dice.length,
        })
      : null;
  if (shared) {
    const game = dice.length ? { ...shared.game, forcedDice: dice } : shared.game;
    return {
      core: { game, rt: { stepIndex: 0, stepStartRoll: 0, counters: {}, done: true } },
      startEquity: equity(game),
      skipped: shared.skipped,
      rng: shared.rng,
    };
  }
  const sc: SceneConfig = {
    ...withRules,
    ...(dice.length ? { forcedDice: [...(scene.forcedDice ?? []), ...dice] } : {}),
  };
  const init = initScene(sc, { seed: seed ?? (scene.steps?.length ? 1 : randomSeed()) });
  return {
    core: { game: init.game, rt: init.runtime },
    startEquity: equity(init.game),
    // ?dice= rolls are forced: they do not advance the seed's sequence
    rng: { bootSkip: 0, bootForced: dice.length },
  };
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
