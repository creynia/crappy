# crappy: Simulator Design

Status: design spike, ready for implementation. Owner: simulator track.
Related: `docs/design/architecture.md` (app shell, routing, build), `docs/design/curriculum.md` (lessons that embed scenes).

The simulator is a visual, touch-first craps table. The user picks a move (a bet and an amount), sees its expected value (EV) **before** confirming, confirms, and then rolls. The same component runs as a free **sandbox** and is embedded in lessons as **guided scenes**, which can have presets, restrictions, forced dice and step scripts. It also has an **auto-roll** mode that simulates many rolls of a preset strategy, for the variance, bankroll and strategy-comparison lessons.

All figures in this document were checked by exact rational computation (Python `fractions`). The edge table in §2.3 is the source of truth for the tests.

---

## 0. Decisions at a glance

| Topic | Decision |
|---|---|
| Money | Integer **cents** (`number`, always an integer) everywhere in the engine. Display rounds to cents. |
| Engine | Pure, immutable, framework-free TS in `src/sim/engine/`. No DOM, no `Math.random`, no `Date`. |
| Math | Exact rationals (`bigint`-based `Fraction`) in `src/sim/math/`. EV comes from the same payout functions the engine uses, so preview and play always agree. |
| Default rules | **Standard Vegas**: 3-4-5x odds, Field pays 2x on 2 **and 2x on 12**, buy/lay vig 5% **collected only on a win**, don't-side lay odds up to **6x the flat bet**. Presets: `field-3x-12`, `odds-10x`, `odds-100x`. |
| Bets in v1 | The list in §1.3, including `world`, plus **hop bets** (`hop`, added in I035: one-roll bet on an exact pair, easy 15:1, hard 30:1). **No** Fire Bet or bonus/side bets. |
| Odds | Odds are **separate bet instances** (`pass-odds`, etc.) linked to their flat bet by `parentId`. |
| RNG | `xoshiro128**` seeded through `splitmix32`, with rejection-sampled d6. Its state is stored in `GameState`, so play is replayable. |
| Rendering | **SVG** layouts with a data-driven region map: one portrait layout, one landscape layout, and a separate **Center (props)** panel. Controls are HTML around the SVG. |
| Bet entry | Tap a region, then the **Bet sheet** (EV preview + "Why?" expander + better alternative), then **Confirm** or **Cancel**. The sandbox allows every bet; bad bets are flagged red and come with a suggested alternative. |
| Pacing | Animations are about 1s (dice) plus chip payouts. Tap anywhere to skip. Speed setting: `normal` / `fast` / `instant`. `prefers-reduced-motion` defaults to `instant` with fades. |
| Auto-roll | Pure `simulateSession` / `simulateMany` with preset strategies (lowest-edge, practical, fun lenses). Output is an SVG bankroll chart against the expected line, plus a summary. |
| Scenes | JSON-serializable `SceneConfig` with a step script and declarative completion conditions. Lessons embed it with `<Simulator scene onEvent/>` or `mountSimulator(el, props)`. |
| Tests | Vitest (engine resolution matrix over all 36 outcomes, exact-EV tests, Markov cross-check, Monte-Carlo), @testing-library/preact component tests, Playwright e2e (phone portrait and landscape, single-file build). |

---

## 1. Game engine (`src/sim/engine/`)

### 1.1 Files

```
src/sim/engine/
  types.ts        // all public types (verbatim from this doc, frozen contract)
  rules.ts        // DEFAULT_RULES, RULE_PRESETS, resolveRules()
  rng.ts          // seedRng, nextU32, rollDie, rollDice
  bets.ts         // BET_TYPES registry (BetTypeDef per BetTypeId), payout helpers
  validate.ts     // validateAction, legalBetTypes, maxAmount helpers
  resolve.ts      // resolveRoll (pure: state + dice -> state + events)
  game.ts         // createGame, applyAction, nextDice, isWorking, equity, replay
  money.ts        // formatMoney, parseMoney, vig helpers
  index.ts        // re-exports
```

### 1.2 Types (`types.ts`, a frozen contract that every chunk codes against)

```ts
export type Cents = number;               // integer cents; $10 = 1000
export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export type Dice = readonly [Die, Die];
export type PointNumber = 4 | 5 | 6 | 8 | 9 | 10;
export const POINT_NUMBERS: readonly PointNumber[] = [4, 5, 6, 8, 9, 10];
export type Phase = 'come-out' | 'point';

export type BetTypeId =
  | 'pass-line' | 'dont-pass' | 'come' | 'dont-come'
  | 'pass-odds' | 'dont-pass-odds' | 'come-odds' | 'dont-come-odds'
  | 'place-4' | 'place-5' | 'place-6' | 'place-8' | 'place-9' | 'place-10'
  | 'buy-4' | 'buy-10' | 'lay-4' | 'lay-10'
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
  tableMin: Cents;            // line, come, place, buy, lay, field, big, hardway minimum
  tableMax: Cents;            // per-bet maximum (odds excluded)
  propMin: Cents;             // one-roll center bets minimum
  /** max odds as a multiple of the flat bet, per point */
  maxOdds: Record<PointNumber, number>;
  /** max lay odds (don't side) as a multiple of the flat bet, per point */
  maxLayOdds: Record<PointNumber, number>;
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

export type RulePresetId = 'standard-vegas' | 'field-3x-12' | 'odds-10x' | 'odds-100x';

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

export interface SessionStats {
  totalWagered: Cents;        // sum of amounts at the moment each bet resolved (win/lose/push), action measure
  totalWon: Cents;            // profit received (after vig)
  totalLost: Cents;           // amounts lost
  totalVig: Cents;
  /** Sum over rolls of tableExpectedLossPerRoll(stateBeforeRoll), in cents (float) */
  expectedLoss: number;
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
  | { type: 'craps'; total: 2 | 3 | 12 }
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
```

### 1.3 Bet registry (`bets.ts`)

Payout notation is "X to Y" (profit X per Y wagered). "Default working" shows the `auto` meaning. `payout(amount, X, Y) = floorTo(amount * X / Y, rules.payoutUnit)`, using integer math (`Math.floor(amount*X/Y/unit)*unit`).

| id | category | resolves | pays | default working | after win | removable |
|---|---|---|---|---|---|---|
| `pass-line` | line | come-out: 7/11 win, 2/3/12 lose, 4-10 sets the point. point: point wins, 7 loses | 1:1 | always | stays-up | come-out only |
| `dont-pass` | line | come-out: 2/3 win, **12 push**, 7/11 lose. point: 7 wins, point loses | 1:1 | always | stays-up | yes (warning `gives-up-ev` on point) |
| `come` | come | `point===null`: like pass on its own come-out (7/11 win, 2/3/12 lose, else **travel**). on number: number wins, 7 loses | 1:1 | always | comes-down | only while in the come box (`point===null`) |
| `dont-come` | come | `point===null`: 2/3 win, 12 push, 7/11 lose, else travel. on number: 7 wins, number loses | 1:1 | always | comes-down | yes |
| `pass-odds` | odds | point wins, 7 loses | 4/10 2:1, 5/9 3:2, 6/8 6:5 | always | comes-down | yes |
| `dont-pass-odds` | odds | 7 wins, point loses | 4/10 1:2, 5/9 2:3, 6/8 5:6 | always | comes-down | yes |
| `come-odds` | odds | its point wins, 7 loses | as pass-odds | **off on come-out** (returned if decided) | comes-down | yes |
| `dont-come-odds` | odds | 7 wins, its point loses | as dont-pass-odds | always | comes-down | yes |
| `place-4`/`place-10` | place | N wins, 7 loses | 9:5 | off on come-out | stays-up | yes |
| `place-5`/`place-9` | place | N wins, 7 loses | 7:5 | off on come-out | stays-up | yes |
| `place-6`/`place-8` | place | N wins, 7 loses | 7:6 | off on come-out | stays-up | yes |
| `buy-4`/`buy-10` | buy | N wins, 7 loses | 2:1, minus vig | off on come-out | stays-up | yes |
| `lay-4`/`lay-10` | lay | 7 wins, N loses | 1:2, minus vig on the win | always | stays-up | yes |
| `field` | field | 2,3,4,9,10,11,12 win, else lose | 1:1; 2 pays `fieldPays[2]`, 12 pays `fieldPays[12]` | always | comes-down | n/a (one roll) |
| `big-6`/`big-8` | big | N wins, 7 loses | 1:1 | always | stays-up | yes |
| `hard-4`/`hard-10` | hardway | N as a pair wins; 7 or easy N loses | 7:1 | off on come-out | stays-up | yes |
| `hard-6`/`hard-8` | hardway | as above | 9:1 | off on come-out | stays-up | yes |
| `any-7` | prop | 7 wins | 4:1 | always | comes-down | one roll |
| `any-craps` | prop | 2,3,12 win | 7:1 | always | comes-down | one roll |
| `yo-11` | prop | 11 wins | 15:1 | always | comes-down | one roll |
| `aces-2` | prop | 2 wins | 30:1 | always | comes-down | one roll |
| `boxcars-12` | prop | 12 wins | 30:1 | always | comes-down | one roll |
| `ace-deuce-3` | prop | 3 wins | 15:1 | always | comes-down | one roll |
| `horn` | prop | amount/4 on each of 2,3,11,12. 2/12: profit = u·30 − 3u; 3/11: u·15 − 3u (u = amount/4) | mixed | always | comes-down | one roll |
| `c-e` | prop | amount/2 on craps (7:1) and on 11 (15:1). craps: 7u − u; 11: 15u − u | mixed | always | comes-down | one roll |
| `world` | prop | amount/5 on 2,3,7,11,12 (horn + any 7). 2/12: 30u − 4u = 26u; 3/11: 15u − 4u = 11u; **7: 4u − 4u = 0 → push** | mixed | always | comes-down | one roll |

`unitMultiple`: horn 4, world 5, c-e 2. With `propMin` = $1 that means horn in $4 steps, world in $5 steps, c-e in $2 steps.

**Vig (buy/lay)**: `vigBase` = the bet amount for buy, the potential win for lay. `vig = rounding==='exact-cents' ? round(vigBase*rate) : max(100, floor(vigBase*rate/100)*100)`. With `timing: 'on-win'` (the default) the vig is deducted only when the bet wins: `cashPaid = profit − vig`. With `'upfront'` it is charged from the bankroll at placement (stored in `bet.vigPaid`) and refunded on take-down.
Examples: buy-4 $20 wins → +$40 − $1 = **+$39**. buy-4 $10 → +$20 − $1 (10% vig, warning `vig-rounding`, suggested $20). lay-4 $40 wins → +$20 − $1 = **+$19**.

**Money flow**: placing a bet moves `amount` from bankroll to the table. On a win, `stays-up` bets pay `profit − vig` to the bankroll; `comes-down` bets pay `amount + profit − vig` and are removed. Losses remove the bet. A push on a `comes-down` bet returns the amount to the bankroll; a push on DP/DC leaves it in place. `return` gives the amount back to the bankroll and removes the bet.

### 1.4 Working rules (`isWorking(bet, state): boolean`)

- `working === 'on'` → true; `'off'` → false.
- `auto`: during the point phase, everything works. During come-out:
  - place/buy: `rules.placeBetsWorkOnComeOut` (default false)
  - hardway: `rules.hardwaysWorkOnComeOut` (default false)
  - come-odds: `rules.comeOddsWorkOnComeOut` (default false). If a non-working come-odds bet's parent wins or loses, the odds are **returned** (`return/odds-off`).
  - everything else: true.
- Non-working bets return `{kind:'none'}` (except the come-odds return above). `set-working` may toggle any multi-roll non-line bet: place, buy, lay, hardway, big, come-odds. Line, come, field and props cannot be toggled (`not-removable` code is reused, with the message "This bet is always working").

### 1.5 Validation (`validate.ts`)

`validateAction(state: GameState, action: Action): Validation` is pure. The checks run in this order. The first failure is returned; warnings accumulate.

**place-bet** `{betType, amount, parentId?}`
1. `BET_TYPES[betType]` exists → else `unknown-bet`.
2. `amount` is a positive integer multiple of 100 (whole dollars; v1 chips are whole dollars) → `bad-amount`. Multiple of `unitMultiple*100` → `unit-multiple`.
3. Min/max: props (`category==='prop'`) ≥ `propMin`; odds have no min beyond $1; others ≥ `tableMin`. Non-odds ≤ `tableMax` → `below-min`/`above-max`.
4. `amount + upfrontVig ≤ bankroll` → `insufficient-funds`.
5. Phase:
   - `pass-line`, `dont-pass`: `phase==='come-out'` unless `allowPutBets` (pass only) → `wrong-phase`.
   - `come`, `dont-come`: `phase==='point'` → `wrong-phase`.
   - everything else: any phase.
6. Odds:
   - `pass-odds`: needs `phase==='point'` and a `pass-line` bet (`parentId` optional, auto-resolved) → `needs-parent`. Limit: existing odds + amount ≤ `maxOdds[point] × flat` → `odds-limit`.
   - `dont-pass-odds`: needs a DP bet in the point phase; limit `maxLayOdds[point] × flat`.
   - `come-odds` / `dont-come-odds`: `parentId` must reference a come/DC bet with `point !== null` → `needs-parent`; limit as above using the parent's point.
7. **Merging**: placing a type that already exists as a mergeable instance goes through `set-amount` validation instead. Mergeable means a single instance per (type, point, parent): pass-line, dont-pass, come in the come box, dont-come in the DC box, odds per parent, place/buy/lay/big/hard/field/props. Travelled come/DC bets are never merged; each is its own instance.
8. Warnings: `short-pay` when the amount isn't a multiple of the payout's denominator unit. Place 6/8 need $6 multiples, place 5/9 need $5, odds on 5/9 need $2, odds on 6/8 need $5, lay odds on 4/10 need $2, lay odds on 5/9 need $3, lay odds on 6/8 need $6. `suggestedAmount` = nearest multiple ≥ amount. Also `vig-rounding` and `off-on-come-out`.

**set-amount** `{betId, amount}`: the bet must exist. Increase/decrease rules:
- pass-line on point: no decrease (`contract-bet`), no increase unless `allowPutBets` (`cannot-increase`).
- come on number: no change (`contract-bet`).
- dont-pass/dont-come on point: decrease allowed (warning `gives-up-ev`), increase → `cannot-increase`.
- odds: re-check the limit. Others: re-check min/max/funds. `amount` 0 is not valid; use remove-bet.

**remove-bet**: pass-line on point → `contract-bet`; come with a point → `contract-bet`; one-roll bets can be removed before the roll (refund). Removing a flat with odds also removes and refunds its odds (event `bet-removed` for each). DP/DC on point → OK + warning `gives-up-ev`.

**roll**: always valid in the engine. Scenes may block it.

Helpers: `legalBetTypes(state): BetTypeId[]`, `maxOddsAmount(state, parentId): Cents`, `suggestAmount(betType, amount, state): Cents`.

### 1.6 Roll resolution (`resolve.ts`)

```ts
export function resolveRoll(state: GameState, dice: Dice, forced: boolean): { state: GameState; events: GameEvent[] };
```

Algorithm (deterministic, pure):
1. Build `RollContext` from the **pre-roll** `phase`/`point`. Emit `dice-rolled` last, after `net` is known; the UI uses event order only within categories.
2. For each bet, in `state.bets` order, compute `def.resolve(bet, ctx, rules, isWorking(bet,state))`. All bets resolve against the pre-roll state. A come bet in the come box that travels to 6 on this roll is **not** also checked against the old come-6 bet's outcome. They are independent instances, so the old one wins and the new one travels.
3. Odds whose parent resolves while the odds are non-working: `return/odds-off`. Odds whose parent was removed: `return/parent-gone` (defensive, should not happen).
4. Apply money and update bets (travel sets `bet.point` and also sets `point` on its existing odds, which has none in practice). Accumulate `stats`.
5. Phase transition:
   - come-out: 7/11 → `natural`; 2/3/12 → `craps`; 4-10 → `phase='point'`, `point=total`, `point-established`.
   - point: total===point → `point-made`, `phase='come-out'`, `point=null`; 7 → `seven-out`, come-out; else no change.
6. `stats.expectedLoss += toNumber(tableExpectedLossPerRoll(pre-roll state))`. This is imported from math. To avoid a dependency cycle, the engine receives an optional `expectedLossFn` in `applyAction(state, action, opts)`; auto-roll and the container pass `math.tableExpectedLossPerRoll`.
7. Append a `RollRecord` (cap 200), `rollCount++`.

### 1.7 RNG and dice (`rng.ts`)

```ts
export function seedRng(seed: number): RngState;            // splitmix32 → 4 words; all-zero state impossible
export function nextU32(r: RngState): [number, RngState];   // xoshiro128**
export function rollDie(r: RngState): [Die, RngState];      // rejection: draw u < 4294967292 (=floor(2^32/6)*6), die = u % 6 + 1
export function rollDice(r: RngState): [Dice, RngState];
```
`game.ts`:
```ts
export interface CreateGameOptions {
  rules?: Partial<TableRules> | RulePresetId;
  bankroll?: Cents;                 // default 50_000 ($500)
  seed?: number;                    // default: caller supplies (UI uses crypto.getRandomValues once)
  phase?: Phase; point?: PointNumber | null;   // must be consistent (point iff phase==='point')
  bets?: BetInit[];                 // placed without bankroll deduction checks? -> deducted; throws if invalid
  forcedDice?: Dice[];
}
export interface BetInit { ref?: string; type: BetTypeId; amount: Cents; point?: PointNumber; parentRef?: string; working?: WorkingMode; }
export function createGame(opts?: CreateGameOptions): GameState;
export function nextDice(state: GameState): { dice: Dice; forced: boolean; state: GameState }; // forced queue first
export function applyAction(state: GameState, action: Action, opts?: { expectedLossFn?: (s: GameState) => number }): ApplyResult;
export function isWorking(bet: Bet, state: GameState): boolean;
export function equity(state: GameState): Cents;           // bankroll + sum(bet.amount)
export function replay(initial: GameState, actions: Action[]): GameState; // deterministic
export function getBetType(id: BetTypeId): BetTypeDef;
```
`applyAction` with `{type:'roll'}`: when `action.dice` is given, those dice are used (`forced: true`). Otherwise it calls `nextDice`. Initial bets are validated against the given phase, so a scene can start with a pass line, a point of 6 and odds.

**Action log**: the engine itself keeps no log. The container keeps `LogEntry { seq: number; action: Action; events: GameEvent[]; stateHash?: string }[]`, and `replay(createGame(opts), log.map(e=>e.action))` must reproduce the final state (tested).

`money.ts`: `formatMoney(cents, {sign?: boolean}) → "-$0.14" | "+$39" | "$1,250"`. It uses ASCII `-` and omits cents when they are zero, except when the value is under $1. `formatPct(fraction, digits=2) → "1.41%"`.

### 1.8 Rules (`rules.ts`)

```ts
export const DEFAULT_RULES: TableRules = {
  presetId: 'standard-vegas',
  tableMin: 500, tableMax: 500_000, propMin: 100,
  maxOdds:    { 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3 },
  maxLayOdds: { 4: 6, 5: 6, 6: 6, 8: 6, 9: 6, 10: 6 },   // win capped at 3/4/5x
  fieldPays: { 2: 2, 12: 2 },
  vig: { rate: 0.05, timing: 'on-win', rounding: 'floor-dollar-min-1' },
  payoutUnit: 1,
  placeBetsWorkOnComeOut: false, hardwaysWorkOnComeOut: false, comeOddsWorkOnComeOut: false,
  allowPutBets: false,
};
export const RULE_PRESETS: Record<RulePresetId, Partial<TableRules>> = {
  'standard-vegas': {},
  'field-3x-12': { fieldPays: { 2: 2, 12: 3 } },
  'odds-10x':  { maxOdds: all(10),  maxLayOdds: { 4: 20, 5: 15, 6: 12, 8: 12, 9: 15, 10: 20 } },   // lay win ≤ 10x flat
  'odds-100x': { maxOdds: all(100), maxLayOdds: { 4: 200, 5: 150, 6: 120, 8: 120, 9: 150, 10: 200 } },
};
export function resolveRules(r?: Partial<TableRules> | RulePresetId): TableRules;
```
The vig rounding default (`floor-dollar-min-1`) follows casino practice and has been sent to the user as a question. Switching it to `'exact-cents'` is a one-line change. Both give exactly 5% at $20 multiples, and the test numbers in §2.3 use $20 units.

---

## 2. EV / math module (`src/sim/math/`)

### 2.1 Files and API

```
src/sim/math/
  fraction.ts       // Fraction {n: bigint, d: bigint} normalized; add, sub, mul, div, neg, cmp, toNumber, fromInt, frac(n,d)
  dice.ts           // WAYS[2..12], pTotal(t), pHard(n)=1/36, pointWinProb(n) = W/(W+6)
  outcomes.ts       // betOutcomes(): full outcome distribution to resolution
  ev.ts             // betEV, betEdge, tableExpectedLossPerRoll, previewAction, suggestAlternative
  explain.ts        // explainBet(): rows for the "Why?" expander
  tiers.ts          // edgeTier()
  index.ts
```

```ts
export interface Outcome { label: string; ways: number; outOf: number; probability: Fraction; net: Fraction /* cents, incl. vig */ }
export interface BetCtx { phase: Phase; point: PointNumber | null; rules: TableRules; }

/** Distribution until resolution, given the bet's current situation (e.g. DP already on point 4). */
export function betOutcomes(bet: Pick<Bet,'type'|'amount'|'point'>, ctx: BetCtx): Outcome[];
export function betEV(bet: Pick<Bet,'type'|'amount'|'point'>, ctx: BetCtx): Fraction;     // cents
export interface EdgeInfo {
  perResolved: Fraction;    // −EV / amount, pushes count as decisions (DP = 3/220)
  perResolvedExPush: Fraction; // −EV / (amount · P(no push))  (DP = 27/1925 = 1.40%)
  expectedRolls: Fraction;  // E[rolls until resolution | always working]
  perRoll: Fraction;        // perResolved / expectedRolls
}
export function betEdge(type: BetTypeId, amount: Cents, ctx: BetCtx): EdgeInfo; // edge of a NEW bet in ctx
export function tableExpectedLossPerRoll(state: GameState): Fraction;            // cents
export function previewAction(state: GameState, action: Action): ActionPreview;
export function suggestAlternative(state: GameState, action: Extract<Action,{type:'place-bet'}>): Alternative | null;
export function explainBet(bet: Pick<Bet,'type'|'amount'|'point'>, ctx: BetCtx): Explanation;
export function edgeTier(edge: Fraction): EdgeTier;
```

**Implementation rule**: `betOutcomes` must take its payouts from the engine registry (`resolve()` on synthetic rolls), not from a second payout table. It does this by enumerating the 36 dice outcomes per "bet situation":
- One-roll bets: group the 36 outcomes by resolution.
- Single-state multi-roll bets (place, buy, lay, big, hard, odds, come/DC/line already on a point): condition on resolving rolls, so P(outcome) = ways(outcome) / ways(resolving).
- Line/come bets in a come-out situation: immediate outcomes plus, for each point N, P(N)·P(win | N), with the point sub-situation evaluated recursively by the rule above.

Non-working rolls are ignored. Edges are defined as if the bet works on every roll. Vig and payout rounding come in automatically because `resolve()` is used.

**Per-roll edge**: `expectedRolls` = 36/(ways resolving) for single-state bets, and 557/165 for line/come bets from come-out. `perRoll = perResolved / expectedRolls`. One-roll bets: perRoll = perResolved.

**`tableExpectedLossPerRoll(state)`** = Σ over bets that work on the next roll of `amount × perRoll(type, fresh situation)`. Line, come, DP and DC use the come-out amortized rate (7/1671, 9/2228) regardless of whether a point is set. This makes it a long-run "cost of keeping this layout up" that sums correctly over a session with repeating bets. That sum is what the auto-roll "expected" line and the Roll button hint show. Odds contribute 0.

### 2.2 Previews

```ts
export type EdgeTier = 'zero' | 'low' | 'medium' | 'high';   // ≤0, <2%, 2%–5%, >5%
export interface ActionPreview {
  action: Action;
  validation: Validation;              // from engine.validateAction
  evCents: Fraction;                   // expected profit of the action until resolution (− = cost)
  edge: EdgeInfo | null;               // for place-bet/set-amount; null for remove/working/roll
  tier: EdgeTier;
  perRollCents: Fraction;              // change in tableExpectedLossPerRoll caused by the action
  headline: string;                    // "Expected value: -$0.14 (house edge 1.41%)"
  detail: string;                      // "About -$0.04 per roll while it's working (0.42%/roll)"
  alternative: Alternative | null;
  explanation: Explanation;            // for "Why?"
}
export interface Alternative { action: Action; label: string; edge: EdgeInfo; savingsCents: Fraction; message: string; }
```

Semantics per action:
- `place-bet`: `evCents = betEV(newBet, ctx)`. For odds: 0, headline "Expected value: $0.00 (no house edge, the best bet in the casino)".
- `set-amount`: the EV of the delta, with the edge of the type.
- `remove-bet`: `evCents = −betEV(existing bet in current situation)`. Example: removing DP $10 with point 4: keeping it is worth +$3.33, so removing it is **-$3.33**: "Taking this down gives up +$3.33 of expected value." Tier is set to `high` (red) when evCents < 0.
- `set-working`: the EV change over the next roll only, `±amount × perRoll`.
- `roll`: `evCents = −tableExpectedLossPerRoll(state)`, headline "Expected cost of this roll: $0.42".

`suggestAlternative` uses a hand-curated, ordered candidate list. The first candidate that is legal in the current state and has an edge at least 0.25 percentage points lower is returned, with its amount adjusted by `suggestAmount` to a full-paying unit close to the original amount:

```ts
const ALTERNATIVES: Partial<Record<BetTypeId, BetTypeId[]>> = {
  'big-6': ['place-6'], 'big-8': ['place-8'],
  'place-4': ['buy-4', 'place-6'], 'place-10': ['buy-10', 'place-8'],
  'place-5': ['place-6', 'place-8'], 'place-9': ['place-8', 'place-6'],
  'field': ['place-6', 'pass-line', 'come'],
  'hard-4': ['buy-4', 'place-6'], 'hard-10': ['buy-10', 'place-8'],
  'hard-6': ['place-6'], 'hard-8': ['place-8'],
  'any-7': ['dont-pass', 'dont-come', 'lay-4'],
  'any-craps': ['pass-line', 'come', 'place-6'], 'c-e': ['pass-line', 'come', 'place-6'],
  'yo-11': ['pass-line', 'come', 'place-6'], 'aces-2': ['pass-line', 'come', 'place-6'],
  'boxcars-12': ['pass-line', 'come', 'place-6'], 'ace-deuce-3': ['pass-line', 'come', 'place-6'],
  'horn': ['pass-line', 'come', 'place-6'], 'world': ['pass-line', 'come', 'place-6'],
  'pass-line': [], 'come': [],
};
```
In addition, whenever the player has a line or come flat bet with odds room left and the chosen bet is not odds, the first suggestion is to **add odds** (0%). Message format: `"Place 6 instead: edge 1.52% (saves about $0.38 per bet on average)"`. Savings = (edgeChosen − edgeAlt) × amount.

**Tiers and colors.** Text labels always accompany color; color is never the only signal.

| Tier | Edge (perResolved) | Badge text | Color token |
|---|---|---|---|
| zero | ≤ 0 | "No house edge" | `--ev-zero` (teal #0f9d8a) |
| low | < 2% | "Low edge" | `--ev-low` (green #2e9d4f) |
| medium | 2%–5% | "Medium edge" | `--ev-medium` (amber #d99a1e) |
| high | > 5% or the action gives up EV | "High edge: bad bet" | `--ev-high` (red #d64545) |

Under Standard Vegas, the Field (5.56%) is **red**, and it becomes amber (2.78%) under `field-3x-12`. Place 5/9 (4.00%) are amber. Place 4/10 (6.67%) are red, with the suggestion to buy them instead.

**Explanation** (the "Why?" expander):
```ts
export interface Explanation {
  rows: Outcome[];                 // e.g. "6 before 7: 5 of 11 ways → +$7.00", "7 before 6: 6 of 11 → -$6.00"
  evFormula: string;               // "5/11 × $7.00 − 6/11 × $6.00 = -$0.09"
  note?: string;                   // "Odds pay true odds, so the house has no edge."
}
```
Probabilities are shown both as "5 of 11 ways" and as a percentage.

### 2.3 Target numbers (tests assert these exact fractions)

Per bet resolved (pushes count), Standard Vegas unless noted, amounts in full-pay units.

| Bet | Edge (exact) | % | Per roll (exact) | %/roll |
|---|---|---|---|---|
| pass-line / come | 7/495 | 1.414 | 7/1671 | 0.419 |
| dont-pass / dont-come | 3/220 | 1.364 (1.403 excl. push) | 9/2228 | 0.404 |
| any odds / lay odds | 0 | 0 | 0 | 0 |
| place-6 / place-8 | 1/66 | 1.515 | 1/216 | 0.463 |
| place-5 / place-9 | 1/25 | 4.000 | 1/90 | 1.111 |
| place-4 / place-10 | 1/15 | 6.667 | 1/60 | 1.667 |
| buy-4/10 ($20, vig on win) | 1/60 | 1.667 | 1/240 | 0.417 |
| lay-4/10 ($40, vig on win) | 1/60 | 1.667 | 1/240 | 0.417 |
| buy-4/10 (vig upfront) | 1/20 | 5.000 | 1/80 | 1.250 |
| lay-4/10 (vig upfront) | 1/40 | 2.500 | 1/160 | 0.625 |
| field (2x/2x, default) | 1/18 | 5.556 | 1/18 | 5.556 |
| field (2x/3x preset) | 1/36 | 2.778 | 1/36 | 2.778 |
| big-6 / big-8 | 1/11 | 9.091 | 1/36 | 2.778 |
| hard-4 / hard-10 (7:1) | 1/9 | 11.111 | 1/36 | 2.778 |
| hard-6 / hard-8 (9:1) | 1/11 | 9.091 | 1/36 | 2.778 |
| any-7 (4:1) | 1/6 | 16.667 | same | |
| any-craps (7:1) | 1/9 | 11.111 | same | |
| yo-11, ace-deuce-3 (15:1) | 1/9 | 11.111 | same | |
| aces-2, boxcars-12 (30:1) | 5/36 | 13.889 | same | |
| horn | 1/8 | 12.500 | same | |
| c-e | 1/9 | 11.111 | same | |
| world | 2/15 | 13.333 | same | |

Other exact facts:
- P(pass wins) = 244/495. E[rolls per line decision] = 557/165 ≈ 3.376. Come-out: natural 2/9, craps 1/9, point 2/3.
- P(point before 7): 4/10 → 1/3, 5/9 → 2/5, 6/8 → 5/11.
- EV per $1 of a flat bet already on a point (contract value): pass on 4/10 = −1/3, 5/9 = −1/5, 6/8 = −1/11. DP is the mirror (+1/3, +1/5, +1/11). This drives the `gives-up-ev` warning.
- Pass + full odds, edge on total expected action: 3-4-5x 7/1870 = 0.374%. 10x 0.184%. 100x 0.021%. DP + full lay: 6x 0.273%, 10x 0.124%, 100x 0.0135%.
- Preview acceptance examples: pass-line $10 → `"Expected value: -$0.14 (house edge 1.41%)"`. place-6 $12 → `-$0.18 (1.52%)`. field $5 → `-$0.28 (5.56%)`. any-7 $5 → `-$0.83 (16.67%)`. pass-odds $30 on point 4 → `$0.00 (no house edge…)`.

Golden payouts (profit credited, $):

| Bet & amount | Roll | Result |
|---|---|---|
| pass-line 10 | come-out 7 | +10 |
| place-6 12 | 6 | +14 |
| place-5 10 | 5 | +14 |
| place-4 10 | 4 | +18 |
| buy-4 20 | 4 | +40 − 1 vig = +39 |
| lay-4 40 | 7 | +20 − 1 vig = +19 |
| pass-odds 30 / 40 / 50 on 4 / 5 / 6 | point | +60 / +60 / +60 |
| dont-pass-odds 60 on 4 / 5 / 6 | 7 | +30 / +40 / +50 |
| field 5 | 2 / 12 / 3 | +10 / +10 (+15 under field-3x-12) / +5 |
| big-6 6 | 6 | +6 |
| hard-6 5 / hard-4 5 | 3+3 / 2+2 | +45 / +35 |
| any-7 5 / any-craps 5 / yo-11 5 / aces-2 1 | hit | +20 / +35 / +75 / +30 |
| horn 4 | 2 / 3 | +27 / +12 |
| c-e 2 | 2 / 11 | +6 / +14 |
| world 5 | 2 / 3 / 7 | +26 / +11 / push |
| place-6 5 (short pay) | 6 | +5.83 (payoutUnit 1); +5 with payoutUnit 100 |

### 2.4 Strategy lenses support

`strategyMetrics(spec, rules)` (in `src/sim/strategy/metrics.ts`, §2.5) reports, per preset: the edge on total action, the expected loss per roll in $, and **rolls per $1 of expected loss** (the "fun per dollar" lens, = 1 / expected loss per roll). Reference values for tests and lessons:

| Layout | Expected loss / roll | Rolls per $1 |
|---|---|---|
| Pass $10 (odds add 0) | $0.0419 | 23.9 |
| Don't pass $10 | $0.0404 | 24.8 |
| Place 6 + 8, $6 each | $0.0556 | 18.0 |
| Iron Cross ($5 field 2x/2x, $5 place 5, $6 place 6, $6 place 8), point-phase roll | $0.3889 (7/18) | 2.57 |
| Any 7 $5 every roll | $0.8333 | 1.2 |

### 2.5 Strategies and auto-roll (`src/sim/strategy/`)

```
src/sim/strategy/
  types.ts      // StrategySpec, Strategy, SessionConfig, SessionResult, ManyResult
  presets.ts    // STRATEGIES registry
  simulate.ts   // simulateSession, simulateMany (pure, chunkable)
  metrics.ts    // strategyMetrics (analytic per-roll loss from ev module)
```

```ts
export type StrategyLens = 'lowest-edge' | 'practical' | 'fun';
export type StrategyId =
  | 'pass-max-odds' | 'dont-pass-max-lay' | 'pass-2x-odds' | 'three-point-molly'
  | 'place-6-8' | 'iron-cross' | 'across' | 'field-every-roll' | 'any-7-every-roll' | 'hardways-all';
export interface StrategySpec { id: StrategyId; unit: Cents; oddsMultiple?: number /* default: table max */; }
export interface Strategy {
  id: StrategyId; name: string; lens: StrategyLens; description: string;
  /** Actions to take before the next roll so the layout matches the strategy. Must return only legal actions. */
  decide(state: GameState, spec: StrategySpec): Action[];
}
```
Preset semantics (unit = base flat bet):
- `pass-max-odds` (lowest-edge): pass line each come-out, full odds on the point.
- `dont-pass-max-lay` (lowest-edge): DP each come-out, full lay odds.
- `pass-2x-odds` (practical): pass + 2x odds.
- `three-point-molly` (practical/fun): pass + up to 2 come bets working, each with `oddsMultiple` (default 2x).
- `place-6-8` (practical): during the point phase only, place 6 and 8 at `ceil(unit/6)*6` each.
- `iron-cross` (fun): during the point phase only, field `unit`, place 5 `unit`, place 6/8 `ceil(unit·1.2/6)*6`. At a $5 unit: $5 + $5 + $6 + $6 = $22.
- `across` (fun): place all six numbers in proper units during the point phase.
- `field-every-roll`, `any-7-every-roll`, `hardways-all` (bad-bet demonstrations).

```ts
export interface SessionConfig {
  strategy: StrategySpec; rolls: number; seed: number;
  bankroll: Cents; rules?: Partial<TableRules> | RulePresetId;
  stopAtBust?: boolean /* default true: stop when the strategy can't place its next bets */;
  stopWin?: Cents; stopLoss?: Cents;
}
export interface SessionResult {
  rollsPlayed: number;
  equity: Int32Array;          // equity (bankroll + chips on table) after each roll; [0] = start
  expected: Float64Array;      // start − cumulative stats.expectedLoss
  finalEquity: Cents; totalWagered: Cents; expectedLoss: number; actualLoss: Cents;
  maxDrawdown: Cents; peakEquity: Cents; bustedAtRoll: number | null;
  pointsMade: number; sevenOuts: number; longestHand: number;
}
export interface ManyResult {
  sessions: number;
  p10: Float64Array; p50: Float64Array; p90: Float64Array;  // equity percentiles per roll index
  expected: Float64Array; bustRate: number; meanFinal: number; probAhead: number;
}
export function simulateSession(cfg: SessionConfig): SessionResult;
/** Chunked: yields to the UI every `sliceMs` (default 16) via the injected scheduler; progress 0..1. */
export function simulateMany(cfg: SessionConfig, sessions: number, opts?: { onProgress?(p: number): void; signal?: AbortSignal; schedule?(fn: () => void): void }): Promise<ManyResult>;
```
Seeds for `simulateMany` sessions come from `seed + i`. No Web Worker is used (to keep the single-file build simple); chunking keeps the UI responsive. Budget: 100 sessions × 1000 rolls must finish in under 2s on a mid-range phone, so the engine avoids deep clones and uses copy-on-write arrays. A benchmark test enforces under 1s for 100k rolls in Node.

---

## 3. Rendering (`src/sim/ui/`)

### 3.1 Approach

- **SVG** for the felt and bet regions: it scales crisply, each region is a hit target, and it is easy to animate with CSS transforms. **HTML** for controls (chip rack, roll button, sheet, toasts, history, bankroll, auto-roll panel) for text layout and accessibility.
- Layouts are **data**: `layouts/portrait.ts`, `layouts/landscape.ts`, `layouts/center.ts` export `TableLayout`:
```ts
export interface Rect { x: number; y: number; w: number; h: number; }
export type RegionId =
  | 'pass' | 'dont-pass' | 'come' | 'dont-come' | 'field' | 'big-6' | 'big-8'
  | `box-${PointNumber}`
  | 'any-7' | 'any-craps' | 'yo-11' | 'aces-2' | 'boxcars-12' | 'ace-deuce-3' | 'horn' | 'c-e' | 'world'
  | `hard-${4 | 6 | 8 | 10}`;
export interface RegionDef {
  id: RegionId; rect: Rect; label: string; sublabel?: string;   // "PASS LINE", "Pays 7 to 6"
  betTypes: BetTypeId[];          // types reachable from this region (segmented control in sheet)
  chipSpots: Partial<Record<ChipSpotKey, { x: number; y: number }>>; // where each stack is drawn
  shape?: 'rect' | 'pass-arc';
}
export type ChipSpotKey = 'main' | 'odds' | 'come-point' | 'dc-point' | 'lay' | 'buy';
export interface TableLayout { viewBox: { w: number; h: number }; regions: RegionDef[]; puck: Record<PointNumber | 'off', { x: number; y: number }>; minTapUnits: number; }
```
- **Fit**: the SVG is `width:100%` with `preserveAspectRatio="xMidYMid meet"` inside a container sized by CSS. Orientation is chosen with `matchMedia('(orientation: portrait)')`, and a scene can pin it.
- Tap target rule: each region must be at least **44 CSS px** on its short side at the reference viewports (portrait 390×844, landscape 844×390). `minTapUnits` encodes this, and both a unit test and an e2e test check it.

### 3.2 Portrait layout (viewBox 0 0 900 1255; at 390px wide, scale 0.433, so 44px = 102 units)

| Region | Rect (x, y, w, h) | betTypes |
|---|---|---|
| box-4 / box-5 / box-6 | (20,20,280,250) / (310,20,280,250) / (600,20,280,250) | place-N, buy-N, lay-N (4/10), come-odds, dont-come-odds |
| box-8 / box-9 / box-10 | (20,280,280,250) / (310,280,280,250) / (600,280,280,250) | as above |
| come | (20,545,860,125) | come |
| field | (20,685,860,150) | field |
| dont-come | (20,850,420,115) | dont-come |
| big-6 / big-8 | (455,850,205,115) / (675,850,205,115) | big-6 / big-8 |
| dont-pass | (20,980,860,110) | dont-pass, dont-pass-odds |
| pass | (20,1105,860,135) | pass-line, pass-odds |

Inside each number box: a top band (y+0..60) holds the DC and lay chip spots, the center holds the large numeral (5 and 9 spelled "FIVE"/"NINE" as on real tables) and the place/buy chip spot, and a bottom band (y+190..250) holds the come-point chip spot with odds offset (+40, −20). The puck (r = 42) sits at the box's top-right `(x+w−50, y+50)` when ON. When OFF it sits at the top-left of the come region (black disc, "OFF").

Total stack at 390×844: app header 48px, status bar 56px (bankroll, point, last roll, history strip), table about 543px, control bar 120px (chip rack + Center tab + Roll). That is 767px, which fits.

### 3.3 Landscape layout (viewBox 0 0 1500 800; table area at 844×390 = 664×354 px after the 180px right rail, scale 0.443, so 44px = 99 units)

| Region | Rect |
|---|---|
| dont-come | (20,20,190,230) |
| box-4…box-10 | x = 220, 430, 640, 850, 1060, 1270; y 20; w 205; h 230 |
| big-6 / big-8 | (20,260,190,140) / (20,410,190,140) |
| come | (220,260,1255,140) |
| field | (220,410,1255,140) |
| dont-pass | (20,560,1455,105) |
| pass | (20,675,1455,110) |

The controls move to a right rail (180px): bankroll, chip rack (vertical), Center toggle, Roll, Auto-roll.

### 3.4 Center (props) panel (viewBox 0 0 900 760)

any-7 (20,20,860,110). hard-6 (20,145,425,120), hard-10 (455,145,425,120), hard-8 (20,275,425,120), hard-4 (455,275,425,120). aces-2 / ace-deuce-3 / yo-11 / boxcars-12 at x = 20, 235, 450, 665, y 410, w 205, h 120. any-craps (20,545,860,100). horn (20,655,280,95), c-e (310,655,280,95), world (600,655,280,95).

On phones it is shown by the **Center** tab, which swaps the felt for this panel (same chip rack and Roll button; a "Table" tab switches back). On viewports ≥ 1000×600 CSS px it renders beside the main table. Lesson scenes can open it (`ui.view: 'center'`). Hardway dice are drawn as small SVG dice faces inside each cell.

### 3.5 Visual style

Felt `#0b6b3a` with a subtle radial gradient. White 3px rounded borders and white or yellow text in a condensed bold font (system stack: `"Roboto Condensed", "Arial Narrow", system-ui`; no web font needed for offline). Center panel accents are red and yellow. Chip colors by denomination: $1 white, $5 red, $25 green, $100 black, $500 purple, each with dashed edge spots. A stack shows up to 5 chips (offset −6 units each) plus an amount badge. All colors are CSS custom properties in `src/sim/ui/sim.css`, with light and dark tokens for non-felt chrome.

`highlightedBets` (scenes) adds a pulsing yellow outline (`animation` off under reduced motion; a static 4px outline is used instead). Disallowed bet regions (scene `allowedBets`) are dimmed to 40% opacity and still announce "not available in this lesson".

### 3.6 Interaction flow

1. **Chip rack**: denominations from `ui.chips` (default `[100, 500, 2500, 10000, 50000]`). The selected chip shows a raised ring. Chips the player cannot afford are disabled.
2. **Tap a region** (or press Enter/Space on the focused region). This opens the **Bet sheet**, prefilled with `defaultBetForRegion(region, state)`: the flat bet if none exists. If the player already has a pass bet on a point, it opens on pass-odds, prefilled to the max odds. On number boxes with the player's come bet, it opens on come-odds.
3. **Bet sheet** (a bottom sheet in portrait, a right-side panel in landscape; focus-trapped, `role="dialog"`):
   - Title plus a segmented control over `region.betTypes` (only legal or scene-allowed types are enabled). Switching type updates the EV live, which works well for comparing place 4 and buy 4.
   - Amount stepper: − / amount / + (one selected chip per step), plus quick buttons: `Min`, `×2`, `Max odds` (odds only), `Fix to $6 units` (shown with the `short-pay` warning).
   - **EV block**: tier badge, headline ("Expected value: -$0.14 (house edge 1.41%)"), detail line (per roll). For high tier, a red banner "Bad bet: the house keeps 9.09% on average".
   - **Better alternative** card (when `suggestAlternative` returns one) with a "Use this" button that swaps the pending action.
   - **"Why?"** expander (collapsed by default; scenes can force it open): the outcome table from `explainBet` and the EV formula.
   - Validation message (if illegal) and warnings.
   - **Confirm** (disabled when invalid) and **Cancel**.
   - When `showEV` is false (some lessons), the EV block, alternative and "Why?" are hidden.
4. Tapping an existing chip stack opens the same sheet in **manage mode**: change the amount, Remove (with the EV of removal), and a Working ON/OFF toggle where applicable.
5. **Roll** button (≥ 56px, bottom right): the label "Roll" and, beneath it, "Expected cost: $0.42". It is disabled while a sheet is open or the scene blocks rolling. A long-press opens "Set dice" in sandbox dev mode (`?dev=1`) for teachers.
6. Sandbox extras in an overflow menu: **Rebet** (re-place last roll's one-roll bets and field), **Rules preset** selector, **Speed** (`normal`/`fast`/`instant`), **Skip EV preview** (expert mode: confirm-on-tap, off by default), **Reset bankroll**, **Auto-roll**.

### 3.7 Animation and pacing

The engine resolves instantly. The UI plays an **animation queue** built from the events:

| Phase | normal | fast | instant / reduced motion |
|---|---|---|---|
| Dice tumble (two HTML dice with CSS 2D tumble: translate + rotate keyframes, 3 random intermediate faces) | 1000ms | 300ms | 0ms, faces fade in over 150ms |
| Puck move | 300ms | 150ms | 0 |
| Losses: chips slide to the dealer (top) and fade | 400ms | 150ms | fade only |
| Wins: payout stack slides from the dealer to the bet; a `comes-down` stack then slides to the bankroll | 600ms | 200ms | 0 + highlight flash |
| Toast | stays 2.5s | 1.5s | 2.5s (not animated) |

- **Tap anywhere** (or press Esc/Space) during the queue skips to the end state. The engine state is already final, so skipping only flushes the visuals.
- `prefers-reduced-motion: reduce` sets the default speed to `instant` (the user can still choose otherwise). All keyframes sit inside `@media (prefers-reduced-motion: no-preference)`.
- Transforms only (`transform`, `opacity`), no layout properties. Chips animate as `<g>` elements with `transform` transitions.
- Toasts (`role="status"`, `aria-live="polite"`) summarize the roll: `"6, the hard way. Point made! Pass line wins $10, odds win $60. Net +$70."` They are built by `describeRoll(events): string` in `ui/text.ts`, which is unit-tested.
- Sound: none in v1 by default (a question is pending with the user; if accepted, an optional toggle that is off by default).

### 3.8 Status bar and history

- **Bankroll display**: `Bankroll $430 · On table $70 · Session +$20`. The session figure is equity minus start, colored with a sign and text.
- **Point indicator**: "Point: 6" or "Come-out roll".
- **History strip**: the last 20 rolls as small pills (two die faces + total), horizontally scrollable, newest first. 7s on the point phase are red ("seven-out"), point made is green, naturals are outlined. The full history is a tap away (a sheet with a per-shooter table).

### 3.9 Auto-roll panel

Inputs: strategy (presets, grouped by lens), unit (chip), rolls (10 / 100 / 1000 / custom up to 10,000), sessions (1 or 100), rules preset, seed (shown, editable, "re-roll seed"). Output:
- **Chart** (`ui/BankrollChart.tsx`, hand-rolled SVG, no chart library). One session: the equity line and the dashed "expected" line (start − cumulative expected loss). Many sessions: a p10–p90 band, the median line and the expected line. Axes: rolls (x) and $ (y), with a zero-profit reference line. The chart has an accessible name and a hidden data-summary table.
- **Summary**: final equity, actual result vs expected loss, total wagered, edge on action, max drawdown, bust roll/bust rate, P(ahead), rolls per $1 of expected loss.
- With 1 session and ≤ 100 rolls, the "Watch" option plays the rolls on the table at fast speed. Otherwise only the computed result is shown.

### 3.10 Accessibility

- Each region is a `<g role="button" tabindex="0" aria-label="Place 6. Pays 7 to 6. Your bet: $12, working.">`. Arrow keys move focus between regions in layout order; Enter/Space opens the sheet.
- Chip stacks are announced inside the region label (not separately focusable).
- Tap targets are ≥ 44×44 CSS px (verified). Roll is ≥ 56px.
- Never rely on color alone: tier badges have text, and history pills have text totals.
- The sheet is a focus-trapped `role="dialog"` with `aria-labelledby`; Esc cancels and focus returns to the region.
- Roll results are announced via `aria-live`. Dice expose `aria-label="Rolled 3 and 3, total 6"`.
- Contrast: text on felt is ≥ 4.5:1 (white on #0b6b3a is 6.9:1).

### 3.11 UI files

```
src/sim/ui/
  Simulator.tsx          // container: scene runner glue, state, animation queue, settings (Chunk D)
  Table.tsx              // renders TableLayout + chips + puck; emits onRegionTap(regionId)/onStackTap(betId) (Chunk C)
  CenterPanel.tsx        // props layout (C)
  layouts/{portrait,landscape,center}.ts (C)
  ChipStack.tsx, Puck.tsx, Dice.tsx (C)
  BetSheet.tsx           // EV preview sheet (C) — props: preview: ActionPreview, onChange, onConfirm, onCancel
  ChipRack.tsx, RollButton.tsx, StatusBar.tsx, HistoryStrip.tsx, Toasts.tsx (C)
  AutoRollPanel.tsx, BankrollChart.tsx (E)
  StepPanel.tsx          // lesson step text, hint, "Show the math" expander, Next button (D)
  animation.ts           // buildAnimationQueue(events, speed) -> Timeline (C)
  text.ts                // describeRoll, regionAriaLabel (C)
  sim.css (C)
```
Presentational components (C) take plain props and callbacks. Only `Simulator.tsx` (D) owns state.

---

## 4. Scenes and embedding (`src/sim/scene/`)

### 4.1 `SceneConfig` (JSON-serializable; money in cents)

```ts
export interface SceneConfig {
  id: string;                         // 'lesson-03-pass-line'
  version: 1;
  title?: string;
  rules?: Partial<TableRules> | RulePresetId;   // default 'standard-vegas'
  bankroll?: Cents;                   // default 50_000
  phase?: Phase; point?: PointNumber | null;
  bets?: BetInit[];                   // initial layout (validated)
  seed?: number;                      // default random, except in guided scenes (default 1)
  forcedDice?: Dice[];                // global queue
  onForcedExhausted?: 'random' | 'block';   // default 'random'
  allowedBets?: BetTypeId[] | 'all';  // default 'all'
  allowedActions?: ActionType[];      // default all
  highlightedBets?: BetTypeId[];
  showEV?: boolean;                   // default true
  evDetail?: 'basic' | 'full';        // 'basic' = headline only; 'full' adds per-roll, alternative, Why?
  whyOpen?: boolean;                  // open the "Why?" expander by default
  ui?: {
    orientation?: 'auto' | 'portrait' | 'landscape';
    view?: 'table' | 'center';
    chips?: Cents[]; defaultChip?: Cents;
    showChipRack?: boolean; showHistory?: boolean; showBankroll?: boolean; showRoll?: boolean;
    showSettings?: boolean;           // sandbox overflow menu (default false in scenes)
    speed?: 'normal' | 'fast' | 'instant';
    compact?: boolean;                // embedded in lesson flow: smaller status bar, no header
  };
  autoRoll?: {
    enabled: boolean;
    strategies?: StrategyId[];        // limit picker
    defaultStrategy?: StrategySpec;
    rollOptions?: number[];           // default [10, 100, 1000]
    sessions?: number[];              // default [1, 100]
    compareMode?: boolean;            // run 2-3 strategies side by side (lens comparison lessons)
  };
  steps?: SceneStep[];                // guided script; absent = free play with restrictions
}

export interface SceneStep {
  id: string;
  text: string;                       // short, friendly; supports **bold** and _italic_ only
  hint?: string;                      // shown after a rejected action or 20s idle
  math?: string;                      // body of the "Show the math" expander (markdown-lite + inline fractions)
  setup?: { bets?: BetInit[]; bankroll?: Cents; phase?: Phase; point?: PointNumber | null; replaceBets?: boolean };
  forcedDice?: Dice[];                // REPLACES the queue at step start
  allowedBets?: BetTypeId[] | 'all';  // overrides scene-level while active
  allowedActions?: ActionType[];
  highlightedBets?: BetTypeId[];
  expect?: ActionMatcher[];           // if set, only matching actions are accepted (others rejected with hint)
  completeWhen: Condition;
  advance?: 'auto' | 'button';        // default 'auto' (button = "Next" after completion)
  showEV?: boolean;
}

export interface ActionMatcher {
  type: ActionType;
  betType?: BetTypeId | BetTypeId[];
  amount?: Cents; minAmount?: Cents; maxAmount?: Cents;
  oddsMax?: boolean;                  // amount must equal max allowed odds
}

export type Condition =
  | { all: Condition[] } | { any: Condition[] }
  | { action: ActionMatcher; count?: number }          // confirmed actions since step start
  | { event: GameEvent['type']; betType?: BetTypeId; count?: number }
  | { rolls: number }                                  // rolls since step start
  | { phase: Phase }
  | { point: PointNumber | null }
  | { betOnTable: { type: BetTypeId; minAmount?: Cents } }
  | { bankrollAtLeast: Cents } | { bankrollAtMost: Cents }
  | { previewed: BetTypeId }                           // user opened the sheet for this bet
  | { autoRollCompleted: { minRolls?: number } }
  | { acknowledged: true };                            // user tapped "Next"
```

Runner (`scene/runner.ts`, pure):
```ts
export interface SceneRuntime { stepIndex: number; stepStartRoll: number; counters: Record<string, number>; done: boolean; }
export function initScene(scene: SceneConfig): { game: GameState; runtime: SceneRuntime };
export function gateAction(scene: SceneConfig, rt: SceneRuntime, game: GameState, action: Action): Validation; // scene restrictions on top of engine
export function observe(scene: SceneConfig, rt: SceneRuntime, game: GameState, input: SceneInput): { runtime: SceneRuntime; game: GameState; completedStep?: string; sceneCompleted?: boolean };
export type SceneInput =
  | { kind: 'action'; action: Action; events: GameEvent[] }
  | { kind: 'previewed'; betType: BetTypeId } | { kind: 'acknowledged' } | { kind: 'auto-roll-completed'; rolls: number };
export function validateScene(json: unknown): { ok: true; scene: SceneConfig } | { ok: false; errors: string[] };
```
Rules: when a step starts, apply `setup`, replace `forcedDice` if given, and reset counters. Restrictions are resolved step → scene → defaults. `gateAction` returns `not-allowed-by-scene` with the step hint as the message. With `onForcedExhausted: 'block'` and an empty queue, Roll is disabled ("The lesson is over: try the sandbox!").

### 4.2 Embedding API

```tsx
export interface SimulatorProps {
  scene?: SceneConfig;                       // absent = sandbox
  mode?: 'sandbox' | 'embedded';             // default: scene ? 'embedded' : 'sandbox'
  persistKey?: string;                       // sandbox only; localStorage `crappy:sim:${key}:v1` (try/catch, versioned)
  initialSettings?: Partial<SimSettings>;
  onEvent?: (e: SimulatorEvent) => void;
}
export interface SimSettings { speed: 'normal' | 'fast' | 'instant'; skipPreview: boolean; rulesPreset: RulePresetId; sound: boolean; }
export type SimulatorEvent =
  | { type: 'ready'; state: GameState }
  | { type: 'previewed'; preview: ActionPreview }
  | { type: 'action-confirmed'; action: Action; events: GameEvent[]; state: GameState }
  | { type: 'action-rejected'; action: Action; error: Extract<Validation, { ok: false }> }
  | { type: 'rolled'; roll: RollRecord; events: GameEvent[]; state: GameState }
  | { type: 'step-started'; stepId: string; index: number }
  | { type: 'step-completed'; stepId: string; index: number }
  | { type: 'scene-completed'; sceneId: string; state: GameState }
  | { type: 'auto-roll-completed'; result: SessionResult | ManyResult };

export function Simulator(props: SimulatorProps): JSX.Element;
/** Framework-agnostic mount for lesson content renderers. */
export function mountSimulator(el: HTMLElement, props: SimulatorProps): {
  unmount(): void; getState(): GameState; dispatch(action: Action): ApplyResult; reset(scene?: SceneConfig): void;
};
```
Lessons refer to scenes either inline or by id from `src/content/scenes/*.json` (the curriculum track owns the content and the architecture track owns the loading). Every bundled scene is checked by `validateScene` in a unit test.

Sandbox URL params (supported in production; the "practice tool" features): `?seed=42`, `?dice=3-4,6-6` (forced queue), `?rules=odds-10x`, `?speed=instant`, `?dev=1` (Set dice). These also drive the e2e tests deterministically.

### 4.3 Example scene

```json
{
  "id": "lesson-odds-intro", "version": 1, "title": "Taking odds",
  "bankroll": 30000, "phase": "point", "point": 6,
  "bets": [{ "ref": "p", "type": "pass-line", "amount": 1000 }],
  "allowedBets": ["pass-odds"], "highlightedBets": ["pass-odds"], "evDetail": "full",
  "steps": [
    { "id": "add-odds", "text": "The point is **6**. Tap the pass line to add odds behind your bet.",
      "math": "Odds on 6 pay 6 to 5. The 6 comes before a 7 in 5 of 11 cases: 5/11 × 6 − 6/11 × 5 = 0.",
      "expect": [{ "type": "place-bet", "betType": "pass-odds" }],
      "completeWhen": { "action": { "type": "place-bet", "betType": "pass-odds", "minAmount": 1000 } } },
    { "id": "roll", "text": "Now roll. (We've loaded the dice so the 6 hits.)", "forcedDice": [[3, 3]],
      "allowedActions": ["roll"], "completeWhen": { "event": "point-made" }, "advance": "button" }
  ]
}
```

---

## 5. Test plan

Tooling: Vitest (Node env for engine/math/strategy/scene, `happy-dom` for UI), `@testing-library/preact`, Playwright using the preinstalled Chromium (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `channel` unset, `executablePath` resolved from the installed `chromium-1194`). Coverage target: engine + math ≥ 95% lines.

### 5.1 Engine unit tests (`src/sim/engine/*.test.ts`)
- **Resolution matrix**: for every bet type × every situation (come-out; each point 4-10; for come/DC: in the box and on each number; working on and off) × all **36 ordered dice outcomes**, compare `def.resolve` to an **independent oracle** written in the test from the plain-English rules (a separate `oracle.ts` in the test folder that does not import `bets.ts`). That is about 33 types × ~8 situations × 36 outcomes × 2, around 19k assertions in table-driven `it.each`.
- Golden payouts (§2.3 table), including vig rounding variants and `payoutUnit` 100.
- Validation: one test per `ValidationCode`, and warnings (`short-pay` suggested amounts, `vig-rounding`, `gives-up-ev`, `off-on-come-out`). Odds limits per preset (3-4-5x, 10x, 100x, lay 6x/20x/…).
- Flow scenarios (scripted dice): natural, craps, point made, seven-out with come bets and come-odds returned on the come-out 7, a come bet travelling while an older come bet on the same number wins, DP 12 push, a pass line that stays up after a win, field/props coming down, money conservation (`equity` + cumulative losses − wins is invariant for every roll: Σ(net) equals the equity delta).
- RNG: a golden sequence for seed 42 (frozen after the first implementation), a chi-square check over 360k dice (p > 0.001, fixed seed), forced queue before RNG, rejection sampling bounds.
- `replay` determinism; immutability (frozen input states with `Object.freeze` deep in tests).

### 5.2 Math tests (`src/sim/math/*.test.ts`)
- `betEdge` equals the exact fractions of §2.3 for every bet, both field presets and both vig timings. The pass/DP contract values at each point. Combined line + odds edges for 3-4-5x/10x/100x.
- **Markov cross-check**: a generic evaluator in the test drives the engine's own `resolveRoll` over all 36 outcomes until absorption (rational arithmetic, solving the one-state self-loop analytically) and must equal `betEV` for every bet and situation. This proves that preview and play agree.
- Preview strings: the §2.3 acceptance examples. Tier boundaries. `suggestAlternative` for big-6 → place-6, place-4 → buy-4, any-7 → don't pass, field → place-6; odds-first when room exists; null for pass-odds.
- **Monte-Carlo** (`*.mc.test.ts`, included in CI, fixed seeds): for each bet type, simulate N resolved bets (N = 200k, or 1M under `MC_FULL=1`). Assert |mean net/amount − exact EV| < 4σ/√N, with σ computed exactly from `betOutcomes`. Also the strategy per-roll expected loss (pass, Iron Cross) against simulated loss over 200k rolls.

### 5.3 Strategy and scene tests
- Every preset `decide` returns only actions that `validateAction` accepts, over 10k random rolls. Iron Cross metrics: 7/18 $/point roll at a $5 unit. Session results are deterministic per seed. Bust handling. Benchmark: 100k rolls < 1s (Node).
- `validateScene` on fixtures and on all `src/content/scenes/*.json`. The runner: step progression for each `Condition` kind, `expect` rejection, `forcedDice` replacement, the `block` exhaustion behavior.

### 5.4 Component tests (`src/sim/ui/*.test.tsx`)
- Tapping the pass region opens the sheet with "house edge 1.41%"; Confirm dispatches `place-bet`; Cancel does nothing.
- An illegal action (come during come-out) shows its message and disables Confirm. An `allowedBets` restriction dims the region.
- The segmented control (place-4 ↔ buy-4) updates the EV. The alternative card's "Use this" swaps the action. "Why?" shows outcome rows.
- `describeRoll` text for representative event sets. `regionAriaLabel` includes the bet amount and working state.
- Animation: speed `instant` produces an empty timeline; reduced motion (mock `matchMedia`) defaults to instant; tap-to-skip flushes the queue.
- Layout data: every region ≥ `minTapUnits` on its short side, and no overlapping region rects.
- `BankrollChart` renders the paths and an accessible summary for 1 and 100 sessions.

### 5.5 E2E (`e2e/simulator.spec.ts`, Playwright)
Projects: `phone-portrait` (390×844, `isMobile`, `hasTouch`) and `phone-landscape` (844×390). The tests run against `vite preview` of the production build and against the **single-file build** opened by `file://`.
1. Open the sandbox with `?seed=7&dice=3-4,3-3,4-2&speed=instant`.
2. Select the $5 chip, tap Pass, see "1.41%", Confirm. Roll (7): the toast says "Pass line wins $5" and the bankroll is +$5.
3. Roll (6, point established, puck ON on 6). Tap Pass: the sheet opens on odds; tap Max odds, Confirm. Roll (6): point made.
4. Tap Big 6: red "Bad bet" plus the "Place 6 instead" alternative is visible.
5. Assert every `[data-region]` bounding box is ≥ 44×44 in both orientations, and the page has no horizontal scroll.
6. Embedded scene smoke: load a lesson page with the example scene and complete both steps.
7. Auto-roll: pass-max-odds, 100 rolls, 1 session; the chart and summary render.
An axe-core scan (`@axe-core/playwright`) of the sandbox has no serious violations.

---

## 6. Implementation chunks (parallelizable)

`src/sim/engine/types.ts` and the type blocks in this doc are the **contract**. Chunk A writes `types.ts` verbatim from §1.2 in its **first commit**, and the others code against it (copying it locally is acceptable if A hasn't landed yet; A's version wins). Contract changes go through the doc owner. Every chunk adds only its own files; the shared `package.json` dependencies listed below are added by the architecture/scaffold owner.

| Chunk | Owns (files) | Depends on | Deliverables |
|---|---|---|---|
| **A: Engine** | `src/sim/engine/**` (types, rules, rng, bets, validate, resolve, game, money, index) + tests incl. `src/sim/engine/__tests__/oracle.ts` | none | §1 complete; §5.1 tests green. Exposes `expectedLossFn` injection. |
| **B: Math / EV** | `src/sim/math/**` + tests (exact, Markov cross-check, Monte-Carlo) | A's types (contract) + A's `resolve`/`validateAction` for the Markov/MC tests | §2.1–2.3: `betOutcomes`, `betEdge`, `previewAction`, `suggestAlternative`, `explainBet`, `edgeTier`, `tableExpectedLossPerRoll`. |
| **C: Table UI** | `src/sim/ui/{Table,CenterPanel,ChipStack,Puck,Dice,BetSheet,ChipRack,RollButton,StatusBar,HistoryStrip,Toasts}.tsx`, `ui/layouts/**`, `ui/animation.ts`, `ui/text.ts`, `ui/sim.css` + component tests + a dev-only `src/sim/ui/demo.tsx` gallery with mocked props | Contract types; `ActionPreview` type from §2.2 (mock data until B lands) | §3.1–3.8, 3.10; presentational, no app state. |
| **D: Container, scenes, e2e** | `src/sim/ui/Simulator.tsx`, `ui/StepPanel.tsx`, `ui/settings.ts`, `ui/persist.ts`, `src/sim/scene/**`, `src/sim/index.ts` (public API: `Simulator`, `mountSimulator`, types), `e2e/simulator.spec.ts`, `playwright.config.ts` (if not owned by architecture), scene fixtures `src/sim/scene/fixtures/*.json` | A, B, C (integrates last; starts with runner + validateScene, which only need the contract) | §4 complete; URL params; animation queue wiring; §5.3 scene tests, §5.5 e2e. |
| **E: Strategies & auto-roll** | `src/sim/strategy/**`, `src/sim/ui/{AutoRollPanel,BankrollChart}.tsx` + tests | A (engine), B (`tableExpectedLossPerRoll`) | §2.4–2.5, §3.9; strategy tests and benchmark. |

Suggested order: A and the pure parts of B/C/E start together, then D integrates. Dev dependencies needed: `vitest`, `happy-dom`, `@testing-library/preact`, `@playwright/test`, `@axe-core/playwright`. Runtime: `preact` only. No chart, animation or math libraries.

---

## 7. Open questions (sent to the user; defaults in effect)

1. Vig rounding: casino practice (floor to $1, minimum $1, **default**) vs exact 5%.
2. Sound: optional and off by default (**default**) vs none vs on.
3. Winning bets: real-table stays-up behavior plus Rebet (**default**) vs everything comes down.
4. Portrait props: a Center tab (**default**) vs a tall scrollable table vs pinch zoom.
