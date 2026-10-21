import { afterEach, describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine';
import {
  fmtDelta,
  loadAskAfterWin,
  saveAskAfterWin,
  winChoices,
  winPromptTarget,
} from './winPrompt';

afterEach(() => localStorage.clear());

function won(type: 'place-6' | 'buy-4' | 'pass-line', amount: number) {
  let g = createGame({
    bankroll: 100_000,
    seed: 1,
    phase: 'point',
    point: type === 'buy-4' ? 8 : 4,
    bets: [{ type, amount }],
  });
  const dice =
    type === 'buy-4'
      ? ([2, 2] as const)
      : type === 'place-6'
        ? ([3, 3] as const)
        : ([2, 2] as const);
  const r = applyAction(g, { type: 'roll', dice: [dice[0], dice[1]] });
  if (!r.ok) throw new Error('roll');
  g = r.state;
  return { g, events: r.events };
}

describe('win prompt logic', () => {
  it('targets a place or buy bet that won and stays up; not a pass line or a lost bet', () => {
    const p = won('place-6', 1200);
    expect(winPromptTarget(p.g, p.events)?.betId).toBe(p.g.bets[0]!.id);
    const b = won('buy-4', 2000);
    expect(winPromptTarget(b.g, b.events)?.betId).toBe(b.g.bets[0]!.id);
    const line = won('pass-line', 500); // point 4 made: the pass line wins and is paid off
    expect(winPromptTarget(line.g, line.events)).toBeNull();
    const g = createGame({
      bankroll: 100_000,
      seed: 1,
      phase: 'point',
      point: 4,
      bets: [{ type: 'place-6', amount: 1200 }],
    });
    const r = applyAction(g, { type: 'roll', dice: [3, 4] }); // seven-out
    expect(r.ok && winPromptTarget(r.state, r.events)).toBeNull();
  });

  it('place-6 $12: press to $24 costs +$0.06/roll more, regress -$0.03, take down -$0.06, same 0', () => {
    const { g } = won('place-6', 1200);
    const bet = g.bets[0]!;
    const c = Object.fromEntries(winChoices(g, bet).map((x) => [x.id, x]));
    // place 6 loses 1.515% of the amount per resolution; resolves on 11 of 36 rolls
    const perDollar = (11 / 36) * (1 / 66);
    expect(c.press!.deltaPerRoll).toBeCloseTo(1200 * perDollar, 1);
    expect(c.press!.action).toEqual({ type: 'set-amount', betId: bet.id, amount: 2400 });
    expect(c.regress!.deltaPerRoll).toBeCloseTo(-600 * perDollar, 1);
    expect(c['take-down']!.deltaPerRoll).toBeCloseTo(-1200 * perDollar, 1);
    expect(c.same!.deltaPerRoll).toBe(0);
    expect(c.same!.action).toBeNull();
    expect(fmtDelta(c.press!.deltaPerRoll)).toBe('+$0.06/roll');
  });

  it('leaves out choices the table would reject', () => {
    // $6 cannot regress to $3 (place 6 pays in $6 units)
    const { g } = won('place-6', 600);
    const ids = winChoices(g, g.bets[0]!).map((x) => x.id);
    expect(ids).toEqual(['press', 'same', 'take-down']);
    // no cash to press
    const poor = { ...g, bankroll: 100 };
    expect(winChoices(poor, poor.bets[0]!).map((x) => x.id)).toEqual(['same', 'take-down']);
    // every action offered is legal
    for (const c of winChoices(g, g.bets[0]!))
      if (c.action) expect(applyAction(g, c.action).ok).toBe(true);
  });

  it('"Always same bet" is remembered in storage', () => {
    expect(loadAskAfterWin()).toBe(true);
    saveAskAfterWin(false);
    expect(loadAskAfterWin()).toBe(false);
    saveAskAfterWin(true);
    expect(loadAskAfterWin()).toBe(true);
  });
});
