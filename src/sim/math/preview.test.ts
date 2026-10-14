import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/game';
import { frac, toNumber } from './fraction';
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
