import { isBetTypeId, isDicePair } from '../engine/bets';
import { createGame } from '../engine/game';
import { RULE_PRESETS, resolveRules } from '../engine/rules';
import { listStrategies } from '../strategy/presets';
import { answeredRequirements } from './conditions';
import type { SceneConfig } from './types';

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const POINTS = [4, 5, 6, 8, 9, 10];
const BET_RESULTS = ['won', 'lost', 'pushed'];
const ACTION_TYPES = ['place-bet', 'set-amount', 'remove-bet', 'set-working', 'roll'];
const EVENT_TYPES = [
  'bet-placed',
  'bet-amount-changed',
  'bet-removed',
  'bet-working-changed',
  'dice-rolled',
  'bet-won',
  'bet-lost',
  'bet-pushed',
  'bet-returned',
  'bet-travelled',
  'bet-progressed',
  'natural',
  'craps',
  'point-established',
  'point-made',
  'seven-out',
];
const RULE_KEYS = [
  'presetId',
  'tableMin',
  'tableMax',
  'propMin',
  'maxOdds',
  'maxLayOdds',
  'fieldPays',
  'vig',
  'payoutUnit',
  'placeBetsWorkOnComeOut',
  'hardwaysWorkOnComeOut',
  'comeOddsWorkOnComeOut',
  'allowPutBets',
];

class Ctx {
  errors: string[] = [];
  err(path: string, msg: string) {
    this.errors.push(`${path}: ${msg}`);
  }
  keys(path: string, o: Obj, allowed: string[]) {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) this.err(path, `unknown key "${k}"`);
  }
  cents(path: string, v: unknown, opts: { min?: number } = {}) {
    if (!isInt(v) || v < (opts.min ?? 0))
      this.err(path, `must be an integer number of cents >= ${opts.min ?? 0}`);
  }
  str(path: string, v: unknown) {
    if (typeof v !== 'string' || v === '') this.err(path, 'must be a non-empty string');
  }
  bool(path: string, v: unknown) {
    if (typeof v !== 'boolean') this.err(path, 'must be a boolean');
  }
  bet(path: string, v: unknown) {
    if (!isBetTypeId(v)) this.err(path, `unknown bet type id ${JSON.stringify(v)}`);
  }
  betList(path: string, v: unknown, allowAll = true) {
    if (v === 'all' && allowAll) return;
    if (!Array.isArray(v))
      return this.err(
        path,
        allowAll ? 'must be "all" or an array of bet ids' : 'must be an array of bet ids',
      );
    v.forEach((b, i) => this.bet(`${path}[${i}]`, b));
  }
  point(path: string, v: unknown) {
    if (!POINTS.includes(v as number)) this.err(path, 'must be one of 4, 5, 6, 8, 9, 10');
  }
  dice(path: string, v: unknown) {
    if (!Array.isArray(v)) return this.err(path, 'must be an array of [die, die] pairs');
    v.forEach((d, i) => {
      if (!Array.isArray(d) || d.length !== 2 || !d.every((x) => isInt(x) && x >= 1 && x <= 6))
        this.err(`${path}[${i}]`, 'must be a pair of dice, each an integer 1-6');
    });
  }
  actions(path: string, v: unknown) {
    if (!Array.isArray(v)) return this.err(path, 'must be an array of action types');
    v.forEach((a, i) => {
      if (!ACTION_TYPES.includes(a as string))
        this.err(`${path}[${i}]`, `unknown action type ${JSON.stringify(a)}`);
    });
  }
  phase(path: string, v: unknown) {
    if (v !== 'come-out' && v !== 'point') this.err(path, 'must be "come-out" or "point"');
  }
  betInit(path: string, v: unknown) {
    if (!isObj(v)) return this.err(path, 'must be an object');
    this.keys(path, v, [
      'ref',
      'type',
      'amount',
      'point',
      'parentRef',
      'working',
      'hop',
      'progress',
    ]);
    this.bet(`${path}.type`, v.type);
    this.hop(path, v.type, v.hop, true);
    this.cents(`${path}.amount`, v.amount, { min: 1 });
    if (v.ref !== undefined) this.str(`${path}.ref`, v.ref);
    if (v.parentRef !== undefined) this.str(`${path}.parentRef`, v.parentRef);
    if (v.point !== undefined) this.point(`${path}.point`, v.point);
    if (v.working !== undefined && !['auto', 'on', 'off'].includes(v.working as string))
      this.err(`${path}.working`, 'must be auto, on or off');
    if (v.progress !== undefined) {
      if (!Array.isArray(v.progress) || !v.progress.every((n) => isInt(n) && n >= 2 && n <= 12))
        this.err(`${path}.progress`, 'must be an array of dice totals 2-12');
    }
  }
  /** Hop pair (I035): required on a hop BetInit, optional on a hop matcher, rejected elsewhere. */
  hop(path: string, type: unknown, hop: unknown, required: boolean) {
    const types = Array.isArray(type) ? type : type === undefined ? [] : [type];
    const isHop = types.length > 0 && types.every((t) => t === 'hop');
    if (hop === undefined) {
      if (required && isHop) this.err(`${path}.hop`, 'a hop bet needs a dice pair, e.g. [2, 4]');
      return;
    }
    if (!isDicePair(hop)) this.err(`${path}.hop`, 'must be a pair of dice, each an integer 1-6');
    else if (!isHop) this.err(`${path}.hop`, 'only applies to the "hop" bet type');
  }
  matcher(path: string, v: unknown) {
    if (!isObj(v)) return this.err(path, 'must be an object');
    this.keys(path, v, ['type', 'betType', 'amount', 'minAmount', 'maxAmount', 'oddsMax', 'hop']);
    this.hop(path, v.betType, v.hop, false);
    if (!ACTION_TYPES.includes(v.type as string)) this.err(`${path}.type`, 'unknown action type');
    if (v.betType !== undefined) {
      if (Array.isArray(v.betType))
        v.betType.forEach((b, i) => this.bet(`${path}.betType[${i}]`, b));
      else this.bet(`${path}.betType`, v.betType);
    }
    for (const k of ['amount', 'minAmount', 'maxAmount'])
      if (v[k] !== undefined) this.cents(`${path}.${k}`, v[k], { min: 1 });
    if (v.oddsMax !== undefined) this.bool(`${path}.oddsMax`, v.oddsMax);
    if (v.oddsMax === true && v.betType !== undefined) {
      const bts = Array.isArray(v.betType) ? v.betType : [v.betType];
      if (!bts.every((b) => typeof b === 'string' && b.endsWith('-odds')))
        this.err(path, 'oddsMax only applies to odds bets');
    }
  }
  condition(path: string, v: unknown, autoRoll: boolean) {
    if (!isObj(v)) return this.err(path, 'must be an object');
    const keys = Object.keys(v);
    const main = keys.filter((k) => k !== 'count' && !(k === 'betType' && 'event' in v));
    if (main.length !== 1) return this.err(path, 'must have exactly one condition key');
    const k = main[0]!;
    const val = v[k];
    if (v.count !== undefined && k !== 'action' && k !== 'event')
      this.err(path, 'count only applies to action and event conditions');
    if (v.count !== undefined && !(isInt(v.count) && v.count >= 1))
      this.err(`${path}.count`, 'must be a positive integer');
    switch (k) {
      case 'all':
      case 'any':
        if (!Array.isArray(val) || val.length === 0)
          return this.err(`${path}.${k}`, 'must be a non-empty array');
        val.forEach((c, i) => this.condition(`${path}.${k}[${i}]`, c, autoRoll));
        break;
      case 'action':
        this.matcher(`${path}.action`, val);
        break;
      case 'event':
        if (!EVENT_TYPES.includes(val as string))
          this.err(`${path}.event`, `unknown event type ${JSON.stringify(val)}`);
        if (v.betType !== undefined) this.bet(`${path}.betType`, v.betType);
        break;
      case 'rolls':
        if (!(isInt(val) && val >= 1)) this.err(`${path}.rolls`, 'must be a positive integer');
        break;
      case 'phase':
        this.phase(`${path}.phase`, val);
        break;
      case 'point':
        if (val !== null) this.point(`${path}.point`, val);
        break;
      case 'betOnTable':
        if (!isObj(val)) return this.err(`${path}.betOnTable`, 'must be an object');
        this.keys(`${path}.betOnTable`, val, ['type', 'minAmount', 'point']);
        this.bet(`${path}.betOnTable.type`, val.type);
        if (val.minAmount !== undefined)
          this.cents(`${path}.betOnTable.minAmount`, val.minAmount, { min: 1 });
        if (val.point !== undefined) {
          this.point(`${path}.betOnTable.point`, val.point);
          const t = val.type;
          if (typeof t === 'string' && t !== 'come' && t !== 'dont-come' && !t.endsWith('-odds'))
            this.err(
              `${path}.betOnTable.point`,
              'point only applies to come, dont-come and odds bets',
            );
        }
        break;
      case 'betResolved':
        if (!isObj(val)) return this.err(`${path}.betResolved`, 'must be an object');
        this.keys(`${path}.betResolved`, val, ['type', 'result']);
        this.bet(`${path}.betResolved.type`, val.type);
        if (val.result !== undefined && !BET_RESULTS.includes(val.result as string))
          this.err(`${path}.betResolved.result`, 'must be "won", "lost" or "pushed"');
        break;
      case 'not':
        this.condition(`${path}.not`, val, autoRoll);
        break;
      case 'bankrollAtLeast':
      case 'bankrollAtMost':
        this.cents(`${path}.${k}`, val);
        break;
      case 'equityAtLeast':
      case 'equityAtMost':
        this.cents(`${path}.${k}`, val);
        break;
      case 'previewed':
        this.bet(`${path}.previewed`, val);
        break;
      case 'autoRollCompleted':
        if (!isObj(val)) return this.err(`${path}.autoRollCompleted`, 'must be an object');
        this.keys(`${path}.autoRollCompleted`, val, ['minRolls', 'oddsMultiple']);
        if (
          val.oddsMultiple !== undefined &&
          val.oddsMultiple !== 'default' &&
          !(typeof val.oddsMultiple === 'number' && val.oddsMultiple >= 0)
        )
          this.err(`${path}.autoRollCompleted.oddsMultiple`, 'must be a number >= 0 or "default"');
        if (val.minRolls !== undefined && !(isInt(val.minRolls) && val.minRolls >= 1))
          this.err(`${path}.autoRollCompleted.minRolls`, 'must be a positive integer');
        if (!autoRoll) this.err(path, 'autoRollCompleted needs autoRoll.enabled on the scene');
        break;
      case 'answered':
        if (val !== true && val !== 'correct')
          this.err(`${path}.answered`, 'must be true or "correct"');
        break;
      case 'acknowledged':
        if (val !== true) this.err(`${path}.acknowledged`, 'must be true');
        break;
      default:
        this.err(path, `unknown condition "${k}"`);
    }
  }
  ask(path: string, v: unknown) {
    if (!isObj(v)) return this.err(path, 'must be an object');
    this.keys(path, v, ['q', 'options', 'answer', 'explain', 'mode']);
    this.str(`${path}.q`, v.q);
    this.str(`${path}.explain`, v.explain);
    if (
      !Array.isArray(v.options) ||
      v.options.length < 2 ||
      v.options.some((o) => typeof o !== 'string' || o === '')
    )
      this.err(`${path}.options`, 'must be an array of at least 2 non-empty strings');
    else if (!(isInt(v.answer) && v.answer >= 0 && v.answer < v.options.length))
      this.err(`${path}.answer`, 'must be an integer index into options');
    if (v.mode !== undefined && v.mode !== 'before-roll' && v.mode !== 'any')
      this.err(`${path}.mode`, 'must be before-roll or any');
  }
  strategySpec(path: string, v: unknown) {
    if (!isObj(v)) return this.err(path, 'must be an object');
    this.keys(path, v, ['id', 'unit', 'oddsMultiple', 'layout']);
    const ids = listStrategies().map((s) => s.id as string);
    if (!ids.includes(v.id as string))
      this.err(`${path}.id`, `unknown strategy id ${JSON.stringify(v.id)}`);
    this.cents(`${path}.unit`, v.unit, { min: 1 });
    if (
      v.oddsMultiple !== undefined &&
      !(typeof v.oddsMultiple === 'number' && v.oddsMultiple >= 0)
    )
      this.err(`${path}.oddsMultiple`, 'must be a number >= 0');
    if (v.layout !== undefined) {
      if (!Array.isArray(v.layout)) this.err(`${path}.layout`, 'must be an array');
      else
        v.layout.forEach((b, i) => {
          if (!isObj(b)) return this.err(`${path}.layout[${i}]`, 'must be an object');
          this.bet(`${path}.layout[${i}].type`, b.type);
          this.cents(`${path}.layout[${i}].amount`, b.amount, { min: 1 });
        });
    }
  }
}

function checkInitBets(c: Ctx, path: string, v: SceneLike, bets: unknown) {
  if (!Array.isArray(bets) || c.errors.length) return;
  try {
    createGame({
      rules: v.rules as never,
      bankroll: 1e9,
      phase: v.phase as never,
      point: v.point as never,
      bets: bets as never,
    });
  } catch (e) {
    c.err(path, e instanceof Error ? e.message : String(e));
  }
}
interface SceneLike {
  rules?: unknown;
  phase?: unknown;
  point?: unknown;
}

const SCENE_KEYS = [
  'id',
  'version',
  'title',
  'rules',
  'bankroll',
  'phase',
  'point',
  'bets',
  'seed',
  'forcedDice',
  'onForcedExhausted',
  'allowedBets',
  'allowedActions',
  'highlightedBets',
  'showEV',
  'evDetail',
  'whyOpen',
  'ui',
  'autoRoll',
  'steps',
];
const STEP_KEYS = [
  'id',
  'text',
  'hint',
  'math',
  'setup',
  'forcedDice',
  'allowedBets',
  'allowedActions',
  'highlightedBets',
  'expect',
  'completeWhen',
  'advance',
  'showEV',
  'ask',
];

/** Strict scene validation: canonical ids, integer cents, dice 1-6, shapes, and engine-backed bet checks. */
export function validateScene(
  json: unknown,
): { ok: true; scene: SceneConfig } | { ok: false; errors: string[] } {
  const c = new Ctx();
  if (!isObj(json)) return { ok: false, errors: ['scene: must be an object'] };
  const s = json;
  c.keys('scene', s, SCENE_KEYS);
  c.str('id', s.id);
  if (s.version !== 1) c.err('version', 'must be 1');
  if (s.title !== undefined) c.str('title', s.title);
  if (s.rules !== undefined) {
    if (typeof s.rules === 'string') {
      if (!Object.prototype.hasOwnProperty.call(RULE_PRESETS, s.rules))
        c.err('rules', `unknown rules preset "${s.rules}"`);
    } else if (isObj(s.rules)) c.keys('rules', s.rules, RULE_KEYS);
    else c.err('rules', 'must be a preset id or an object');
  }
  if (s.bankroll !== undefined) c.cents('bankroll', s.bankroll);
  if (s.phase !== undefined) c.phase('phase', s.phase);
  if (s.point !== undefined && s.point !== null) c.point('point', s.point);
  if ((s.phase === 'point') !== (s.point != null) && (s.phase !== undefined || s.point != null))
    c.err('point', 'point must be set if and only if phase is "point"');
  if (s.bets !== undefined) {
    if (!Array.isArray(s.bets)) c.err('bets', 'must be an array');
    else s.bets.forEach((b, i) => c.betInit(`bets[${i}]`, b));
    checkInitBets(c, 'bets', s, s.bets);
  }
  if (s.seed !== undefined && !isInt(s.seed)) c.err('seed', 'must be an integer');
  if (s.forcedDice !== undefined) c.dice('forcedDice', s.forcedDice);
  if (
    s.onForcedExhausted !== undefined &&
    s.onForcedExhausted !== 'random' &&
    s.onForcedExhausted !== 'block'
  )
    c.err('onForcedExhausted', 'must be random or block');
  if (s.allowedBets !== undefined) c.betList('allowedBets', s.allowedBets);
  if (s.allowedActions !== undefined) c.actions('allowedActions', s.allowedActions);
  if (s.highlightedBets !== undefined) c.betList('highlightedBets', s.highlightedBets, false);
  if (s.showEV !== undefined) c.bool('showEV', s.showEV);
  if (s.evDetail !== undefined && s.evDetail !== 'basic' && s.evDetail !== 'full')
    c.err('evDetail', 'must be basic or full');
  if (s.whyOpen !== undefined) c.bool('whyOpen', s.whyOpen);

  if (s.ui !== undefined) {
    if (!isObj(s.ui)) c.err('ui', 'must be an object');
    else {
      const u = s.ui;
      c.keys('ui', u, [
        'orientation',
        'view',
        'chips',
        'defaultChip',
        'showChipRack',
        'showHistory',
        'showBankroll',
        'showRoll',
        'showSettings',
        'speed',
        'compact',
      ]);
      if (
        u.orientation !== undefined &&
        !['auto', 'portrait', 'landscape'].includes(u.orientation as string)
      )
        c.err('ui.orientation', 'must be auto, portrait or landscape');
      if (u.view !== undefined && u.view !== 'table' && u.view !== 'center')
        c.err('ui.view', 'must be table or center');
      if (u.chips !== undefined) {
        if (!Array.isArray(u.chips) || u.chips.length === 0)
          c.err('ui.chips', 'must be a non-empty array of cents');
        else u.chips.forEach((x, i) => c.cents(`ui.chips[${i}]`, x, { min: 1 }));
      }
      if (u.defaultChip !== undefined) c.cents('ui.defaultChip', u.defaultChip, { min: 1 });
      for (const k of [
        'showChipRack',
        'showHistory',
        'showBankroll',
        'showRoll',
        'showSettings',
        'compact',
      ])
        if (u[k] !== undefined) c.bool(`ui.${k}`, u[k]);
      if (u.speed !== undefined && !['normal', 'fast', 'instant'].includes(u.speed as string))
        c.err('ui.speed', 'must be normal, fast or instant');
    }
  }

  let autoOn = false;
  if (s.autoRoll !== undefined) {
    if (!isObj(s.autoRoll)) c.err('autoRoll', 'must be an object');
    else {
      const a = s.autoRoll;
      c.keys('autoRoll', a, [
        'enabled',
        'strategies',
        'defaultStrategy',
        'rollOptions',
        'sessions',
        'compareMode',
        'compare',
        'stopWin',
        'stopLoss',
        'bankroll',
        'sweep',
      ]);
      c.bool('autoRoll.enabled', a.enabled);
      autoOn = a.enabled === true;
      if (a.strategies !== undefined) {
        const ids = listStrategies().map((x) => x.id as string);
        if (!Array.isArray(a.strategies) || a.strategies.length === 0)
          c.err('autoRoll.strategies', 'must be a non-empty array of strategy ids');
        else
          a.strategies.forEach((x, i) => {
            if (!ids.includes(x as string))
              c.err(`autoRoll.strategies[${i}]`, `unknown strategy id ${JSON.stringify(x)}`);
          });
      }
      if (a.defaultStrategy !== undefined)
        c.strategySpec('autoRoll.defaultStrategy', a.defaultStrategy);
      for (const k of ['rollOptions', 'sessions']) {
        const v = a[k];
        if (v === undefined) continue;
        if (!Array.isArray(v) || v.length === 0)
          c.err(`autoRoll.${k}`, 'must be a non-empty array of positive integers');
        else
          v.forEach((x, i) => {
            if (!(isInt(x) && x >= 1 && x <= 10_000))
              c.err(`autoRoll.${k}[${i}]`, 'must be an integer 1-10000');
          });
      }
      if (a.compareMode !== undefined) c.bool('autoRoll.compareMode', a.compareMode);
      // The panel offers these amounts as chips, so a scene can only pick one of them.
      const stopAmounts = [5000, 10_000, 25_000];
      for (const [k, v] of [
        ['stopWin', a.stopWin],
        ['stopLoss', a.stopLoss],
      ] as const) {
        if (v === undefined) continue;
        c.cents(`autoRoll.${k}`, v, { min: 1 });
        if (typeof v === 'number' && !stopAmounts.includes(v))
          c.err(`autoRoll.${k}`, 'must be $50, $100 or $250 (or leave it out)');
      }
      // The panel's custom input uses the scene's own table minimum, capped at $1,000,000.
      let tableMin = 500;
      try {
        tableMin = resolveRules(s.rules as Parameters<typeof resolveRules>[0]).tableMin;
      } catch {
        /* invalid rules are reported elsewhere; keep the default minimum */
      }
      const startBankroll = a.bankroll !== undefined ? a.bankroll : s.bankroll;
      if (a.bankroll !== undefined) {
        if (!isInt(a.bankroll) || a.bankroll < tableMin || a.bankroll > 100_000_000)
          c.err(
            'autoRoll.bankroll',
            `must be integer cents from $${tableMin / 100} (the table minimum) to $1,000,000`,
          );
      }
      if (
        typeof a.stopLoss === 'number' &&
        typeof startBankroll === 'number' &&
        a.stopLoss > startBankroll
      )
        c.err('autoRoll.stopLoss', 'cannot be more than the auto-roll starting bankroll');
      if (a.compare !== undefined) {
        if (!Array.isArray(a.compare) || a.compare.length < 2 || a.compare.length > 3)
          c.err('autoRoll.compare', 'must be an array of 2-3 strategy specs');
        else a.compare.forEach((x, i) => c.strategySpec(`autoRoll.compare[${i}]`, x));
      }
      if (a.sweep !== undefined) {
        const w = a.sweep;
        if (!isObj(w)) c.err('autoRoll.sweep', 'must be an object');
        else {
          c.keys('autoRoll.sweep', w, ['strategy', 'oddsMultiples']);
          const ids = listStrategies().map((x) => x.id as string);
          if (!ids.includes(w.strategy as string))
            c.err('autoRoll.sweep.strategy', `unknown strategy id ${JSON.stringify(w.strategy)}`);
          const m = w.oddsMultiples;
          if (!Array.isArray(m) || m.length < 2 || m.length > 8)
            c.err('autoRoll.sweep.oddsMultiples', 'must be an array of 2-8 multiples');
          else
            m.forEach((x, i) => {
              if (!(x === 'max' || (typeof x === 'number' && x >= 0 && x <= 1000)))
                c.err(`autoRoll.sweep.oddsMultiples[${i}]`, 'must be a number 0-1000 or "max"');
            });
        }
      }
    }
  }

  if (s.steps !== undefined) {
    if (!Array.isArray(s.steps) || s.steps.length === 0)
      c.err('steps', 'must be a non-empty array');
    else {
      const seen = new Set<string>();
      s.steps.forEach((st: unknown, i) => {
        const p = `steps[${i}]`;
        if (!isObj(st)) return c.err(p, 'must be an object');
        c.keys(p, st, STEP_KEYS);
        c.str(`${p}.id`, st.id);
        if (typeof st.id === 'string') {
          if (seen.has(st.id)) c.err(`${p}.id`, `duplicate step id "${st.id}"`);
          seen.add(st.id);
        }
        c.str(`${p}.text`, st.text);
        if (st.hint !== undefined) c.str(`${p}.hint`, st.hint);
        if (st.math !== undefined) c.str(`${p}.math`, st.math);
        if (st.forcedDice !== undefined) c.dice(`${p}.forcedDice`, st.forcedDice);
        if (st.allowedBets !== undefined) c.betList(`${p}.allowedBets`, st.allowedBets);
        if (st.allowedActions !== undefined) c.actions(`${p}.allowedActions`, st.allowedActions);
        if (st.highlightedBets !== undefined)
          c.betList(`${p}.highlightedBets`, st.highlightedBets, false);
        if (st.showEV !== undefined) c.bool(`${p}.showEV`, st.showEV);
        if (st.advance !== undefined && st.advance !== 'auto' && st.advance !== 'button')
          c.err(`${p}.advance`, 'must be auto or button');
        if (st.expect !== undefined) {
          if (!Array.isArray(st.expect) || st.expect.length === 0)
            c.err(`${p}.expect`, 'must be a non-empty array');
          else st.expect.forEach((m, j) => c.matcher(`${p}.expect[${j}]`, m));
        }
        if (st.ask !== undefined) c.ask(`${p}.ask`, st.ask);
        const needsAnswer = answeredRequirements(st.completeWhen).length > 0;
        if (needsAnswer && st.ask === undefined)
          c.err(`${p}.completeWhen`, 'an answered condition needs the step to have an ask');
        // the feedback must be seen before the step moves on: wait for Next or for something else too
        const cw = isObj(st.completeWhen) ? st.completeWhen : {};
        const alsoWaits =
          Array.isArray(cw.all) && cw.all.some((x) => answeredRequirements(x).length === 0);
        if (st.ask !== undefined && st.advance !== 'button' && !alsoWaits)
          c.err(
            `${p}.advance`,
            'a step with an ask needs advance: button, or an all condition with something besides answered',
          );
        if (st.completeWhen === undefined) c.err(`${p}.completeWhen`, 'is required');
        else c.condition(`${p}.completeWhen`, st.completeWhen, autoOn);
        if (st.setup !== undefined) {
          if (!isObj(st.setup)) return c.err(`${p}.setup`, 'must be an object');
          const u = st.setup;
          c.keys(`${p}.setup`, u, ['bets', 'bankroll', 'phase', 'point', 'replaceBets']);
          if (u.bankroll !== undefined) c.cents(`${p}.setup.bankroll`, u.bankroll);
          if (u.phase !== undefined) c.phase(`${p}.setup.phase`, u.phase);
          if (u.point !== undefined && u.point !== null) c.point(`${p}.setup.point`, u.point);
          if (u.replaceBets !== undefined) c.bool(`${p}.setup.replaceBets`, u.replaceBets);
          if (u.bets !== undefined) {
            if (!Array.isArray(u.bets)) c.err(`${p}.setup.bets`, 'must be an array');
            else u.bets.forEach((b, j) => c.betInit(`${p}.setup.bets[${j}]`, b));
            checkInitBets(
              c,
              `${p}.setup.bets`,
              { rules: s.rules, phase: u.phase ?? s.phase, point: u.point ?? s.point },
              u.bets,
            );
          }
        }
      });
    }
  }
  return c.errors.length
    ? { ok: false, errors: c.errors }
    : { ok: true, scene: json as unknown as SceneConfig };
}
