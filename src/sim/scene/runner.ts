import { BET_TYPES } from '../engine/bets';
import { createGame, equity } from '../engine/game';
import { findMergeTarget, findParent, maxOddsAmount } from '../engine/validate';
import type {
  Action,
  ActionType,
  Bet,
  BetTypeId,
  Cents,
  GameEvent,
  GameState,
  Validation,
} from '../engine/types';
import type { BetInit } from '../engine/game';
import type {
  ActionMatcher,
  BetResult,
  Condition,
  SceneConfig,
  SceneInput,
  SceneRuntime,
  SceneStep,
} from './types';

export const ALL_ACTIONS: readonly ActionType[] = [
  'place-bet',
  'set-amount',
  'remove-bet',
  'set-working',
  'roll',
];

export function currentStep(scene: SceneConfig, rt: SceneRuntime): SceneStep | undefined {
  return rt.done ? undefined : scene.steps?.[rt.stepIndex];
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Adds BetInit bets to a live state (used by step `setup`). Throws on invalid bets. */
function addInitBets(state: GameState, inits: BetInit[]): GameState {
  if (!inits.length) return state;
  const tmp = createGame({
    rules: state.rules,
    bankroll: 1e12,
    phase: state.phase,
    point: state.point,
    bets: inits,
  });
  const idMap = new Map<string, string>();
  let next = state.nextBetId;
  for (const b of tmp.bets) idMap.set(b.id, `b${next++}`);
  const bets: Bet[] = tmp.bets.map((b) => ({
    ...b,
    id: idMap.get(b.id)!,
    parentId: b.parentId ? (idMap.get(b.parentId) ?? null) : null,
    placedOnRoll: state.rollCount,
  }));
  const cost = bets.reduce((t, b) => t + b.amount + b.vigPaid, 0);
  return {
    ...state,
    bankroll: state.bankroll - cost,
    bets: [...state.bets, ...bets],
    nextBetId: next,
  };
}

function applySetup(state: GameState, setup: NonNullable<SceneStep['setup']>): GameState {
  let s = state;
  if (setup.replaceBets) {
    const refund = s.bets.reduce((t, b) => t + b.amount + b.vigPaid, 0);
    s = { ...s, bets: [], bankroll: s.bankroll + refund };
  }
  if (setup.phase !== undefined || setup.point !== undefined) {
    const point = setup.point ?? (setup.phase === 'come-out' ? null : s.point);
    const phase = setup.phase ?? (point !== null ? 'point' : s.phase);
    s = { ...s, phase, point: phase === 'point' ? (point ?? s.point ?? 6) : null };
  }
  if (setup.bankroll !== undefined) s = { ...s, bankroll: setup.bankroll };
  if (setup.bets) s = addInitBets(s, setup.bets);
  return s;
}

function startStep(
  scene: SceneConfig,
  game: GameState,
  index: number,
): {
  game: GameState;
  runtime: SceneRuntime;
} {
  let g = game;
  const step = scene.steps?.[index];
  if (step?.setup) g = applySetup(g, step.setup);
  if (step?.forcedDice) g = { ...g, forcedDice: step.forcedDice.map((d) => [d[0], d[1]] as const) };
  return {
    game: g,
    runtime: { stepIndex: index, stepStartRoll: g.rollCount, counters: {}, done: false },
  };
}

/** Initial state for a scene. `seed` is used when the scene has none (guided scenes default to 1). */
export function initScene(
  scene: SceneConfig,
  opts: { seed?: number } = {},
): { game: GameState; runtime: SceneRuntime } {
  const game = createGame({
    ...(scene.rules !== undefined ? { rules: scene.rules } : {}),
    bankroll: scene.bankroll ?? 50_000,
    seed: scene.seed ?? opts.seed ?? (scene.steps?.length ? 1 : 1),
    ...(scene.phase !== undefined ? { phase: scene.phase } : {}),
    ...(scene.point !== undefined ? { point: scene.point } : {}),
    ...(scene.bets ? { bets: scene.bets } : {}),
    ...(scene.forcedDice ? { forcedDice: [...scene.forcedDice] } : {}),
  });
  if (!scene.steps?.length) {
    return { game, runtime: { stepIndex: 0, stepStartRoll: 0, counters: {}, done: true } };
  }
  const started = startStep(scene, game, 0);
  return chain(scene, started.runtime, started.game, {});
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

function totalAfter(
  game: GameState,
  action: Extract<Action, { type: 'place-bet' }>,
  post: boolean,
) {
  const def = BET_TYPES[action.betType];
  const parent =
    def.category === 'odds' ? findParent(game, action.betType, action.parentId) : undefined;
  const target = findMergeTarget(game, action.betType, parent);
  if (post) return target?.amount ?? action.amount;
  return (target?.amount ?? 0) + action.amount;
}

function matches(m: ActionMatcher, action: Action, game: GameState, post: boolean): boolean {
  if (m.type !== action.type) return false;
  if (action.type === 'roll') return true;
  let betType: BetTypeId | undefined;
  let amount: Cents | undefined;
  if (action.type === 'place-bet') {
    betType = action.betType;
    amount = action.amount;
  } else if ('betId' in action) {
    const b = game.bets.find((x) => x.id === action.betId);
    betType = b?.type;
    if (action.type === 'set-amount') amount = action.amount;
  }
  if (m.betType !== undefined) {
    const list = Array.isArray(m.betType) ? m.betType : [m.betType];
    if (!betType || !list.includes(betType)) return false;
  }
  const amountOk = (a: Cents) =>
    (m.amount === undefined || a === m.amount) &&
    (m.minAmount === undefined || a >= m.minAmount) &&
    (m.maxAmount === undefined || a <= m.maxAmount);
  if (amount !== undefined && action.type === 'place-bet') {
    // accept either this action's amount or the resulting total (bets merge)
    if (!amountOk(amount) && !amountOk(totalAfter(game, action, post))) return false;
  } else if (amount !== undefined && !amountOk(amount)) return false;
  if (m.oddsMax) {
    if (action.type !== 'place-bet') return false;
    const parent = findParent(game, action.betType, action.parentId);
    if (!parent) return false;
    if (totalAfter(game, action, post) !== maxOddsAmount(game, parent.id)) return false;
  }
  return true;
}

/** Counter key helpers (counters persist for the current step only). */
const evKey = (type: string, betType?: string) => (betType ? `e:${type}:${betType}` : `e:${type}`);
const actKey = (m: ActionMatcher) => `a:${JSON.stringify(m)}`;

function eventBetType(e: GameEvent): BetTypeId | undefined {
  if (e.type === 'bet-placed') return e.bet.type;
  return 'betType' in e ? e.betType : undefined;
}

const RESOLVED_EVENT: Record<BetResult, GameEvent['type']> = {
  won: 'bet-won',
  lost: 'bet-lost',
  pushed: 'bet-pushed',
};

function evaluate(c: Condition, rt: SceneRuntime, game: GameState): boolean {
  if ('all' in c) return c.all.every((x) => evaluate(x, rt, game));
  if ('any' in c) return c.any.some((x) => evaluate(x, rt, game));
  if ('not' in c) return !evaluate(c.not, rt, game);
  if ('action' in c) return (rt.counters[actKey(c.action)] ?? 0) >= (c.count ?? 1);
  if ('event' in c) return (rt.counters[evKey(c.event, c.betType)] ?? 0) >= (c.count ?? 1);
  if ('rolls' in c) return game.rollCount - rt.stepStartRoll >= c.rolls;
  if ('phase' in c) return game.phase === c.phase;
  if ('point' in c) return game.point === c.point;
  if ('betOnTable' in c)
    return game.bets.some(
      (b) =>
        b.type === c.betOnTable.type &&
        b.amount >= (c.betOnTable.minAmount ?? 1) &&
        (c.betOnTable.point === undefined || b.point === c.betOnTable.point),
    );
  if ('betResolved' in c) {
    const { type, result } = c.betResolved;
    const outcomes: BetResult[] = result ? [result] : ['won', 'lost', 'pushed'];
    return outcomes.some((r) => (rt.counters[evKey(RESOLVED_EVENT[r], type)] ?? 0) > 0);
  }
  if ('bankrollAtLeast' in c) return game.bankroll >= c.bankrollAtLeast;
  if ('bankrollAtMost' in c) return game.bankroll <= c.bankrollAtMost;
  if ('equityAtLeast' in c) return equity(game) >= c.equityAtLeast;
  if ('equityAtMost' in c) return equity(game) <= c.equityAtMost;
  if ('previewed' in c) return (rt.counters[`p:${c.previewed}`] ?? 0) > 0;
  if ('autoRollCompleted' in c) {
    const om = c.autoRollCompleted.oddsMultiple;
    const key = om === undefined ? 'autoRolls' : `autoRolls:${om}`;
    return (rt.counters[key] ?? -1) >= (c.autoRollCompleted.minRolls ?? 0);
  }
  if ('acknowledged' in c) return (rt.counters.ack ?? 0) > 0;
  return false;
}

/** Collects every matcher in a condition (to count actions against all of them). */
function matchersOf(c: Condition, out: ActionMatcher[] = []): ActionMatcher[] {
  if ('all' in c) c.all.forEach((x) => matchersOf(x, out));
  else if ('any' in c) c.any.forEach((x) => matchersOf(x, out));
  else if ('not' in c) matchersOf(c.not, out);
  else if ('action' in c) out.push(c.action);
  return out;
}

/** Does completing this condition require dice to be rolled? (used to lock Roll until it makes sense) */
export function conditionNeedsRoll(c: Condition): boolean {
  if ('all' in c) return c.all.some(conditionNeedsRoll);
  if ('any' in c) return c.any.some(conditionNeedsRoll);
  if ('not' in c) return conditionNeedsRoll(c.not);
  if ('action' in c) return c.action.type === 'roll';
  return (
    'rolls' in c ||
    'event' in c ||
    'phase' in c ||
    'point' in c ||
    'betResolved' in c ||
    'bankrollAtLeast' in c ||
    'bankrollAtMost' in c ||
    'equityAtLeast' in c ||
    'equityAtMost' in c
  );
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

function deny(message: string): Validation {
  return { ok: false, code: 'not-allowed-by-scene', message };
}

export function allowedActionsFor(scene: SceneConfig, step?: SceneStep): readonly ActionType[] {
  return step?.allowedActions ?? scene.allowedActions ?? ALL_ACTIONS;
}

export function allowedBetsFor(scene: SceneConfig, step?: SceneStep): BetTypeId[] | 'all' {
  return step?.allowedBets ?? scene.allowedBets ?? 'all';
}

export function highlightedFor(scene: SceneConfig, step?: SceneStep): BetTypeId[] {
  return step?.highlightedBets ?? scene.highlightedBets ?? [];
}

/** True when the Roll button should be locked by the current step, with the reason. */
export function rollLock(scene: SceneConfig, rt: SceneRuntime, game: GameState): string | null {
  const step = currentStep(scene, rt);
  if (
    scene.onForcedExhausted === 'block' &&
    game.forcedDice.length === 0 &&
    (scene.forcedDice || step)
  )
    return 'The lesson is over: try the sandbox!';
  if (!allowedActionsFor(scene, step).includes('roll'))
    return step?.hint ?? 'Rolling is switched off in this step.';
  if (step && rt.satisfied) return 'Tap Next to continue.';
  if (
    step &&
    !step.expect &&
    !step.allowedActions &&
    !scene.allowedActions &&
    !conditionNeedsRoll(step.completeWhen)
  )
    return step.hint ?? 'Finish the current step before rolling.';
  if (step?.expect && !step.expect.some((m) => m.type === 'roll'))
    return step.hint ?? 'Finish the current step before rolling.';
  return null;
}

/** Scene restrictions on top of engine validation. */
export function gateAction(
  scene: SceneConfig,
  rt: SceneRuntime,
  game: GameState,
  action: Action,
): Validation {
  const step = currentStep(scene, rt);
  const hint = step?.hint;
  if (action.type === 'roll') {
    const lock = rollLock(scene, rt, game);
    return lock ? deny(lock) : { ok: true, warnings: [] };
  }
  if (!allowedActionsFor(scene, step).includes(action.type))
    return deny(hint ?? 'That is not available in this step.');
  if (action.type === 'place-bet') {
    const list = allowedBetsFor(scene, step);
    if (list !== 'all' && !list.includes(action.betType))
      return deny(hint ?? `${BET_TYPES[action.betType].label} is not available in this lesson.`);
  }
  if (rt.satisfied) return deny('Tap Next to continue.');
  if (step?.expect && !step.expect.some((m) => matches(m, action, game, false)))
    return deny(hint ?? 'Follow the step above to continue.');
  return { ok: true, warnings: [] };
}

/** Is a bet type usable at all right now (for dimming regions and enabling segments)? */
export function betTypeAllowed(scene: SceneConfig, rt: SceneRuntime, type: BetTypeId): boolean {
  const list = allowedBetsFor(scene, currentStep(scene, rt));
  return list === 'all' || list.includes(type);
}

// ---------------------------------------------------------------------------
// Observe
// ---------------------------------------------------------------------------

function bump(counters: Record<string, number>, key: string) {
  counters[key] = (counters[key] ?? 0) + 1;
}

function chain(
  scene: SceneConfig,
  runtime: SceneRuntime,
  game: GameState,
  acc: { completedStep?: string; sceneCompleted?: boolean },
): { runtime: SceneRuntime; game: GameState; completedStep?: string; sceneCompleted?: boolean } {
  let rt = runtime;
  let g = game;
  const out: { completedStep?: string; sceneCompleted?: boolean } = { ...acc };
  const steps = scene.steps ?? [];
  for (let guard = 0; guard < steps.length + 1; guard++) {
    const step = steps[rt.stepIndex];
    if (!step || rt.done || rt.satisfied) break;
    if (!evaluate(step.completeWhen, rt, g)) break;
    out.completedStep = step.id;
    const last = rt.stepIndex === steps.length - 1;
    if (last) {
      rt = { ...rt, done: true };
      out.sceneCompleted = true;
      break;
    }
    if (step.advance === 'button' && !('acknowledged' in step.completeWhen)) {
      rt = { ...rt, satisfied: true };
      break;
    }
    const next = startStep(scene, g, rt.stepIndex + 1);
    rt = next.runtime;
    g = next.game;
  }
  return { runtime: rt, game: g, ...out };
}

/**
 * Feed an input into the runner. For `action` inputs `game` is the state AFTER the action.
 * Returns the (possibly step-advanced) game and runtime.
 */
export function observe(
  scene: SceneConfig,
  rt: SceneRuntime,
  game: GameState,
  input: SceneInput,
): { runtime: SceneRuntime; game: GameState; completedStep?: string; sceneCompleted?: boolean } {
  const step = currentStep(scene, rt);
  if (!step) return { runtime: rt, game };
  const counters = { ...rt.counters };
  let runtime: SceneRuntime = { ...rt, counters };

  if (input.kind === 'acknowledged') {
    if (rt.satisfied) {
      const next = startStep(scene, game, rt.stepIndex + 1);
      return chain(scene, next.runtime, next.game, {});
    }
    counters.ack = 1;
  } else if (rt.satisfied) {
    return { runtime: rt, game };
  } else if (input.kind === 'previewed') {
    bump(counters, `p:${input.betType}`);
  } else if (input.kind === 'auto-roll-completed') {
    counters.autoRolls = Math.max(counters.autoRolls ?? 0, input.rolls);
    if (input.oddsMultiple !== undefined) {
      const k = `autoRolls:${input.oddsMultiple}`;
      counters[k] = Math.max(counters[k] ?? 0, input.rolls);
    }
  } else {
    for (const m of matchersOf(step.completeWhen))
      if (matches(m, input.action, game, true)) bump(counters, actKey(m));
    for (const e of input.events) {
      bump(counters, evKey(e.type));
      const bt = eventBetType(e);
      if (bt) bump(counters, evKey(e.type, bt));
    }
  }
  runtime = { ...runtime, counters };
  const res = chain(scene, runtime, game, {});
  // a satisfied step that waits for Next still reports completion once
  return res;
}
