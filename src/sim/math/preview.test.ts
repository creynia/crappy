import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/game';
import { add, eq, frac, mul, ONE, toNumber, ZERO } from './fraction';
import { betEV } from './ev';
import { fracText } from './format';
import { expectedLossByTypePerRoll, tableExpectedLossPerRoll } from './ev';
import { previewAction, suggestAlternative } from './preview';
import { explainBet } from './explain';

const comeOut = () => createGame({ seed: 1 });
const onPoint4 = (
  bets: Parameters<typeof createGame>[0] extends infer O
    ? O extends { bets?: infer B }
      ? B
      : never
    : never,
) => createGame({ seed: 1, phase: 'point', point: 4, bets });

describe('previewAction', () => {
  it('matches the acceptance examples', () => {
    const s = comeOut();
    expect(
      previewAction(s, { type: 'place-bet', betType: 'pass-line', amount: 1000 }).headline,
    ).toBe('Expected value: -$0.14 (house edge 1.41%)');
    const p = onPoint4([{ type: 'pass-line', amount: 1000 }]);
    expect(previewAction(p, { type: 'place-bet', betType: 'place-6', amount: 1200 }).headline).toBe(
      'Expected value: -$0.18 (house edge 1.52%)',
    );
    expect(previewAction(p, { type: 'place-bet', betType: 'field', amount: 500 }).headline).toBe(
      'Expected value: -$0.28 (house edge 5.56%)',
    );
    expect(previewAction(p, { type: 'place-bet', betType: 'any-7', amount: 500 }).headline).toBe(
      'Expected value: -$0.83 (house edge 16.67%)',
    );
    const odds = previewAction(p, { type: 'place-bet', betType: 'pass-odds', amount: 3000 });
    expect(odds.headline).toMatch(/^Expected value: \$0\.00 \(no house edge/);
    expect(odds.tier).toBe('free');
  });

  it('tiers: only avoid needs the second tap', () => {
    const p = onPoint4([{ type: 'pass-line', amount: 1000 }]);
    const tier = (betType: 'place-4' | 'field' | 'hard-6' | 'place-5', amount: number) =>
      previewAction(p, { type: 'place-bet', betType, amount }).tier;
    expect(tier('place-4', 1000)).toBe('poor');
    expect(tier('field', 500)).toBe('poor');
    expect(tier('place-5', 1000)).toBe('fair');
    expect(tier('hard-6', 500)).toBe('avoid');
  });

  it('removing a DP on point 4 gives up +$3.33 and is avoid-tier', () => {
    const s = onPoint4([{ type: 'dont-pass', amount: 1000, ref: 'dp' }]);
    const id = s.bets[0]!.id;
    const pv = previewAction(s, { type: 'remove-bet', betId: id });
    expect(pv.evCents).toEqual(frac(-1000, 3));
    expect(pv.tier).toBe('avoid');
    expect(pv.headline).toBe('Taking this down gives up +$3.33 of expected value.');
  });

  it('roll preview equals the table expected loss', () => {
    const s = onPoint4([
      { type: 'pass-line', amount: 1000 },
      { type: 'place-6', amount: 600 },
    ]);
    const loss = tableExpectedLossPerRoll(s);
    expect(previewAction(s, { type: 'roll' }).evCents).toEqual(frac(-loss.n, loss.d));
    expect(toNumber(loss)).toBeCloseTo(1000 * (7 / 1671) + 600 / 216, 9);
    const byType = expectedLossByTypePerRoll(s);
    expect(Object.values(byType).reduce((a, b) => a + (b ?? 0), 0)).toBeCloseTo(toNumber(loss), 9);
  });

  it('per-hour line scales by 392/557 for bets off on come-outs and honours rollsPerHour', () => {
    const s = onPoint4([{ type: 'pass-line', amount: 1000 }]);
    const a = previewAction(
      s,
      { type: 'place-bet', betType: 'place-6', amount: 1200 },
      { rollsPerHour: 100 },
    );
    const per = previewAction(s, {
      type: 'place-bet',
      betType: 'place-6',
      amount: 1200,
    }).perRollCents;
    expect(a.perHourCents).toEqual(frac(per.n * 100n * 392n, per.d * 557n));
    const b = previewAction(
      s,
      { type: 'place-bet', betType: 'field', amount: 500 },
      { rollsPerHour: 60 },
    );
    expect(b.perHourCents).toEqual(frac(b.perRollCents.n * 60n, b.perRollCents.d));
  });
});

describe('suggestAlternative', () => {
  it('suggests odds first when a flat bet has room', () => {
    const p = onPoint4([{ type: 'pass-line', amount: 1000 }]);
    const alt = suggestAlternative(p, { type: 'place-bet', betType: 'field', amount: 500 });
    expect(alt?.action).toMatchObject({ betType: 'pass-odds' });
  });
  it('place-4 -> buy-4 in $20 units', () => {
    const s = comeOut();
    const alt = suggestAlternative(s, { type: 'place-bet', betType: 'place-4', amount: 1000 });
    expect(alt?.action).toMatchObject({ betType: 'buy-4', amount: 2000 });
  });
  it('nothing for already-cheap bets', () => {
    expect(
      suggestAlternative(comeOut(), { type: 'place-bet', betType: 'pass-line', amount: 1000 }),
    ).toBeNull();
  });
});

describe('explainBet', () => {
  it('place-6 rows and formula', () => {
    const s = onPoint4([]);
    const e = explainBet(
      { type: 'place-6', amount: 1200, point: null },
      { phase: s.phase, point: s.point, rules: s.rules },
    );
    expect(e.rows.map((r) => `${r.ways}/${r.outOf}`)).toEqual(['5/11', '6/11']);
    expect(e.evFormula).toBe('5/11 × $14.00 − 6/11 × $12.00 = -$0.18');
  });
});

describe('review fixes', () => {
  it('add-odds suggestion uses the remaining odds room and the number unit', () => {
    const s = createGame({
      seed: 1,
      phase: 'point',
      point: 4,
      bets: [
        { ref: 'pl', type: 'pass-line', amount: 1000 },
        { type: 'pass-odds', amount: 2000, parentRef: 'pl' },
      ],
    });
    const alt = suggestAlternative(s, { type: 'place-bet', betType: 'hard-4', amount: 2000 });
    expect(alt?.action).toMatchObject({ betType: 'pass-odds', amount: 1000 });
    expect(alt?.message).toMatch(/^Add Pass Odds/);
  });

  it('no add-odds suggestion when the odds are maxed', () => {
    const s = createGame({
      seed: 1,
      phase: 'point',
      point: 4,
      bets: [
        { ref: 'pl', type: 'pass-line', amount: 1000 },
        { type: 'pass-odds', amount: 3000, parentRef: 'pl' },
      ],
    });
    const alt = suggestAlternative(s, { type: 'place-bet', betType: 'hard-4', amount: 2000 });
    expect(alt?.action.type === 'place-bet' && alt.action.betType).not.toBe('pass-odds');
  });

  it('come-odds amount is a multiple of the come bet number unit', () => {
    const s = createGame({
      seed: 1,
      phase: 'point',
      point: 4,
      bets: [{ type: 'come', amount: 1000, point: 6 }],
    });
    const alt = suggestAlternative(s, { type: 'place-bet', betType: 'hard-4', amount: 700 });
    expect(alt?.action).toMatchObject({ betType: 'come-odds', amount: 500 });
  });

  it('removing a contract bet shows the validation message, not a saving', () => {
    const s = createGame({
      seed: 1,
      phase: 'point',
      point: 4,
      bets: [{ type: 'pass-line', amount: 1000 }],
    });
    const pv = previewAction(s, { type: 'remove-bet', betId: s.bets[0]!.id });
    expect(pv.validation.ok).toBe(false);
    expect(pv.headline).not.toMatch(/saves|gives up/);
    if (!pv.validation.ok) expect(pv.headline).toBe(pv.validation.message);
  });

  it('$1 props still get an alternative, raised to the table minimum', () => {
    const s = createGame({ seed: 1, phase: 'point', point: 4 });
    const alt = suggestAlternative(s, { type: 'place-bet', betType: 'any-craps', amount: 100 });
    expect(alt).not.toBeNull();
    expect(alt?.action).toMatchObject({ type: 'place-bet', betType: 'come' });
    if (alt?.action.type === 'place-bet') expect(alt.action.amount).toBeGreaterThanOrEqual(500);
  });

  it('any-7 suggests dont-come on a point and lay-4 on the come-out', () => {
    const onPoint = createGame({ seed: 1, phase: 'point', point: 4 });
    expect(
      suggestAlternative(onPoint, { type: 'place-bet', betType: 'any-7', amount: 500 })?.action,
    ).toMatchObject({ betType: 'dont-come' });
    expect(
      suggestAlternative(comeOut(), { type: 'place-bet', betType: 'any-7', amount: 500 })?.action,
    ).toMatchObject({ betType: 'lay-4' });
  });

  it('outcomes are shown as dice combinations out of 36', () => {
    const s = comeOut();
    const e = explainBet(
      { type: 'any-7', amount: 500, point: null },
      { phase: s.phase, point: s.point, rules: s.rules },
    );
    expect(e.rows.map((r) => `${r.ways}/${r.outOf}`)).toEqual(['30/36', '6/36']);
  });

  it('turning a bet explicitly on is not scaled by 392/557', () => {
    const s = createGame({ seed: 1, bets: [{ type: 'place-6', amount: 600 }] });
    const id = s.bets[0]!.id;
    const on = previewAction(
      s,
      { type: 'set-working', betId: id, working: 'on' },
      { rollsPerHour: 100 },
    );
    expect(on.perHourCents).toEqual(frac(on.perRollCents.n * 100n, on.perRollCents.d));
  });
});

describe('"Why?" rows count deciding combinations', () => {
  const ctx = (phase: 'come-out' | 'point' = 'point') => {
    const s = createGame({ seed: 1, phase, point: phase === 'point' ? 6 : undefined });
    return { phase: s.phase, point: s.point, rules: s.rules };
  };
  const ways = (type: Parameters<typeof explainBet>[0]['type'], amount: number) =>
    explainBet({ type, amount, point: null }, ctx()).rows.map((r) => `${r.ways}/${r.outOf}`);

  it('hard 4: 1 of 9 deciding rolls wins, 8 of 9 lose (loss row first)', () => {
    expect(ways('hard-4', 500)).toEqual(['8/9', '1/9']);
  });
  it('place 6: 5 of 11; place 4 keeps 3 of 9 (not reduced to 1 of 3)', () => {
    expect(ways('place-6', 1200)).toEqual(['5/11', '6/11']);
    expect(ways('place-4', 1000)).toEqual(['3/9', '6/9']);
  });
  it('one-roll bets use dice combinations out of 36', () => {
    expect(ways('any-craps', 500).sort()).toEqual(['32/36', '4/36']);
  });
  it('line bets keep exact reduced probabilities', () => {
    const rows = explainBet({ type: 'pass-line', amount: 1000, point: null }, ctx('come-out')).rows;
    expect(rows.find((r) => r.label === 'Win on 7 or 11')).toMatchObject({ ways: 8, outOf: 36 });
    expect(rows.find((r) => r.label === 'Point 4, then Win on 4')).toMatchObject({
      ways: 1,
      outOf: 36,
    });
  });
});

describe('explainBet tree', () => {
  const ctx = (s: ReturnType<typeof comeOut>) => ({
    phase: s.phase,
    point: s.point,
    rules: s.rules,
  });
  for (const type of ['pass-line', 'dont-pass', 'come', 'dont-come'] as const) {
    it(`${type}: leaves sum to 1 and EV matches betEV exactly`, () => {
      const s = comeOut();
      const bet = { type, amount: 1000, point: null } as const;
      const e = explainBet(bet, ctx(s));
      const tree = e.tree;
      expect(tree).toBeDefined();
      const leaves = [...tree!.comeOut, ...tree!.points.flatMap((p) => p.leaves)];
      const total = leaves.reduce((a, l) => add(a, l.probability), ZERO);
      expect(eq(total, ONE)).toBe(true);
      const ev = leaves.reduce((a, l) => add(a, mul(l.probability, l.net)), ZERO);
      expect(eq(ev, betEV(bet, ctx(s)))).toBe(true);
      expect(tree!.points.map((p) => p.point)).toEqual([4, 5, 6, 8, 9, 10]);
    });
  }
  it('pass line wins 244/495 overall and comes out 4/36, 8/36, 24/36', () => {
    const s = comeOut();
    const t = explainBet({ type: 'pass-line', amount: 1000, point: null }, ctx(s)).tree!;
    const win = [...t.comeOut, ...t.points.flatMap((p) => p.leaves)]
      .filter((l) => l.label.startsWith('Win'))
      .reduce((a, l) => add(a, l.probability), ZERO);
    expect(eq(win, frac(244, 495))).toBe(true);
    expect(t.comeOut.map((l) => fracText(l.probability))).toEqual(['1/9', '2/9']);
    expect(
      eq(
        t.points.reduce((a, p) => add(a, p.probability), ZERO),
        frac(2, 3),
      ),
    ).toBe(true);
  });
  it('has no tree for one-state bets', () => {
    const s = comeOut();
    expect(explainBet({ type: 'field', amount: 500, point: null }, ctx(s)).tree).toBeUndefined();
  });
});
