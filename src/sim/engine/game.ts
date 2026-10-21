import { BET_TYPES, bonusTargets, upfrontVig, type BonusBetTypeId } from './bets';
import { resolveRules } from './rules';
import { rollDice, seedRng } from './rng';
import { resolveRoll } from './resolve';
import { findMergeTarget, findParent, oddsPoint, validateAction } from './validate';
import { isWorking } from './working';
import { POINT_NUMBERS } from './types';
import type {
  Action,
  ApplyResult,
  Bet,
  BetTypeDef,
  BetTypeId,
  BetTypeStats,
  Cents,
  Dice,
  GameEvent,
  GameState,
  Phase,
  PointNumber,
  RulePresetId,
  TableRules,
  WorkingMode,
} from './types';

export { isWorking };

export interface BetInit {
  ref?: string;
  type: BetTypeId;
  amount: Cents;
  point?: PointNumber;
  parentRef?: string;
  working?: WorkingMode;
  /** bonus bets only: numbers already collected (scenes that start mid-hand) */
  progress?: number[];
}

export interface CreateGameOptions {
  rules?: Partial<TableRules> | RulePresetId;
  bankroll?: Cents; // default 50_000 ($500)
  seed?: number; // default: caller supplies (UI uses crypto.getRandomValues once)
  phase?: Phase;
  point?: PointNumber | null; // must be consistent (point iff phase==='point')
  bets?: BetInit[]; // deducted from bankroll; throws if invalid
  forcedDice?: Dice[];
}

export interface ApplyOptions {
  /** Expected table loss (cents) for the roll about to happen, given the pre-roll state. */
  expectedLossFn?: (s: GameState) => number;
  /** Expected loss (cents) per bet type for the roll about to happen. */
  expectedLossByTypeFn?: (s: GameState) => Partial<Record<BetTypeId, number>>;
  /** Variance (cents^2) of what the roll about to happen adds to the session result, given the pre-roll state; summed into stats.variance. */
  varianceFn?: (s: GameState) => number;
}

function addBet(
  state: GameState,
  type: BetTypeId,
  amount: Cents,
  point: PointNumber | null,
  parentId: string | null,
  working: WorkingMode,
  progress?: readonly number[],
): { state: GameState; bet: Bet } {
  const bet: Bet = {
    id: `b${state.nextBetId}`,
    type,
    amount,
    point,
    parentId,
    working,
    placedOnRoll: state.rollCount,
    vigPaid: upfrontVig(type, amount, state.rules),
    ...(progress ? { progress } : {}),
  };
  return {
    bet,
    state: {
      ...state,
      bankroll: state.bankroll - amount - bet.vigPaid,
      bets: [...state.bets, bet],
      nextBetId: state.nextBetId + 1,
      stats: bet.vigPaid
        ? { ...state.stats, totalVig: state.stats.totalVig + bet.vigPaid }
        : state.stats,
    },
  };
}

export function createGame(opts: CreateGameOptions = {}): GameState {
  const rules = resolveRules(opts.rules);
  const seed = opts.seed ?? 1;
  const phase: Phase = opts.phase ?? (opts.point != null ? 'point' : 'come-out');
  const point = opts.point ?? null;
  if ((phase === 'point') !== (point !== null))
    throw new Error('createGame: point must be set if and only if phase is "point"');
  let state: GameState = {
    version: 1,
    rules,
    phase,
    point,
    bankroll: opts.bankroll ?? 50_000,
    bets: [],
    rollCount: 0,
    history: [],
    rng: seedRng(seed),
    seed,
    forcedDice: [...(opts.forcedDice ?? [])],
    nextBetId: 1,
    stats: {
      totalWagered: 0,
      totalWon: 0,
      totalLost: 0,
      totalVig: 0,
      expectedLoss: 0,
      variance: 0,
      byType: {},
    },
  };
  const refs = new Map<string, string>();
  for (const init of opts.bets ?? []) {
    const def = BET_TYPES[init.type];
    if (!def) throw new Error(`createGame: unknown bet type ${String(init.type)}`);
    // Validate against a phase in which the bet type is legal, so scenes can start mid-hand.
    const viewPhase: Phase =
      init.type === 'pass-line' || init.type === 'dont-pass' || def.category === 'bonus'
        ? 'come-out'
        : init.type === 'come' || init.type === 'dont-come'
          ? 'point'
          : state.phase;
    const view: GameState = {
      ...state,
      phase: viewPhase,
      point: viewPhase === 'point' ? (state.point ?? 6) : null,
    };
    const parentId = init.parentRef !== undefined ? refs.get(init.parentRef) : undefined;
    if (init.parentRef !== undefined && parentId === undefined)
      throw new Error(`createGame: unknown parentRef ${init.parentRef}`);
    // Odds validate in the real state; a pre-travelled come bet is validated as in the box.
    const useView = def.category !== 'odds';
    const v = validateAction(useView ? view : state, {
      type: 'place-bet',
      betType: init.type,
      amount: init.amount,
      parentId,
    });
    if (!v.ok) throw new Error(`createGame: bet ${init.type} ${init.amount}: ${v.message}`);
    let betPoint: PointNumber | null = null;
    let pid: string | null = null;
    if (def.category === 'odds') {
      const parent = findParent(state, init.type, parentId);
      if (!parent) throw new Error('createGame: odds need a parent');
      pid = parent.id;
      betPoint = oddsPoint(state, parent);
    } else if (init.type === 'come' || init.type === 'dont-come') {
      betPoint = init.point ?? null;
      if (betPoint !== null && !POINT_NUMBERS.includes(betPoint))
        throw new Error(`createGame: invalid point ${String(betPoint)} for ${init.type}`);
    } else if (init.point !== undefined) {
      throw new Error(`createGame: ${init.type} cannot have a point`);
    }
    let progress: number[] | undefined;
    if (init.progress !== undefined) {
      if (def.category !== 'bonus')
        throw new Error(`createGame: ${init.type} cannot have progress`);
      const targets = bonusTargets(init.type as BonusBetTypeId);
      progress = [...new Set(init.progress)].sort((a, b) => a - b);
      if (progress.some((n) => !targets.includes(n)) || progress.length >= targets.length)
        throw new Error(`createGame: invalid progress for ${init.type}`);
    }
    const merge = findMergeTarget(
      state,
      init.type,
      pid ? state.bets.find((b) => b.id === pid) : undefined,
    );
    if (merge && betPoint === null)
      throw new Error(`createGame: duplicate ${init.type}; set the combined amount instead`);
    const r = addBet(
      state,
      init.type,
      init.amount,
      betPoint,
      pid,
      init.working ?? 'auto',
      progress,
    );
    state = r.state;
    if (init.ref) refs.set(init.ref, r.bet.id);
  }
  return state;
}

/** Forced queue first, then RNG. */
export function nextDice(state: GameState): { dice: Dice; forced: boolean; state: GameState } {
  const [head, ...rest] = state.forcedDice;
  if (head) return { dice: head, forced: true, state: { ...state, forcedDice: rest } };
  const [dice, rng] = rollDice(state.rng);
  return { dice, forced: false, state: { ...state, rng } };
}

/** bankroll + sum(bet.amount) */
export function equity(state: GameState): Cents {
  let t = state.bankroll;
  for (const b of state.bets) t += b.amount;
  return t;
}

export function getBetType(id: BetTypeId): BetTypeDef {
  return BET_TYPES[id];
}

function validationFail(
  state: GameState,
  error: Extract<ReturnType<typeof validateAction>, { ok: false }>,
): ApplyResult {
  return { ok: false, state, error };
}

export function applyAction(state: GameState, action: Action, opts?: ApplyOptions): ApplyResult {
  const v = validateAction(state, action);
  if (!v.ok) return validationFail(state, v);
  const warnings = v.warnings;

  switch (action.type) {
    case 'place-bet': {
      const def = BET_TYPES[action.betType];
      const parent =
        def.category === 'odds' ? findParent(state, action.betType, action.parentId) : undefined;
      const existing = findMergeTarget(state, action.betType, parent);
      if (existing) {
        const r = setAmount(state, existing, existing.amount + action.amount);
        return { ok: true, state: r.state, events: r.events, warnings };
      }
      let point: PointNumber | null = null;
      if (parent) point = oddsPoint(state, parent);
      const r = addBet(state, action.betType, action.amount, point, parent?.id ?? null, 'auto');
      return { ok: true, state: r.state, events: [{ type: 'bet-placed', bet: r.bet }], warnings };
    }
    case 'set-amount': {
      const bet = state.bets.find((b) => b.id === action.betId) as Bet;
      if (bet.amount === action.amount) return { ok: true, state, events: [], warnings };
      const r = setAmount(state, bet, action.amount);
      return { ok: true, state: r.state, events: r.events, warnings };
    }
    case 'remove-bet': {
      const gone = state.bets.filter((b) => b.id === action.betId || b.parentId === action.betId);
      const ids = new Set(gone.map((b) => b.id));
      let refundAll = 0;
      let vigBack = 0;
      const events: GameEvent[] = gone.map((b) => {
        const refund = b.amount + b.vigPaid;
        refundAll += refund;
        vigBack += b.vigPaid;
        return { type: 'bet-removed', betId: b.id, betType: b.type, refund };
      });
      const next: GameState = {
        ...state,
        bankroll: state.bankroll + refundAll,
        bets: state.bets.filter((b) => !ids.has(b.id)),
        stats: vigBack ? { ...state.stats, totalVig: state.stats.totalVig - vigBack } : state.stats,
      };
      return { ok: true, state: next, events, warnings };
    }
    case 'set-working': {
      const next: GameState = {
        ...state,
        bets: state.bets.map((b) =>
          b.id === action.betId ? { ...b, working: action.working } : b,
        ),
      };
      const events: GameEvent[] = [
        { type: 'bet-working-changed', betId: action.betId, working: action.working },
      ];
      return { ok: true, state: next, events, warnings };
    }
    case 'roll': {
      let s = state;
      let dice: Dice;
      let forced: boolean;
      if (action.dice) {
        dice = action.dice;
        forced = true;
      } else {
        const nd = nextDice(state);
        dice = nd.dice;
        forced = nd.forced;
        s = nd.state;
      }
      const loss = opts?.expectedLossFn ? opts.expectedLossFn(state) : 0;
      const byTypeLoss = opts?.expectedLossByTypeFn ? opts.expectedLossByTypeFn(state) : null;
      const r = resolveRoll(s, dice, forced);
      let out = r.state;
      if (opts?.varianceFn) {
        const v = opts.varianceFn(state);
        if (v) out = { ...out, stats: { ...out.stats, variance: out.stats.variance + v } };
      }
      if (loss || byTypeLoss) {
        const byType = { ...out.stats.byType };
        if (byTypeLoss) {
          for (const [k, x] of Object.entries(byTypeLoss) as [BetTypeId, number][]) {
            const cur = byType[k];
            const base: BetTypeStats = cur ?? {
              count: 0,
              wagered: 0,
              won: 0,
              lost: 0,
              vig: 0,
              net: 0,
              expectedLoss: 0,
            };
            byType[k] = { ...base, expectedLoss: base.expectedLoss + x };
          }
        }
        out = {
          ...out,
          stats: { ...out.stats, expectedLoss: out.stats.expectedLoss + loss, byType },
        };
      }
      return { ok: true, state: out, events: r.events, warnings };
    }
  }
}

function setAmount(
  state: GameState,
  bet: Bet,
  amount: Cents,
): { state: GameState; events: GameEvent[] } {
  const vigPaid = upfrontVig(bet.type, amount, state.rules);
  const vigDelta = vigPaid - bet.vigPaid;
  const next: GameState = {
    ...state,
    bankroll: state.bankroll - (amount - bet.amount) - vigDelta,
    bets: state.bets.map((b) => (b.id === bet.id ? { ...b, amount, vigPaid } : b)),
    stats: vigDelta ? { ...state.stats, totalVig: state.stats.totalVig + vigDelta } : state.stats,
  };
  return {
    state: next,
    events: [{ type: 'bet-amount-changed', betId: bet.id, from: bet.amount, to: amount }],
  };
}

/** Deterministic. Throws if an action is rejected. */
export function replay(initial: GameState, actions: Action[], opts?: ApplyOptions): GameState {
  let s = initial;
  for (const a of actions) {
    const r = applyAction(s, a, opts);
    if (!r.ok) throw new Error(`replay: action rejected (${r.error.code}): ${r.error.message}`);
    s = r.state;
  }
  return s;
}
