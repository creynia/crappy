// Drill: "EV quiz". Endless multiple-choice questions whose answers come from the math engine:
// a bet's house edge under a preset, the expected loss per hour of a layout, the combined edge of
// Pass + odds, and which of two bets costs less per roll. Wording follows curriculum §6.5:
// "expected loss", percentages to two decimals, money to the cent.
import { BET_TYPES, formatPct, resolveRules } from '../../../sim/engine';
import type { BetTypeId, Cents, RulePresetId, TableRules } from '../../../sim/engine';
import { POINT_PHASE_SHARE, betEdge, lossPerRoll, offOnComeOut } from '../../../sim/math/ev';
import { add, frac, mul, toNumber, ZERO, type Fraction } from '../../../sim/math/fraction';
import type { BetCtx } from '../../../sim/math/types';
import { oddsLimits, passMaxOddsEdge, type OddsChoice } from '../../../sim/ui/customRules';
import type { DrillRng } from '../rng';
import { defineDrill, type Choice, type DrillItem } from '../types';

export type EvTemplate = 'edge' | 'per-hour' | 'pass-odds' | 'cheaper';

export interface EvQuizItem extends DrillItem {
  template: EvTemplate;
  /** the correct choice id */
  correct: string;
  /** the correct answer in words */
  expectedText: string;
  explain: string;
  /** the question's inputs, so tests can recompute the answer from the math engine */
  meta: Readonly<Record<string, string | number>>;
}

/** "$1.41": always to the cent (§6.5), from a cents value. */
export function money2(cents: number): string {
  const c = Math.round(cents);
  const s = (Math.abs(c) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${c < 0 ? '-' : ''}$${s}`;
}
export const pct2 = (f: Fraction): string => formatPct(f, 2);
/** "4.04¢": small per-roll amounts, in cents to two decimals. */
export const cents2 = (cents: number): string => `${cents.toFixed(2)}¢`;
/** "an 11.11%", "an 8", "a 1.41%". */
const an = (text: string): string => (/^(8|11|18)(?!\d)|^8\d/.test(text) ? 'an' : 'a');

const COME_OUT = (rules: TableRules): BetCtx => ({ phase: 'come-out', point: null, rules });
/** Point phase (point 4) so place bets and hardways are working. */
const ON_POINT = (rules: TableRules): BetCtx => ({ phase: 'point', point: 4, rules });

interface BetPick {
  type: BetTypeId;
  amount: Cents;
}
/** Bets at sizes that pay in full (so the edge is the textbook one). */
const EDGE_BETS: readonly BetPick[] = [
  { type: 'pass-line', amount: 1000 },
  { type: 'dont-pass', amount: 1000 },
  { type: 'come', amount: 1000 },
  { type: 'place-6', amount: 1200 },
  { type: 'place-5', amount: 1000 },
  { type: 'place-4', amount: 1000 },
  { type: 'buy-4', amount: 2000 },
  { type: 'lay-4', amount: 4000 },
  { type: 'field', amount: 500 },
  { type: 'big-6', amount: 600 },
  { type: 'hard-6', amount: 500 },
  { type: 'hard-4', amount: 500 },
  { type: 'any-7', amount: 500 },
  { type: 'any-craps', amount: 500 },
  { type: 'yo-11', amount: 500 },
  { type: 'horn', amount: 400 },
  { type: 'world', amount: 500 },
];
const PRESETS: readonly { id: RulePresetId; label: string }[] = [
  { id: 'standard-vegas', label: 'standard Vegas rules' },
  { id: 'field-3x-12', label: 'a table where the Field pays 3x on 12' },
];

const label = (t: BetTypeId) => BET_TYPES[t].label;
const dollars = (c: Cents) => money2(c).replace(/\.00$/, '');

/** Edge of a new bet, per bet resolved (pushes count as decisions, as on the bet cards). */
export function edgeOf(b: BetPick, rules: TableRules): Fraction {
  const ctx =
    b.type.startsWith('place-') || b.type.startsWith('hard-') ? ON_POINT(rules) : COME_OUT(rules);
  return betEdge(b.type, b.amount, ctx).perResolved;
}

/**
 * Expected loss per roll of play (cents) of a layout left up: a bet that is off on the come-out
 * (place, hardways) only costs on point-phase rolls, 392/557 of all rolls.
 */
export function layoutLossPerRoll(bets: readonly BetPick[], rules: TableRules): Fraction {
  let t = ZERO;
  for (const b of bets) {
    const working = lossPerRoll({ type: b.type, amount: b.amount, point: null }, ON_POINT(rules));
    t = add(t, offOnComeOut(b.type, rules) ? mul(working, POINT_PHASE_SHARE) : working);
  }
  return t;
}

/**
 * Up to `n` choices: the correct text plus distinct distractor texts (same format), shuffled.
 * Distractors that format the same as the answer or each other are dropped.
 */
function choicesOf(rng: DrillRng, correct: string, distractors: string[], n = 4): Choice[] {
  const seen = new Set([correct]);
  const pool: string[] = [];
  for (const d of rng.shuffle(distractors)) {
    if (seen.has(d)) continue;
    seen.add(d);
    pool.push(d);
    if (pool.length === n - 1) break;
  }
  return rng.shuffle([correct, ...pool]).map((t) => ({ id: t, label: t }));
}

function edgeItem(rng: DrillRng): EvQuizItem {
  const preset = rng.chance(0.3) ? PRESETS[1]! : PRESETS[0]!;
  const rules = resolveRules(preset.id);
  const bet =
    preset.id === 'field-3x-12' ? EDGE_BETS.find((b) => b.type === 'field')! : rng.pick(EDGE_BETS);
  const answer = pct2(edgeOf(bet, rules));
  const others = EDGE_BETS.filter((b) => b.type !== bet.type).map((b) => pct2(edgeOf(b, rules)));
  if (bet.type === 'field')
    others.push(
      pct2(
        edgeOf(bet, resolveRules(preset.id === 'field-3x-12' ? 'standard-vegas' : 'field-3x-12')),
      ),
    );
  return {
    key: `edge|${preset.id}|${bet.type}`,
    prompt: `On ${preset.label}, what is the house edge of a ${dollars(bet.amount)} ${label(bet.type)} bet (per bet resolved)?`,
    answer: { kind: 'choice', choices: choicesOf(rng, answer, others) },
    template: 'edge',
    meta: { preset: preset.id, bet: bet.type, amount: bet.amount },
    correct: answer,
    expectedText: answer,
    explain: `${label(bet.type)} has ${an(answer)} ${answer} house edge: on average you lose ${answer} of the money you bet on it each time it is decided.`,
  };
}

export const LAYOUTS: readonly { name: string; bets: BetPick[] }[] = [
  { name: '$10 on the Pass Line', bets: [{ type: 'pass-line', amount: 1000 }] },
  { name: "$10 on Don't Pass", bets: [{ type: 'dont-pass', amount: 1000 }] },
  {
    name: '$12 each on Place 6 and Place 8',
    bets: [
      { type: 'place-6', amount: 1200 },
      { type: 'place-8', amount: 1200 },
    ],
  },
  { name: '$5 on the Field every roll', bets: [{ type: 'field', amount: 500 }] },
  { name: '$5 on Any 7 every roll', bets: [{ type: 'any-7', amount: 500 }] },
  {
    name: '$10 on the Pass Line and $12 on Place 6',
    bets: [
      { type: 'pass-line', amount: 1000 },
      { type: 'place-6', amount: 1200 },
    ],
  },
  { name: '$5 on Hard 8', bets: [{ type: 'hard-8', amount: 500 }] },
];
const PACES = [60, 100, 120] as const;

function perHourItem(rng: DrillRng): EvQuizItem {
  const layout = rng.pick(LAYOUTS);
  const pace = rng.pick(PACES);
  const rules = resolveRules('standard-vegas');
  const perRoll = layoutLossPerRoll(layout.bets, rules);
  const hour = (l: { bets: BetPick[] }, p: number) =>
    toNumber(mul(layoutLossPerRoll(l.bets, rules), frac(p)));
  const answer = money2(toNumber(perRoll) * pace);
  const others = [
    ...LAYOUTS.filter((l) => l !== layout).map((l) => money2(hour(l, pace))),
    ...PACES.filter((p) => p !== pace).map((p) => money2(hour(layout, p))),
  ];
  return {
    key: `hour|${layout.name}|${pace}`,
    prompt: `${layout.name}, left up at ${pace} rolls an hour: what is the expected loss per hour? (Place bets and hardways are off on come-out rolls.)`,
    answer: { kind: 'choice', choices: choicesOf(rng, answer, others) },
    template: 'per-hour',
    meta: { layout: LAYOUTS.indexOf(layout), pace },
    correct: answer,
    expectedText: answer,
    explain: `On average the layout costs ${cents2(toNumber(perRoll))} a roll; × ${pace} rolls = an expected loss of ${answer} an hour.`,
  };
}

const ODDS: readonly { choice: OddsChoice; text: string }[] = [
  { choice: '3-4-5x', text: '3-4-5x odds' },
  { choice: '2x', text: '2x odds' },
  { choice: '5x', text: '5x odds' },
  { choice: '10x', text: '10x odds' },
  { choice: '100x', text: '100x odds' },
];

export function passOddsEdge(choice: OddsChoice): Fraction {
  return passMaxOddsEdge({ ...resolveRules('standard-vegas'), ...oddsLimits(choice) });
}

function passOddsItem(rng: DrillRng): EvQuizItem {
  const o = rng.pick(ODDS);
  const answer = pct2(passOddsEdge(o.choice));
  const others = [
    ...ODDS.filter((x) => x !== o).map((x) => pct2(passOddsEdge(x.choice))),
    pct2(frac(7, 495)), // Pass alone
  ];
  return {
    key: `odds|${o.choice}`,
    prompt: `$10 on the Pass Line, always backed with the full ${o.text}: what is the combined house edge on all the money bet?`,
    answer: { kind: 'choice', choices: choicesOf(rng, answer, others) },
    template: 'pass-odds',
    meta: { odds: o.choice },
    correct: answer,
    expectedText: answer,
    explain: `The odds bet has no house edge, so the Pass Line's 1.41% is spread over more money: ${answer} with ${o.text}.`,
  };
}

function cheaperItem(rng: DrillRng): EvQuizItem {
  const rules = resolveRules('standard-vegas');
  const cost = (b: BetPick) =>
    lossPerRoll({ type: b.type, amount: b.amount, point: null }, ON_POINT(rules));
  let a = rng.pick(EDGE_BETS);
  let b = rng.pick(EDGE_BETS);
  const same = () => a.type === b.type || toNumber(cost(a)) === toNumber(cost(b));
  for (let i = 0; i < 200 && same(); i++) {
    a = rng.pick(EDGE_BETS);
    b = rng.pick(EDGE_BETS);
  }
  if (same()) throw new Error('evQuiz: no two bets with different costs found');
  const ca = toNumber(cost(a));
  const cb = toNumber(cost(b));
  const cheap = ca < cb ? a : b;
  const name = (x: BetPick) => `${dollars(x.amount)} ${label(x.type)}`;
  const choices: Choice[] = [a, b].map((x) => ({ id: x.type, label: name(x) }));
  return {
    key: `cheaper|${[a.type, b.type].sort().join('|')}`,
    prompt:
      'Which bet has the lower expected loss per roll, in cents (not per dollar bet)? A line bet counts every roll until it is decided; other bets count the rolls they are working.',
    answer: { kind: 'choice', choices },
    template: 'cheaper',
    meta: { a: a.type, aAmount: a.amount, b: b.type, bAmount: b.amount },
    correct: cheap.type,
    expectedText: name(cheap),
    explain: `${name(a)}: an expected loss of ${cents2(ca)} a roll. ${name(b)}: ${cents2(cb)} a roll.`,
  };
}

const BY_LEVEL: Record<number, EvTemplate[]> = {
  1: ['edge'],
  2: ['per-hour', 'pass-odds'],
  3: ['edge', 'per-hour', 'pass-odds', 'cheaper'],
};
const MAKE: Record<EvTemplate, (rng: DrillRng) => EvQuizItem> = {
  edge: edgeItem,
  'per-hour': perHourItem,
  'pass-odds': passOddsItem,
  cheaper: cheaperItem,
};

export function generateEvItem(rng: DrillRng, level: number, template?: EvTemplate): EvQuizItem {
  const t = template ?? rng.pick(BY_LEVEL[level] ?? BY_LEVEL[3]!);
  return MAKE[t](rng);
}

export const evQuiz = defineDrill<EvQuizItem, string>({
  id: 'ev-quiz',
  title: 'EV quiz',
  summary: 'House edges, expected loss per hour and the odds bet, worked out by the simulator.',
  levels: ['House edges', 'Per hour and the odds', 'Everything'],
  generate: (rng, level) => generateEvItem(rng, level),
  check(item, answer) {
    return {
      ok: answer === item.correct,
      expected: item.expectedText,
      correct: item.correct,
      explain: item.explain,
    };
  },
});
