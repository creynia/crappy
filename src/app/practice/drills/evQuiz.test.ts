import { describe, expect, it } from 'vitest';
import { resolveRules } from '../../../sim/engine';
import type { BetTypeId, RulePresetId } from '../../../sim/engine';
import { POINT_PHASE_SHARE, betEdge, lossPerRoll } from '../../../sim/math/ev';
import { add, frac, mul, toNumber } from '../../../sim/math/fraction';
import { oddsLimits, passMaxOddsEdge } from '../../../sim/ui/customRules';
import { createDrillRng } from '../rng';
import {
  evQuiz,
  generateEvItem,
  LAYOUTS,
  layoutLossPerRoll,
  money2,
  passOddsEdge,
  pct2,
  type EvQuizItem,
  type EvTemplate,
} from './evQuiz';

const std = resolveRules('standard-vegas');
const gen = (seed: number, t: EvTemplate) => generateEvItem(createDrillRng(seed), 3, t);
const choices = (it: EvQuizItem) => (it.answer.kind === 'choice' ? it.answer.choices : []);

describe('EV quiz: answers are the math engine', () => {
  it('edge: textbook numbers straight from betEdge', () => {
    const come = { phase: 'come-out' as const, point: null, rules: std };
    expect(pct2(betEdge('pass-line', 1000, come).perResolved)).toBe('1.41%');
    expect(pct2(betEdge('field', 500, come).perResolved)).toBe('5.56%');
    expect(
      pct2(betEdge('field', 500, { ...come, rules: resolveRules('field-3x-12') }).perResolved),
    ).toBe('2.78%');
    for (let s = 0; s < 150; s++) {
      const it = gen(s, 'edge');
      const { preset, bet, amount } = it.meta as {
        preset: RulePresetId;
        bet: BetTypeId;
        amount: number;
      };
      const r = resolveRules(preset);
      const ctx =
        bet.startsWith('place-') || bet.startsWith('hard-')
          ? { phase: 'point' as const, point: 4 as const, rules: r }
          : { phase: 'come-out' as const, point: null, rules: r };
      expect(it.correct).toBe(pct2(betEdge(bet, amount, ctx).perResolved));
      expect(it.correct).toMatch(/^\d+\.\d\d%$/);
    }
  });
  it('pass + odds: passMaxOddsEdge with the chosen odds', () => {
    expect(pct2(passOddsEdge('3-4-5x'))).toBe('0.37%');
    expect(passOddsEdge('2x')).toEqual(passMaxOddsEdge({ ...std, ...oddsLimits('2x') }));
    for (let s = 0; s < 60; s++) {
      const it = gen(s, 'pass-odds');
      const c = /full (.+) odds/.exec(it.prompt)![1]! as Parameters<typeof passOddsEdge>[0];
      expect(it.correct).toBe(pct2(passOddsEdge(c)));
    }
  });
  it('per hour: loss per roll x pace, place bets and hardways only on point-phase rolls', () => {
    const p68 = layoutLossPerRoll(
      [
        { type: 'place-6', amount: 1200 },
        { type: 'place-8', amount: 1200 },
      ],
      std,
    );
    const working = lossPerRoll(
      { type: 'place-6', amount: 1200, point: null },
      {
        phase: 'point',
        point: 4,
        rules: std,
      },
    );
    expect(p68).toEqual(mul(add(working, working), POINT_PHASE_SHARE));
    // Pass Line $10: 7/1671 of $10 per roll; 100 rolls = $4.19
    expect(
      money2(toNumber(layoutLossPerRoll([{ type: 'pass-line', amount: 1000 }], std)) * 100),
    ).toBe('$4.19');
    expect(toNumber(layoutLossPerRoll([{ type: 'pass-line', amount: 1000 }], std))).toBeCloseTo(
      toNumber(mul(frac(1000), frac(7, 1671))),
      12,
    );
    for (let s = 0; s < 80; s++) {
      const it = gen(s, 'per-hour');
      const { layout, pace } = it.meta as { layout: number; pace: number };
      expect(it.correct).toBe(
        money2(toNumber(layoutLossPerRoll(LAYOUTS[layout]!.bets, std)) * pace),
      );
      expect(it.correct).toMatch(/^\$\d+\.\d\d$/);
      expect(choices(it).map((c) => c.id)).toContain(it.correct);
    }
  });
  it('cheaper: the prompt is about cents per roll, not per dollar bet', () => {
    expect(gen(1, 'cheaper').prompt).toContain('in cents (not per dollar bet)');
  });
  it('cheaper: the right bet has the lower loss per roll', () => {
    for (let s = 0; s < 80; s++) {
      const it = gen(s, 'cheaper');
      const m = it.meta as { a: BetTypeId; aAmount: number; b: BetTypeId; bAmount: number };
      const ctx = { phase: 'point' as const, point: 4 as const, rules: std };
      const la = toNumber(lossPerRoll({ type: m.a, amount: m.aAmount, point: null }, ctx));
      const lb = toNumber(lossPerRoll({ type: m.b, amount: m.bAmount, point: null }, ctx));
      expect(la).not.toBe(lb);
      expect(it.correct).toBe(la < lb ? m.a : m.b);
      const [a, b] = choices(it);
      expect(it.correct === a!.id || it.correct === b!.id).toBe(true);
      expect(a!.id).not.toBe(b!.id);
    }
  });
});

describe('EV quiz: choices', () => {
  it('every item has 2-4 distinct choices including the answer, at every level', () => {
    for (let level = 1; level <= 3; level++)
      for (let s = 0; s < 200; s++) {
        const it = evQuiz.generate(createDrillRng(s), level) as unknown as EvQuizItem;
        const cs = choices(it);
        expect(cs.length).toBeGreaterThanOrEqual(2);
        expect(new Set(cs.map((c) => c.label)).size).toBe(cs.length);
        expect(cs.some((c) => c.id === it.correct)).toBe(true);
        expect(evQuiz.check(it, it.correct).ok).toBe(true);
        const wrong = cs.find((c) => c.id !== it.correct)!;
        expect(evQuiz.check(it, wrong.id).ok).toBe(false);
        expect(it.explain).not.toMatch(/you will lose/i);
        expect(it.explain).not.toMatch(/\ba (8|11|18)\b/);
      }
  });
  it('money is shown to the cent', () => {
    expect(money2(100)).toBe('$1.00');
    expect(money2(123456)).toBe('$1,234.56');
  });
});
