// FROZEN CONTRACT: copied verbatim from docs/design/simulator.md §1.2, then adjusted per
// docs/design/decisions.md (buy/lay 5/6/8/9 added to BetTypeId). Contract changes go through the orchestrator.

export type Cents = number;               // integer cents; $10 = 1000
export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export type Dice = readonly [Die, Die];
/** Standard points. Crapless craps (rules.variant 'crapless') adds 2, 3, 11 and 12. */
export type StandardPoint = 4 | 5 | 6 | 8 | 9 | 10;
export type PointNumber = 2 | 3 | StandardPoint | 11 | 12;
export const POINT_NUMBERS: readonly PointNumber[] = [4, 5, 6, 8, 9, 10];
/** Every point in crapless craps: any come-out total but 7. */
export const CRAPLESS_POINTS: readonly PointNumber[] = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
/** A per-point table (odds multiples). Standard tables never reach 2, 3, 11 or 12. */
export type PointTable = Record<PointNumber, number>;
/** 'standard' craps, or 'crapless' (come-out: 7 wins, nothing loses, every other total is a point; no don't side). */
export type RulesVariant = 'standard' | 'crapless';
export type Phase = 'come-out' | 'point';

export type BetTypeId =
  | 'pass-line' | 'dont-pass' | 'come' | 'dont-come'
  | 'pass-odds' | 'dont-pass-odds' | 'come-odds' | 'dont-come-odds'
  | 'place-4' | 'place-5' | 'place-6' | 'place-8' | 'place-9' | 'place-10'
  | 'place-2' | 'place-3' | 'place-11' | 'place-12'   // crapless only
  | 'buy-4' | 'buy-5' | 'buy-6' | 'buy-8' | 'buy-9' | 'buy-10'
  | 'lay-4' | 'lay-5' | 'lay-6' | 'lay-8' | 'lay-9' | 'lay-10'
  | 'field' | 'big-6' | 'big-8'
  | 'hard-4' | 'hard-6' | 'hard-8' | 'hard-10'
  | 'any-7' | 'any-craps' | 'yo-11' | 'aces-2' | 'boxcars-12' | 'ace-deuce-3'
  | 'horn' | 'c-e' | 'world';

export type BetCategory =
  | 'line' | 'come' | 'odds' | 'place' | 'buy' | 'lay'
  | 'field' | 'big' | 'hardway' | 'prop';

/** 'auto' = follow table convention (see isWorking); 'on'/'off' = player override. */
export type WorkingMode = 'auto' | 'on' | 'off';

export interface Bet {
  id: string;                 // 'b1', 'b2', … from state.nextBetId (deterministic)
  type: BetTypeId;
  amount: Cents;              // chips at risk (for lay/lay-odds: the amount laid)
  /** come/dont-come after travelling; odds bets: their parent's point; else null */
  point: PointNumber | null;
  parentId: string | null;    // odds bets only
  working: WorkingMode;
  placedOnRoll: number;       // state.rollCount when placed
  /** Upfront vig already paid (only when rules.vig.timing === 'upfront'); refunded on take-down */
  vigPaid: Cents;
}

export interface TableRules {
  presetId: RulePresetId;
  variant: RulesVariant;      // EXTENSION (crapless craps); default 'standard'
  tableMin: Cents;            // line, come, place, buy, lay, field, big, hardway minimum
  tableMax: Cents;            // per-bet maximum (odds excluded)
  propMin: Cents;             // one-roll center bets minimum
  /** max odds as a multiple of the flat bet, per point */
  maxOdds: PointTable;
  /** max lay odds (don't side) as a multiple of the flat bet, per point */
  maxLayOdds: PointTable;
  fieldPays: { 2: number; 12: number };          // multipliers (to 1)
  vig: {
    rate: number;                                // 0.05
    timing: 'on-win' | 'upfront';
    rounding: 'floor-dollar-min-1' | 'exact-cents';
  };
  /** Payouts floor to this unit (1 = exact cents). Realistic tables use 100 or 50. */
  payoutUnit: Cents;
  placeBetsWorkOnComeOut: boolean;               // default false (applies to place + buy)
  hardwaysWorkOnComeOut: boolean;                // default false
  comeOddsWorkOnComeOut: boolean;                // default false
  allowPutBets: boolean;                         // default false (pass/come flat after point)
}

export type RulePresetId =
  | 'standard-vegas' | 'field-3x-12' | 'odds-10x' | 'odds-100x' | 'crapless';

export interface RollRecord {
  n: number;                   // 1-based roll number
  dice: Dice;
  total: number;               // 2..12
  hard: boolean;               // dice[0] === dice[1]
  phaseBefore: Phase;
  pointBefore: PointNumber | null;
  forced: boolean;             // came from the forced-dice queue
  net: Cents;                  // player's net cash result of this roll (sum of wins - losses - vig)
}

export interface RngState { s: readonly [number, number, number, number]; }

/** Per-bet-type session totals (EXTENSION to the frozen contract, requested by the session panel). */
export interface BetTypeStats {
  count: number;              // bets resolved (win/lose/push)
  wagered: Cents;             // amounts at the moment each bet resolved
  won: Cents;                 // profit received (after vig)
  lost: Cents;                // amounts lost
  vig: Cents;
  net: Cents;                 // won - lost (actual result)
  expectedLoss: number;       // cents (float), from applyAction opts.expectedLossByTypeFn
}

export interface SessionStats {
  totalWagered: Cents;        // sum of amounts at the moment each bet resolved (win/lose/push), action measure
  totalWon: Cents;            // profit received (after vig)
  totalLost: Cents;           // amounts lost
  totalVig: Cents;
  /** Sum over rolls of tableExpectedLossPerRoll(stateBeforeRoll), in cents (float) */
  expectedLoss: number;
  /** EXTENSION: per bet type breakdown (only types that have appeared). */
  byType: Partial<Record<BetTypeId, BetTypeStats>>;
}

export interface GameState {
  version: 1;
  rules: TableRules;
  phase: Phase;
  point: PointNumber | null;
  bankroll: Cents;            // money in the rack, NOT on the table
  bets: readonly Bet[];       // ordered by placement
  rollCount: number;
  history: readonly RollRecord[];   // last 200 rolls (older dropped)
  rng: RngState;
  seed: number;
  forcedDice: readonly Dice[];      // FIFO queue consumed before RNG
  nextBetId: number;
  stats: SessionStats;
}

// ---------- actions ----------
export type Action =
  | { type: 'place-bet'; betType: BetTypeId; amount: Cents; parentId?: string }
  | { type: 'set-amount'; betId: string; amount: Cents }   // new total amount
  | { type: 'remove-bet'; betId: string }
  | { type: 'set-working'; betId: string; working: WorkingMode }
  | { type: 'roll'; dice?: Dice };                          // dice given = forced for this roll
export type ActionType = Action['type'];

export type ValidationCode =
  | 'unknown-bet' | 'bad-amount' | 'below-min' | 'above-max' | 'insufficient-funds'
  | 'wrong-phase'               // e.g. come during come-out, pass-line during point
  | 'needs-parent'              // odds without a flat bet / come bet not yet travelled
  | 'odds-limit'                // exceeds maxOdds / maxLayOdds
  | 'contract-bet'              // pass/come flat can't be removed or reduced once on a point
  | 'cannot-increase'           // don't-side flat after point, come/DC on number
  | 'not-removable'
  | 'unit-multiple'             // horn multiple of 4 units, world 5, c-e 2
  | 'not-allowed-by-scene';     // added by scene layer, never by engine

export type Validation =
  | { ok: true; warnings: Warning[] }
  | { ok: false; code: ValidationCode; message: string };

export interface Warning {
  code: 'short-pay'       // amount not a multiple of the payout unit (e.g. place 6 not in $6)
      | 'vig-rounding'    // buy/lay amount where floor-dollar vig > 5%
      | 'off-on-come-out' // bet will not work until point is set
      | 'gives-up-ev';    // removing a bet with positive EV (e.g. DP on point)
  message: string;
  suggestedAmount?: Cents;
}

// ---------- events ----------
export type GameEvent =
  | { type: 'bet-placed'; bet: Bet }
  | { type: 'bet-amount-changed'; betId: string; from: Cents; to: Cents }
  | { type: 'bet-removed'; betId: string; betType: BetTypeId; refund: Cents }
  | { type: 'bet-working-changed'; betId: string; working: WorkingMode }
  | { type: 'dice-rolled'; roll: RollRecord }
  | { type: 'bet-won'; betId: string; betType: BetTypeId; amount: Cents; profit: Cents; vig: Cents; staysUp: boolean }
  | { type: 'bet-lost'; betId: string; betType: BetTypeId; amount: Cents }
  | { type: 'bet-pushed'; betId: string; betType: BetTypeId; amount: Cents }
  | { type: 'bet-returned'; betId: string; betType: BetTypeId; amount: Cents; reason: 'odds-off' | 'parent-gone' }
  | { type: 'bet-travelled'; betId: string; betType: 'come' | 'dont-come'; point: PointNumber }
  | { type: 'natural'; total: 7 | 11 }
  | { type: 'craps'; total: 2 | 3 | 12 }     // never in crapless
  | { type: 'point-established'; point: PointNumber }
  | { type: 'point-made'; point: PointNumber }
  | { type: 'seven-out'; point: PointNumber };

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[]; warnings: Warning[] }
  | { ok: false; state: GameState; error: Extract<Validation, { ok: false }> };

// ---------- bet registry ----------
export interface RollContext { dice: Dice; total: number; hard: boolean; phase: Phase; point: PointNumber | null; }

export type Resolution =
  | { kind: 'none' }
  | { kind: 'win'; profit: Cents; vig: Cents }  // profit before vig deduction; vig deducted from cash paid
  | { kind: 'lose' }
  | { kind: 'push' }
  | { kind: 'travel'; point: PointNumber }       // come/dont-come only
  | { kind: 'return'; reason: 'odds-off' | 'parent-gone' };

export interface BetTypeDef {
  id: BetTypeId;
  label: string;             // 'Place 6'
  shortLabel: string;        // 'P6'
  category: BetCategory;
  number: PointNumber | null; // place/buy/lay/big/hard number
  oneRoll: boolean;          // field + props
  /** after a win: chips stay on layout (only profit paid) or come down (amount+profit paid) */
  afterWin: 'stays-up' | 'comes-down';
  /** amount must be a multiple of unit * this (horn 4, world 5, c-e 2) */
  unitMultiple: number;
  /** Payout ratio as [numerator, denominator] for simple bets; props with mixed pays use resolve() */
  describePayout(rules: TableRules, point: PointNumber | null): string; // '7 to 6'
  resolve(bet: Bet, roll: RollContext, rules: TableRules, working: boolean): Resolution;
}
