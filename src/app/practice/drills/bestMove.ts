// Drill: "Best move". A table situation and three or four candidate actions; the learner picks the
// one with the best expected value per dollar. Every option is priced by the simulator's own
// previewAction (the same numbers and headlines the bet sheet shows), never by a table.
import { BET_TYPES, createGame, formatMoney, POINT_NUMBERS } from '../../../sim/engine';
import type { Action, BetTypeId, Cents, GameState, PointNumber } from '../../../sim/engine';
import type { BetInit } from '../../../sim/engine';
import { previewAction } from '../../../sim/math';
import { toNumber } from '../../../sim/math';
import { defineDrill, type Choice, type DrillItem, type Visual } from '../types';
import type { DrillRng } from '../rng';

export interface MoveOption {
  id: string;
  label: string;
  action: Action;
  /** expected value of the action, cents */
  evCents: number;
  /** the money the decision puts (or keeps) at risk, cents */
  stake: Cents;
  /** evCents / stake: the figure the options are ranked by */
  evPerDollar: number;
  /** the bet sheet's headline for this action */
  headline: string;
}

export interface BestMoveItem extends DrillItem {
  /** the situation, as the engine sees it */
  state: GameState;
  options: MoveOption[];
  /** id of the option with the highest EV per dollar */
  best: string;
  situation: string;
}

/** Options closer than this (EV per dollar, as a fraction) are a tie: the item is rejected. */
export const MIN_MARGIN = 0.002;

const BANKROLL = 50_000;

interface Template {
  /** which levels offer it (1-based) */
  levels: readonly number[];
  build(rng: DrillRng): { state: GameState; situation: string; candidates: Candidate[] } | null;
}
interface Candidate {
  id: string;
  label: string;
  action: Action;
  stake: Cents;
}

const dollars = (c: Cents) => formatMoney(c);
const pointOn = (point: PointNumber, rack: Cents, extra: string) =>
  `The point is ${point}. ${extra} You have ${dollars(rack)} in the rack. Which move costs you the least?`;

function game(opts: { point?: PointNumber | null; bets?: BetInit[] }): GameState {
  const point = opts.point ?? null;
  return createGame({
    seed: 1,
    bankroll: BANKROLL,
    rules: 'standard-vegas',
    phase: point === null ? 'come-out' : 'point',
    point,
    ...(opts.bets ? { bets: opts.bets } : {}),
  });
}

const place = (betType: BetTypeId, amount: Cents): Action => ({
  type: 'place-bet',
  betType,
  amount,
});
const nameOf = (t: string) => BET_TYPES[t as keyof typeof BET_TYPES].label;

/** Odds a flat bet of `flat` may take at `point` under 3-4-5x, rounded to full-pay units. */
function maxOdds(state: GameState, flat: Cents, point: PointNumber): Cents {
  const mult = state.rules.maxOdds[point];
  const unit = point === 6 || point === 8 ? 500 : point === 5 || point === 9 ? 200 : 100;
  return Math.floor((flat * mult) / unit) * unit;
}

const TEMPLATES: Template[] = [
  // 1. Pass line up, point on: odds beat every number bet
  {
    levels: [1, 2, 3],
    build(rng) {
      const point = rng.pick(POINT_NUMBERS);
      const flat = rng.pick([500, 1000, 1500, 2500]);
      const state = game({ point, bets: [{ type: 'pass-line', amount: flat }] });
      const odds = maxOdds(state, flat, point);
      const six = rng.pick([600, 1200, 1800]);
      const candidates: Candidate[] = [
        {
          id: 'odds',
          label: `Add ${dollars(odds)} odds behind the Pass Line`,
          action: place('pass-odds', odds),
          stake: odds,
        },
        {
          id: 'place-6',
          label: `Place the 6 for ${dollars(six)}`,
          action: place('place-6', six),
          stake: six,
        },
        {
          id: 'field',
          label: `Bet ${dollars(flat)} on the Field`,
          action: place('field', flat),
          stake: flat,
        },
        rng.chance(0.5)
          ? { id: 'hard', label: 'Bet $5 on Hard 8', action: place('hard-8', 500), stake: 500 }
          : {
              id: 'big',
              label: `Bet ${dollars(flat)} on Big 6`,
              action: place('big-6', flat),
              stake: flat,
            },
      ];
      return {
        state,
        situation: pointOn(
          point,
          state.bankroll,
          `You have ${dollars(flat)} on the Pass Line and no odds yet.`,
        ),
        candidates,
      };
    },
  },
  // 2. Numbers: place 6/8 vs place 4/10 vs buy 4 ($10 vs $20) vs big 6
  {
    levels: [2, 3],
    build(rng) {
      const point = rng.pick([5, 9, 6, 8] as const);
      const state = game({ point, bets: [{ type: 'pass-line', amount: 1000 }] });
      const outside = rng.pick([4, 10] as const);
      const inside = rng.pick([6, 8] as const);
      const candidates: Candidate[] = [
        {
          id: 'place-in',
          label: `Place the ${inside} for $12`,
          action: place(`place-${inside}`, 1200),
          stake: 1200,
        },
        {
          id: 'place-out',
          label: `Place the ${outside} for $10`,
          action: place(`place-${outside}`, 1000),
          stake: 1000,
        },
        {
          id: 'buy-10',
          label: `Buy the ${outside} for $10`,
          action: place(`buy-${outside}`, 1000),
          stake: 1000,
        },
        {
          id: 'buy-20',
          label: `Buy the ${outside} for $20`,
          action: place(`buy-${outside}`, 2000),
          stake: 2000,
        },
      ];
      return {
        state,
        situation: pointOn(point, state.bankroll, 'Your Pass Line bet has full odds behind it.'),
        candidates,
      };
    },
  },
  // 3. Don't side: taking down a winning Don't Pass vs laying odds vs chasing the number
  {
    levels: [3],
    build(rng) {
      const point = rng.pick(POINT_NUMBERS);
      const flat = rng.pick([1000, 2000]);
      const state = game({ point, bets: [{ type: 'dont-pass', amount: flat }] });
      const dp = state.bets[0]!;
      const lay = Math.min(maxOdds(state, flat, point) * 2, flat * state.rules.maxLayOdds[point]);
      const candidates: Candidate[] = [
        {
          id: 'take-down',
          label: `Take down the ${dollars(flat)} Don't Pass`,
          action: { type: 'remove-bet', betId: dp.id },
          stake: flat,
        },
        {
          id: 'lay-odds',
          label: `Lay ${dollars(lay)} odds against the ${point}`,
          action: place('dont-pass-odds', lay),
          stake: lay,
        },
        {
          id: 'place',
          label: `Place the ${point} for $10`,
          action: place(`place-${point}`, 1000),
          stake: 1000,
        },
        { id: 'any-7', label: 'Bet $5 on Any Seven', action: place('any-7', 500), stake: 500 },
      ];
      return {
        state,
        situation: pointOn(
          point,
          state.bankroll,
          `You have ${dollars(flat)} on Don't Pass. The 7 is now your friend.`,
        ),
        candidates,
      };
    },
  },
  // 4. Come-out: line bets vs the shiny one-roll bets
  {
    levels: [1, 2, 3],
    build(rng) {
      const state = game({ point: null });
      const flat = rng.pick([500, 1000, 2500]);
      const line = rng.chance(0.5) ? 'pass-line' : 'dont-pass';
      const candidates: Candidate[] = [
        {
          id: 'line',
          label: `Bet ${dollars(flat)} on ${nameOf(line)}`,
          action: place(line, flat),
          stake: flat,
        },
        {
          id: 'field',
          label: `Bet ${dollars(flat)} on the Field`,
          action: place('field', flat),
          stake: flat,
        },
        { id: 'craps', label: 'Bet $5 on Any Craps', action: place('any-craps', 500), stake: 500 },
        { id: 'c-e', label: 'Bet $2 on C and E', action: place('c-e', 200), stake: 200 },
      ];
      return {
        state,
        situation: `Come-out roll, nothing on the table, ${dollars(state.bankroll)} in the rack. Which bet gives the house the least?`,
        candidates,
      };
    },
  },
];

/** Prices every candidate with the bet sheet's preview; null when one is illegal. */
export function priceOptions(
  state: GameState,
  candidates: readonly Candidate[],
): MoveOption[] | null {
  const out: MoveOption[] = [];
  for (const c of candidates) {
    const p = previewAction(state, c.action);
    if (!p.validation.ok || c.stake <= 0) return null;
    const ev = toNumber(p.evCents);
    out.push({
      ...c,
      evCents: ev,
      evPerDollar: ev / c.stake,
      headline: p.headline,
    });
  }
  return out;
}

/** The best option, or null on a tie (within MIN_MARGIN of the runner-up). */
export function bestOf(options: readonly MoveOption[]): MoveOption | null {
  const sorted = [...options].sort((a, b) => b.evPerDollar - a.evPerDollar);
  const [first, second] = sorted;
  if (!first || !second) return null;
  if (first.evPerDollar - second.evPerDollar < MIN_MARGIN) return null;
  return first;
}

function visualsFor(state: GameState): Visual[] {
  const v: Visual[] = [{ kind: 'puck', point: state.point }];
  for (const b of state.bets) v.push({ kind: 'chips', amount: b.amount, caption: nameOf(b.type) });
  return v;
}

export function generate(rng: DrillRng, level: number): BestMoveItem {
  const pool = TEMPLATES.filter((t) => t.levels.includes(level));
  // a handful of tries: a template whose options tie or fail validation is skipped
  for (let attempt = 0; attempt < 20; attempt++) {
    const built = rng.pick(pool).build(rng);
    if (!built) continue;
    const options = priceOptions(built.state, built.candidates);
    if (!options) continue;
    const best = bestOf(options);
    if (!best) continue;
    const shuffled = rng.shuffle(options);
    const choices: Choice[] = shuffled.map((o) => ({ id: o.id, label: o.label }));
    const key = `${built.state.point ?? 'off'}|${shuffled
      .map((o) => `${o.id}:${o.stake}`)
      .sort()
      .join(',')}`;
    return {
      key,
      prompt: built.situation,
      visuals: visualsFor(built.state),
      answer: { kind: 'choice', choices },
      state: built.state,
      options: shuffled,
      best: best.id,
      situation: built.situation,
    };
  }
  throw new Error('bestMove: no tie-free situation found');
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

function explain(item: BestMoveItem): string {
  const ranked = [...item.options].sort((a, b) => b.evPerDollar - a.evPerDollar);
  const lines = ranked.map((o, i) => {
    const per = o.evPerDollar >= 0 ? 'no cost' : `${pct(-o.evPerDollar)} of the money at risk`;
    return `${i + 1}. ${o.label}: ${o.headline} (${per}).`;
  });
  return `Ranked by expected value per dollar: ${lines.join(' ')}`;
}

export const bestMove = defineDrill<BestMoveItem, string>({
  id: 'best-move',
  title: 'Best move',
  summary: 'A table situation, a few tempting moves: pick the one with the best EV per dollar.',
  levels: ['Odds first', 'Numbers', "Don't side and take-downs"],
  generate,
  check(item, answer) {
    const best = item.options.find((o) => o.id === item.best)!;
    return {
      ok: answer === item.best,
      expected: best.label,
      correct: item.best,
      explain: explain(item),
    };
  },
});
