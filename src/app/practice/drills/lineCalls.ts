// Example drill: "Line calls". A pass or don't pass bet, the puck and a roll: does the bet win,
// lose, push or stay? The answer comes from the engine (createGame + applyAction), not a table.
import { applyAction, BET_TYPES, createGame, POINT_NUMBERS } from '../../../sim/engine';
import type { Dice, Die, GameEvent, PointNumber } from '../../../sim/engine';
import { defineDrill, type Choice, type DrillItem } from '../types';
import type { DrillRng } from '../rng';

export type LineBet = 'pass-line' | 'dont-pass';
export type LineOutcome = 'win' | 'lose' | 'push' | 'none';

export interface LineCallItem extends DrillItem {
  bet: LineBet;
  point: PointNumber | null;
  dice: Dice;
  outcome: LineOutcome;
  /** engine events of the roll, for the explanation */
  events: readonly GameEvent[];
}

const AMOUNT = 1000; // $10

const LABELS: Record<LineOutcome, string> = {
  win: 'Wins',
  lose: 'Loses',
  push: 'Pushes',
  none: 'No decision',
};

function combos(total: number): Dice[] {
  const out: Dice[] = [];
  for (let a = 1; a <= 6; a++) {
    const b = total - a;
    if (b >= 1 && b <= 6) out.push([a as Die, b as Die]);
  }
  return out;
}

/** What the engine does to a $10 line bet on this roll. */
export function resolveLineBet(
  bet: LineBet,
  point: PointNumber | null,
  dice: Dice,
): { outcome: LineOutcome; events: GameEvent[] } {
  const state = createGame({
    seed: 1,
    phase: point === null ? 'come-out' : 'point',
    point,
    bets: [{ type: bet, amount: AMOUNT }],
  });
  const r = applyAction(state, { type: 'roll', dice });
  if (!r.ok) throw new Error(`lineCalls: roll rejected: ${r.error.message}`);
  let outcome: LineOutcome = 'none';
  for (const e of r.events) {
    if (e.type === 'bet-won' && e.betType === bet) outcome = 'win';
    else if (e.type === 'bet-lost' && e.betType === bet) outcome = 'lose';
    else if (e.type === 'bet-pushed' && e.betType === bet) outcome = 'push';
  }
  return { outcome, events: r.events };
}

function explain(item: LineCallItem): string {
  const name = BET_TYPES[item.bet].label;
  const total = item.dice[0] + item.dice[1];
  const lead = (() => {
    for (const e of item.events) {
      if (e.type === 'natural') return `${total} on the come-out is a natural (7 or 11).`;
      if (e.type === 'craps') return `${total} on the come-out is craps (2, 3 or 12).`;
      if (e.type === 'point-established')
        return `${total} on the come-out sets the point: the puck goes ON ${e.point}.`;
      if (e.type === 'point-made') return `${total} is the point, rolled before a 7.`;
      if (e.type === 'seven-out') return `7 before the point (${e.point}): seven-out.`;
    }
    return `${total} is neither 7 nor the point (${item.point ?? '?'}), so it means nothing to the line.`;
  })();
  const tail: Record<LineOutcome, string> = {
    win: `${name} wins even money.`,
    lose: `${name} loses.`,
    push:
      item.bet === 'dont-pass' && total === 12
        ? `${name} is barred on 12: it pushes (no win, no loss) and stays for the next come-out.`
        : `${name} pushes.`,
    none:
      item.point === null
        ? `${name} stays up and waits for the point to be decided.`
        : `${name} stays up; no decision yet.`,
  };
  return `${lead} ${tail[item.outcome]}`;
}

function choicesFor(level: number): Choice[] {
  const ids: LineOutcome[] = level >= 3 ? ['win', 'lose', 'push', 'none'] : ['win', 'lose', 'none'];
  return ids.map((id) => ({ id, label: LABELS[id] }));
}

function generate(rng: DrillRng, level: number): LineCallItem {
  const bet: LineBet = level >= 3 && rng.chance(0.5) ? 'dont-pass' : 'pass-line';
  const point: PointNumber | null = level >= 2 && rng.chance(0.5) ? rng.pick(POINT_NUMBERS) : null;
  // Lean towards deciding totals half the time, so "No decision" is not the usual answer:
  // with a point on, 7 or the point; on the come-out, a natural (7, 11) or craps (2, 3, 12).
  const deciding: readonly number[] = point !== null ? [7, point] : [7, 11, 2, 3, 12];
  const dice: Dice = rng.chance(0.5) ? rng.pick(combos(rng.pick(deciding))) : rng.dice();
  const { outcome, events } = resolveLineBet(bet, point, dice);
  const name = BET_TYPES[bet].label;
  const sorted = [...dice].sort().join('');
  return {
    key: `${bet}|${point ?? 'off'}|${sorted}`,
    prompt:
      point === null
        ? `Come-out roll with $10 on ${name}. What happens to the bet?`
        : `The point is ${point}, with $10 on ${name}. What happens to the bet?`,
    visuals: [
      { kind: 'puck', point },
      { kind: 'chips', amount: AMOUNT, caption: name },
      { kind: 'dice', dice },
    ],
    answer: { kind: 'choice', choices: choicesFor(level) },
    bet,
    point,
    dice,
    outcome,
    events,
  };
}

export const lineCalls = defineDrill<LineCallItem, string>({
  id: 'line-calls',
  title: 'Line calls',
  summary: "Pass or Don't Pass: win, lose or no decision?",
  levels: ['Come-out only', 'Come-out and point', "Add Don't Pass"],
  generate,
  check(item, answer) {
    return {
      ok: answer === item.outcome,
      expected: LABELS[item.outcome],
      correct: item.outcome,
      explain: explain(item),
    };
  },
});
