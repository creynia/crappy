/**
 * Shareable sandbox links (I071): the table's rules, seed, bankroll, point and layout as URL
 * params, so opening the link reproduces the layout and the next rolls.
 *
 *   #/play?seed=123&skip=4&rules=odds-10x&bankroll=480&point=8&bets=pass-line:10,pass-odds:30,come@6:5
 *
 * - `bankroll` is the rack plus the money on the table, in dollars; `point` sets the point phase
 * - `bets` is a comma list of `type[@at][:dollars][!on|!off]`: `@at` is the number a come /
 *   don't-come bet (or its odds) sits on, the dice pair of a hop bet (`hop@2-4:1`) or the
 *   collected numbers of a bonus bet (`small@2.3:1`); `!on` / `!off` is the working override
 * - `skip` is how many rolls the seed had already produced, so the next roll is the same one
 * Every part is validated through the engine; bad parts are skipped and reported.
 */
import { BET_TYPES, isBetTypeId } from '../engine/bets';
import { createGame, type BetInit } from '../engine/game';
import { rollDice } from '../engine/rng';
import { RULE_PRESETS } from '../engine/rules';
import { POINT_NUMBERS } from '../engine/types';
import type {
  Bet,
  Cents,
  Dice,
  GameState,
  PointNumber,
  RulePresetId,
  TableRules,
  WorkingMode,
} from '../engine/types';
import type { SceneConfig } from '../scene/types';

export interface ShareState {
  seed: number;
  /** rolls already drawn from the seed */
  skip: number;
  rules: RulePresetId;
  /** rack plus the money on the table, cents */
  bankroll: Cents;
  point: PointNumber | null;
  bets: BetInit[];
}

/** Where a live table's RNG stands: the link's `skip` plus the rolls drawn since it opened. */
export interface RngPosition {
  /** `skip` the table booted with (0 for a fresh table) */
  bootSkip: number;
  /** forced (`?dice=`) rolls the table booted with; they do not draw from the RNG */
  bootForced: number;
}
export const FRESH_RNG: RngPosition = { bootSkip: 0, bootForced: 0 };

/** The largest bankroll a link may set (cents): $10,000,000. */
export const MAX_BANKROLL: Cents = 1_000_000_000;
const MAX_SKIP_DIGITS = 6;

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

/** `pass-line:10,come@8:5,come-odds@8:10,hop@2-4:1,small@2.3:1,place-6:12!off` for the table. */
export function serializeBets(bets: readonly Bet[]): string {
  const parts: string[] = [];
  for (const b of bets) {
    const def = BET_TYPES[b.type];
    let tag: string = b.type;
    if (COMES.has(b.type) || b.type in COME_ODDS) {
      const point = b.type in COME_ODDS ? bets.find((p) => p.id === b.parentId)?.point : b.point;
      if (point) tag += `@${point}`;
    } else if (b.type === 'hop' && b.hop) {
      tag += `@${b.hop[0]}-${b.hop[1]}`;
    } else if (def.category === 'bonus' && b.progress?.length) {
      tag += `@${b.progress.join('.')}`;
    }
    const working = b.working === 'auto' ? '' : `!${b.working}`;
    parts.push(`${tag}:${b.amount / 100}${working}`);
  }
  return parts.join(',');
}

export interface ParsedBets {
  bets: BetInit[];
  /** parts that could not be read, as written */
  skipped: string[];
}

const PART = /^([a-z0-9-]+)(?:@([0-9.-]+))?(?::(\d{1,7}(?:\.\d{1,2})?))?(?:!(on|off))?$/;

/** Tolerant parser: unknown types, bad amounts or numbers are skipped, never thrown. */
export function parseBets(s: string | null | undefined): ParsedBets {
  const out: ParsedBets = { bets: [], skipped: [] };
  if (!s) return out;
  const comeRefs = new Set<string>();
  for (const raw of s.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = PART.exec(part);
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
    if (m[4]) init.working = m[4] as WorkingMode;
    const at = m[2];
    if (type === 'hop') {
      const pair = at !== undefined ? /^([1-6])-([1-6])$/.exec(at) : null;
      if (!pair) {
        out.skipped.push(part);
        continue;
      }
      init.hop = [Number(pair[1]), Number(pair[2])] as unknown as Dice;
    } else if (at !== undefined) {
      if (COMES.has(type) || type in COME_ODDS) {
        const point = /^\d+$/.test(at) ? Number(at) : NaN;
        if (!POINT_NUMBERS.includes(point as PointNumber)) {
          out.skipped.push(part);
          continue;
        }
        if (COMES.has(type)) {
          const ref = `${type}@${point}`;
          if (comeRefs.has(ref)) {
            // one come / don't-come bet per number
            out.skipped.push(part);
            continue;
          }
          comeRefs.add(ref);
          init.point = point as PointNumber;
          init.ref = ref;
        } else {
          init.parentRef = `${COME_ODDS[type]}@${point}`;
        }
      } else if (def.category === 'bonus') {
        const nums = at.split('.').map((x) => (/^\d+$/.test(x) ? Number(x) : NaN));
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

/** Rolls the RNG has produced for this table: the link's skip plus the unforced rolls since. */
export function rngDraws(game: GameState, pos: RngPosition = FRESH_RNG): number {
  return pos.bootSkip + Math.max(0, game.rollCount - pos.bootForced);
}

/** The share state of a live sandbox game. */
export function shareStateOf(game: GameState, pos: RngPosition = FRESH_RNG): ShareState {
  return {
    seed: game.seed,
    skip: rngDraws(game, pos),
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

/** `https://host/path#/play?...` for the live game (base = origin + pathname). */
export function buildShareUrl(base: string, game: GameState, pos: RngPosition = FRESH_RNG): string {
  // keep the bets list readable: ':' ',' '@' '!' and '.' are safe inside a fragment query
  const q = toParams(shareStateOf(game, pos), game.bets)
    .toString()
    .replace(/%3A/gi, ':')
    .replace(/%2C/gi, ',')
    .replace(/%40/gi, '@')
    .replace(/%21/gi, '!');
  return `${base}#/play?${q}`;
}

export interface ShareBoot {
  game: GameState;
  /** bets or params that were skipped, as short messages for toasts */
  skipped: string[];
  /** the RNG position the table starts from */
  rng: RngPosition;
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
  defaults: { rules: RulePresetId; bankroll: Cents; seed: number; forced?: number },
): ShareBoot | null {
  if (!url.has('bets') && !url.has('bankroll') && !url.has('point') && !url.has('skip'))
    return null;
  const skipped: string[] = [];
  const seedParam = url.get('seed');
  const seed = seedParam && /^\d+$/.test(seedParam) ? Number(seedParam) : defaults.seed;
  const rulesParam = url.get('rules');
  const rules = isPresetId(rulesParam) ? rulesParam : defaults.rules;
  const bankParam = url.get('bankroll');
  let bankroll = defaults.bankroll;
  if (bankParam !== null) {
    const cents = /^\d{1,8}(\.\d{1,2})?$/.test(bankParam)
      ? Math.round(Number(bankParam) * 100)
      : NaN;
    if (Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_BANKROLL) bankroll = cents;
    else skipped.push(`bankroll "${bankParam}"`);
  }
  const pointParam = url.get('point');
  let point: PointNumber | null = null;
  if (pointParam !== null) {
    const n = /^\d+$/.test(pointParam) ? Number(pointParam) : NaN;
    if (POINT_NUMBERS.includes(n as PointNumber)) point = n as PointNumber;
    else skipped.push(`point "${pointParam}"`);
  }
  const skipParam = url.get('skip');
  let skip = 0;
  if (skipParam !== null) {
    if (new RegExp(`^\\d{1,${MAX_SKIP_DIGITS}}$`).test(skipParam)) skip = Number(skipParam);
    else skipped.push(`skip "${skipParam}"`);
  }
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
  return { game, skipped, rng: { bootSkip: skip, bootForced: defaults.forced ?? 0 } };
}

/** One short line for a toast / announcer: the first few skipped parts, then "+N more". */
export function describeSkipped(skipped: readonly string[], max = 5, width = 40): string {
  const shown = skipped
    .slice(0, max)
    .map((s) => (s.length > width ? s.slice(0, width - 1) + '…' : s));
  const more = skipped.length - shown.length;
  return `Skipped from the link: ${shown.join('; ')}${more > 0 ? ` (+${more} more)` : ''}.`;
}

// ---------------------------------------------------------------------------
// scene YAML
// ---------------------------------------------------------------------------

/** The live table as a lesson scene block (the YAML shape `validateScene` accepts). */
export function toSceneConfig(
  game: GameState,
  id = 'shared-table',
  pos: RngPosition = FRESH_RNG,
): SceneConfig {
  const s = shareStateOf(game, pos);
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
export function toSceneYaml(
  game: GameState,
  id = 'shared-table',
  pos: RngPosition = FRESH_RNG,
): string {
  const sc = toSceneConfig(game, id, pos);
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
      if (b.hop) fields.push(`hop: [${b.hop[0]}, ${b.hop[1]}]`);
      if (b.working) fields.push(`working: ${b.working}`);
      if (b.progress?.length) fields.push(`progress: [${b.progress.join(', ')}]`);
      lines.push(`  - { ${fields.join(', ')} }`);
    }
  }
  lines.push('allowedBets: all', 'showEV: true');
  return lines.join('\n') + '\n';
}
