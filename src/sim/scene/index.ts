import { isBetTypeId } from '../engine/bets';
import type { Action, GameState, Validation } from '../engine/types';
import type { SceneConfig, SceneInput, SceneRuntime } from './types';

export * from './types';

export function initScene(_scene: SceneConfig): { game: GameState; runtime: SceneRuntime } {
  throw new Error('TODO(scene)');
}
export function gateAction(
  _scene: SceneConfig,
  _rt: SceneRuntime,
  _game: GameState,
  _action: Action,
): Validation {
  throw new Error('TODO(scene)');
}
export function observe(
  _scene: SceneConfig,
  _rt: SceneRuntime,
  _game: GameState,
  _input: SceneInput,
): { runtime: SceneRuntime; game: GameState; completedStep?: string; sceneCompleted?: boolean } {
  throw new Error('TODO(scene)');
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * MINIMAL structural check (WP0 placeholder so content tests can be written).
 * The scene agent replaces this with the full validator (engine-backed bet validation,
 * dice 1-6, condition shapes, ...). Keep the signature.
 */
export function validateScene(
  json: unknown,
): { ok: true; scene: SceneConfig } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isObj(json)) return { ok: false, errors: ['scene must be an object'] };
  if (typeof json.id !== 'string' || json.id === '') errors.push('id must be a non-empty string');
  if (json.version !== 1) errors.push('version must be 1');
  if (
    json.bankroll !== undefined &&
    !(Number.isInteger(json.bankroll) && Number(json.bankroll) >= 0)
  )
    errors.push('bankroll must be a non-negative integer (cents)');
  for (const key of ['allowedBets', 'highlightedBets'] as const) {
    const v = json[key];
    if (v === undefined || v === 'all') continue;
    if (!Array.isArray(v) || !v.every(isBetTypeId)) errors.push(`${key} contains unknown bet ids`);
  }
  if (json.bets !== undefined) {
    if (!Array.isArray(json.bets)) errors.push('bets must be an array');
    else
      json.bets.forEach((b: unknown, i) => {
        if (!isObj(b) || !isBetTypeId(b.type)) errors.push(`bets[${i}].type is not a known bet id`);
      });
  }
  if (json.steps !== undefined) {
    if (!Array.isArray(json.steps)) errors.push('steps must be an array');
    else {
      const seen = new Set<string>();
      json.steps.forEach((s: unknown, i) => {
        if (
          !isObj(s) ||
          typeof s.id !== 'string' ||
          typeof s.text !== 'string' ||
          !isObj(s.completeWhen)
        )
          errors.push(`steps[${i}] needs id, text and completeWhen`);
        else if (seen.has(s.id)) errors.push(`duplicate step id ${s.id}`);
        else seen.add(s.id);
      });
    }
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, scene: json as unknown as SceneConfig };
}
