/**
 * Shareable sandbox links (I071): the table's rules, seed, bankroll, point and layout as URL
 * params, so opening the link reproduces the layout and the next rolls.
 *
 *   #/play?seed=123&skip=4&rules=odds-10x&bankroll=480&point=8&bets=pass-line:10,pass-odds:30,come@6:5
 *
 * - `bankroll` is the rack in dollars; `point` sets the point phase (absent = come-out)
 * - `bets` is a comma list of `type[@point][:dollars]`: `@point` is the number a come / don't-come
 *   bet (or its odds) sits on, or the collected numbers of a bonus bet (`small@2.3.4`)
 * - `skip` is how many rolls the seed had already produced, so the next roll is the same one
 * Every part is validated through the engine; bad parts are skipped and reported.
 */
import { BET_TYPES, isBetTypeId } from '../engine/bets';
import { createGame, type BetInit } from '../engine/game';
import { rollDice } from '../engine/rng';
import { RULE_PRESETS } from '../engine/rules';
import { POINT_NUMBERS } from '../engine/types';
import type { Bet, Cents, GameState, PointNumber, RulePresetId, TableRules } from '../engine/types';
import type { SceneConfig } from '../scene/types';

export interface ShareState {
  seed: number;
  /** rolls already drawn from the seed */
  skip: number;
  rules: RulePresetId;
  /** rack, cents */
  bankroll: Cents;
  point: PointNumber | null;
  bets: BetInit[];
}

const COMES = new Set(['come', 'dont-come']);
const COME_ODDS: Record<string, string> = { 'come-odds': 'come', 'dont-come-odds': 'dont-come' };

export function isPresetId(s: string | null | undefined): s is RulePresetId {
  return typeof s === 'string' && Object.prototype.hasOwnProperty.call(RULE_PRESETS, s);
}

/** The preset a rules object came from, if it matches one exactly. */
export function presetOf(rules: TableRules): RulePresetId | null {
  return isPresetId(rules.presetId) ? rules.presetId : null;
}

// ---------------------------------------------------------------------------
// bets param
// ---------------------------------------------------------------------------

/** `pass-line:10,come@8:5,come-odds@8:10,small@2.3:1` for the bets on the table. */
export function serializeBets(bets: readonly Bet[]): string {
  const parts: string[] = [];
  for (const b of bets) {
    const def = BET_TYPES[b.type];
    let tag = b.type;
    if (COMES.has(b.type) || b.type in COME_ODDS) {
      const point = b.type in COME_ODDS ? bets.find((p) => p.id === b.parentId)?.point : b.point;
      if (point) tag += `@${point}`;
    } else if (def.category === 'bonus' && b.progress?.length) {
      tag += `@${b.progress.join('.')}`;
    }
    parts.push(`${tag}:${b.amount / 100}`);
  }
  return parts.join(',');
}

export interface ParsedBets {
  bets: BetInit[];
  /** parts that could not be read, as written */
  skipped: string[];
}

/** Tolerant parser: unknown types, bad amounts or numbers are skipped, never thrown. */
export function parseBets(s: string | null | undefined): ParsedBets {
  const out: ParsedBets = { bets: [], skipped: [] };
  if (!s) return out;
  for (const raw of s.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^([a-z0-9-]+)(?:@([0-9.]+))?(?::(\d+(?:\.\d{1,2})?))?$/.exec(part);
    if (!m || !isBetTypeId(m[1])) {
      out.skipped.push(part);
      continue;
    }
    const type = m[1];
    const def = BET_TYPES[type];
    const amount = m[3] !== undefined ? Math.round(Number(m[3]) * 100) : 0;
    if (!(amount > 0)) {
      out.skipped.push(part);
      continue;
    }
    const init: BetInit = { type, amount };
    const at = m[2];
    if (at !== undefined) {
      if (COMES.has(type) || type in COME_ODDS) {
        const point = Number(at);
        if (!POINT_NUMBERS.includes(point as PointNumber)) {
          out.skipped.push(part);
          continue;
        }
        if (COMES.has(type)) {
          init.point = point as PointNumber;
          init.ref = `${type}@${point}`;
        } else {
          init.parentRef = `${COME_ODDS[type]}@${point}`;
        }
      } else if (def.category === 'bonus') {
        const nums = at.split('.').map(Number);
        if (nums.some((n) => !Number.isInteger(n) || n < 2 || n > 12)) {
          out.skipped.push(part);
          continue;
        }
        init.progress = nums;
      } else {
        out.skipped.push(part);
        continue;
      }
    } else if (COMES.has(type)) {
      init.ref = `${type}@`;
    }
    // pass-odds / dont-pass-odds attach to the flat bet automatically
    out.bets.push(init);
  }
  return out;
}

// ---------------------------------------------------------------------------
// state <-> params
// ---------------------------------------------------------------------------

/** The share state of a live sandbox game. */
export function shareStateOf(game: GameState): ShareState {
  return {
    seed: game.seed,
    // forced (?dice=) rolls do not draw from the RNG, so they are not skipped
    skip: game.rollCount - game.history.filter((r) => r.forced).length,
    rules: presetOf(game.rules) ?? 'standard-vegas',
    // the bets are placed again on load, so share the rack plus what is on the table
    bankroll: game.bankroll + game.bets.reduce((t, b) => t + b.amount + b.vigPaid, 0),
    point: game.point,
    bets: parseBets(serializeBets(game.bets)).bets,
  };
}

export function toParams(s: ShareState, bets: readonly Bet[] = []): URLSearchParams {
  const p = new URLSearchParams();
  p.set('seed', String(s.seed));
  if (s.skip > 0) p.set('skip', String(s.skip));
  p.set('rules', s.rules);
  p.set('bankroll', String(s.bankroll / 100));
  if (s.point !== null) p.set('point', String(s.point));
  const list = bets.length ? serializeBets(bets) : '';
  if (list) p.set('bets', list);
  return p;
}

/** `https://host/path#/play?...` for the live game (base = location without hash). */
export function buildShareUrl(base: string, game: GameState): string {
  // keep the bets list readable: ':' ',' '@' and '.' are safe inside a fragment query
  const q = toParams(shareStateOf(game), game.bets)
    .toString()
    .replace(/%3A/gi, ':')
    .replace(/%2C/gi, ',')
    .replace(/%40/gi, '@');
  return `${base}#/play?${q}`;
}

export interface ShareBoot {
  game: GameState;
  /** bets or params that were skipped, as short messages for toasts */
  skipped: string[];
}

/** Draws `n` rolls from the seeded RNG so the next roll matches the shared table. */
function advanceRng(game: GameState, n: number): GameState {
  let rng = game.rng;
  for (let i = 0; i < n; i++) rng = rollDice(rng)[1];
  return { ...game, rng };
}

/**
 * Builds the shared game from URL params. Bets are validated by the engine one at a time; a bet
 * that the table refuses (wrong phase, odds without a flat bet, over the bankroll) is skipped.
 */
export function bootFromParams(
  url: URLSearchParams,
  defaults: { rules: RulePresetId; bankroll: Cents; seed: number },
): ShareBoot | null {
  if (!url.has('bets') && !url.has('bankroll') && !url.has('point') && !url.has('skip'))
    return null;
  const skipped: string[] = [];
  const seedParam = url.get('seed');
  const seed = seedParam && /^\d+$/.test(seedParam) ? Number(seedParam) : defaults.seed;
  const rulesParam = url.get('rules');
  const rules = isPresetId(rulesParam) ? rulesParam : defaults.rules;
  const bankParam = url.get('bankroll');
  const bankroll =
    bankParam && /^\d+(\.\d{1,2})?$/.test(bankParam) && Number(bankParam) > 0
      ? Math.round(Number(bankParam) * 100)
      : defaults.bankroll;
  if (bankParam && bankroll === defaults.bankroll && Number(bankParam) * 100 !== bankroll)
    skipped.push(`bankroll "${bankParam}"`);
  const pointParam = url.get('point');
  let point: PointNumber | null = null;
  if (pointParam) {
    const n = Number(pointParam);
    if (POINT_NUMBERS.includes(n as PointNumber)) point = n as PointNumber;
    else skipped.push(`point "${pointParam}"`);
  }
  const skipParam = url.get('skip');
  const skip = skipParam && /^\d{1,6}$/.test(skipParam) ? Number(skipParam) : 0;
  const parsed = parseBets(url.get('bets'));
  for (const s of parsed.skipped) skipped.push(`bet "${s}"`);

  const base = {
    rules,
    bankroll,
    seed,
    ...(point !== null ? { phase: 'point' as const, point } : {}),
  };
  const kept: BetInit[] = [];
  for (const b of parsed.bets) {
    try {
      createGame({ ...base, bets: [...kept, b] });
      kept.push(b);
    } catch (e) {
      const why = e instanceof Error ? e.message.replace(/^createGame: /, '') : 'invalid';
      skipped.push(`bet ${b.type}${b.point ? '@' + b.point : ''}: ${why}`);
    }
  }
  const game = advanceRng(createGame({ ...base, bets: kept }), skip);
  return { game, skipped };
}

// ---------------------------------------------------------------------------
// scene YAML
// ---------------------------------------------------------------------------

/** The live table as a lesson scene block (the YAML shape `validateScene` accepts). */
export function toSceneConfig(game: GameState, id = 'shared-table'): SceneConfig {
  const s = shareStateOf(game);
  return {
    id,
    version: 1,
    title: 'Shared table',
    rules: s.rules,
    bankroll: s.bankroll,
    seed: s.seed,
    ...(s.point !== null ? { phase: 'point' as const, point: s.point } : {}),
    ...(s.bets.length ? { bets: s.bets } : {}),
    allowedBets: 'all',
    showEV: true,
  };
}

const yamlScalar = (v: unknown): string =>
  typeof v === 'string' ? (/^[A-Za-z0-9 _-]+$/.test(v) ? v : JSON.stringify(v)) : String(v);

/** Hand-rolled YAML for the flat scene shape above (no runtime YAML dependency). */
export function toSceneYaml(game: GameState, id = 'shared-table'): string {
  const sc = toSceneConfig(game, id);
  const lines: string[] = [];
  lines.push(`id: ${yamlScalar(sc.id)}`, 'version: 1', `title: ${yamlScalar(sc.title)}`);
  lines.push(`rules: ${yamlScalar(sc.rules)}`, `bankroll: ${sc.bankroll}`, `seed: ${sc.seed}`);
  if (sc.phase) lines.push(`phase: ${sc.phase}`, `point: ${sc.point}`);
  if (sc.bets?.length) {
    lines.push('bets:');
    for (const b of sc.bets) {
      const fields: string[] = [];
      if (b.ref) fields.push(`ref: ${yamlScalar(b.ref)}`);
      fields.push(`type: ${b.type}`, `amount: ${b.amount}`);
      if (b.point !== undefined) fields.push(`point: ${b.point}`);
      if (b.parentRef) fields.push(`parentRef: ${yamlScalar(b.parentRef)}`);
      if (b.progress?.length) fields.push(`progress: [${b.progress.join(', ')}]`);
      lines.push(`  - { ${fields.join(', ')} }`);
    }
  }
  lines.push('allowedBets: all', 'showEV: true');
  return lines.join('\n') + '\n';
}
