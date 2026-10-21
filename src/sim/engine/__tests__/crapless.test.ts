import { describe, expect, it } from 'vitest';
import {
  BET_TYPE_IDS,
  BET_TYPES,
  CRAPLESS_BET_TYPE_IDS,
  CRAPLESS_POINTS,
  applyAction,
  betTypeAvailable,
  pointsFor,
  resolveRules,
  validateAction,
} from '../index';
import type { Bet, BetTypeId, PointNumber, Resolution } from '../index';
import { $, act, bet, game, roll } from './helpers';
import { oracle, type OracleRules } from './oracle';

const CR = resolveRules('crapless');
const crapless = (opts: Parameters<typeof game>[0] = {}) => game({ rules: 'crapless', ...opts });

// ---------------------------------------------------------------------------
// Independent crapless oracle (written from the rules, not from bets.ts)
// ---------------------------------------------------------------------------

/** Profit [num, den] per point: true odds and place pays on a crapless table. */
const TRUE: Record<number, [number, number]> = {
  2: [6, 1],
  3: [3, 1],
  4: [2, 1],
  5: [3, 2],
  6: [6, 5],
  8: [6, 5],
  9: [3, 2],
  10: [2, 1],
  11: [3, 1],
  12: [6, 1],
};
const PLACE: Record<number, [number, number]> = {
  2: [11, 2],
  3: [11, 4],
  4: [9, 5],
  5: [7, 5],
  6: [7, 6],
  8: [7, 6],
  9: [7, 5],
  10: [9, 5],
  11: [11, 4],
  12: [11, 2],
};
const pay = (a: number, [x, y]: [number, number]) => Math.floor((a * x) / y);

/** Crapless resolution of the bets the variant changes; null = not one of them. */
function craplessOracle(
  type: BetTypeId,
  amount: number,
  betPoint: PointNumber | null,
  phase: 'come-out' | 'point',
  point: PointNumber | null,
  total: number,
  working: boolean,
): Resolution | null {
  const win = (profit: number): Resolution => ({ kind: 'win', profit, vig: 0 });
  switch (type) {
    case 'pass-line':
      if (phase === 'come-out') return total === 7 ? win(amount) : { kind: 'none' };
      if (total === point) return win(amount);
      return total === 7 ? { kind: 'lose' } : { kind: 'none' };
    case 'come':
      if (betPoint === null)
        return total === 7 ? win(amount) : { kind: 'travel', point: total as PointNumber };
      if (total === betPoint) return win(amount);
      return total === 7 ? { kind: 'lose' } : { kind: 'none' };
    case 'pass-odds':
    case 'come-odds': {
      const p = betPoint ?? point;
      if (p === null) return { kind: 'none' };
      if (type === 'come-odds' && !working)
        return total === 7 || total === p
          ? { kind: 'return', reason: 'odds-off' }
          : { kind: 'none' };
      if (total === p) return win(pay(amount, TRUE[p]!));
      return total === 7 ? { kind: 'lose' } : { kind: 'none' };
    }
    default: {
      const m = /^place-(\d+)$/.exec(type);
      if (!m) return null;
      const n = Number(m[1]);
      if (!working) return { kind: 'none' };
      if (total === n) return win(pay(amount, PLACE[n]!));
      return total === 7 ? { kind: 'lose' } : { kind: 'none' };
    }
  }
}

const ORULES: OracleRules = {
  payoutUnit: CR.payoutUnit,
  vigTiming: CR.vig.timing,
  vigRounding: CR.vig.rounding,
  field2: CR.fieldPays[2],
  field12: CR.fieldPays[12],
};

describe('crapless rules', () => {
  it('preset: variant crapless, 3-4-5x extended to 1x on 2/12 and 2x on 3/11', () => {
    expect(CR.variant).toBe('crapless');
    expect(CR.presetId).toBe('crapless');
    expect(CR.maxOdds).toEqual({ 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 });
    expect(resolveRules().variant).toBe('standard');
    expect(pointsFor(CR)).toEqual([2, 3, 4, 5, 6, 8, 9, 10, 11, 12]);
    expect(pointsFor(resolveRules())).toEqual([4, 5, 6, 8, 9, 10]);
  });

  it("no don't side in crapless; place 2/3/11/12 only in crapless", () => {
    for (const t of [
      'dont-pass',
      'dont-come',
      'dont-pass-odds',
      'dont-come-odds',
      'fire',
    ] as BetTypeId[])
      expect(betTypeAvailable(t, CR)).toBe(false);
    for (const t of ['all', 'tall', 'small'] as BetTypeId[])
      expect(betTypeAvailable(t, CR)).toBe(true);
    for (const t of CRAPLESS_BET_TYPE_IDS) {
      expect(betTypeAvailable(t, CR)).toBe(true);
      expect(betTypeAvailable(t, resolveRules())).toBe(false);
    }
    const dp = validateAction(crapless(), {
      type: 'place-bet',
      betType: 'dont-pass',
      amount: $(10),
    });
    expect(dp).toMatchObject({ ok: false, code: 'unknown-bet' });
    expect(!dp.ok && dp.message).toContain("no don't side");
    const p2 = validateAction(game(), { type: 'place-bet', betType: 'place-2', amount: $(10) });
    expect(p2).toMatchObject({ ok: false, code: 'unknown-bet' });
    expect(!p2.ok && p2.message).toContain('crapless');
    expect(BET_TYPE_IDS).not.toContain('place-2');
  });
});

describe('crapless resolution matrix', () => {
  const states: Array<['come-out' | 'point', PointNumber | null]> = [
    ['come-out', null],
    ...CRAPLESS_POINTS.map((p): ['point', PointNumber] => ['point', p]),
  ];
  const types = [...BET_TYPE_IDS, ...CRAPLESS_BET_TYPE_IDS].filter((t) => betTypeAvailable(t, CR));
  for (const type of types) {
    it(`${type}: every crapless state x 36 dice x working on/off`, () => {
      const def = BET_TYPES[type];
      const cat = def.category;
      const betPoints: (PointNumber | null)[] =
        type === 'come'
          ? [null, ...CRAPLESS_POINTS]
          : cat === 'odds'
            ? [...CRAPLESS_POINTS]
            : [null];
      const bad: string[] = [];
      let checked = 0;
      for (const [phase, point] of states) {
        for (const bp of betPoints) {
          if (type === 'pass-odds' && (phase !== 'point' || bp !== point)) continue;
          const amount = 6000 * def.unitMultiple;
          for (const working of [true, false]) {
            for (let d1 = 1; d1 <= 6; d1++) {
              for (let d2 = 1; d2 <= 6; d2++) {
                const total = d1 + d2;
                const b = { type, amount, point: bp, vigPaid: 0 } as Bet;
                const got = def.resolve(
                  b,
                  { dice: [d1 as 1, d2 as 1], total, hard: d1 === d2, phase, point },
                  CR,
                  working,
                );
                // Bets the variant does not touch must resolve exactly as on a standard table.
                const want =
                  craplessOracle(type, amount, bp, phase, point, total, working) ??
                  oracle({
                    type,
                    amount,
                    betPoint: bp,
                    phase,
                    point,
                    d1,
                    d2,
                    working,
                    upfrontPaid: false,
                    rules: ORULES,
                  });
                checked++;
                if (JSON.stringify(got) !== JSON.stringify(want))
                  bad.push(
                    `${phase}/${point} bp=${bp} w=${working} ${d1}-${d2}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`,
                  );
              }
            }
          }
        }
      }
      expect(bad.slice(0, 5)).toEqual([]);
      expect(checked).toBeGreaterThan(0);
    });
  }
});

describe('crapless game flow', () => {
  it('come-out: 7 wins, 11 and 2/3/12 set the point (no naturals but 7, no craps)', () => {
    for (const [a, b] of [
      [1, 1],
      [1, 2],
      [5, 6],
      [6, 6],
    ]) {
      const s = bet(crapless(), 'pass-line', 10);
      const r = roll(s, a!, b!);
      expect(r.state.phase).toBe('point');
      expect(r.state.point).toBe(a! + b!);
      expect(r.events.some((e) => e.type === 'craps' || e.type === 'natural')).toBe(false);
      expect(r.events).toContainEqual({ type: 'point-established', point: a! + b! });
      expect(r.state.bets).toHaveLength(1);
    }
    const seven = roll(bet(crapless(), 'pass-line', 10), 3, 4);
    expect(seven.events).toContainEqual({ type: 'natural', total: 7 });
    expect(seven.state.bankroll).toBe($(1000)); // $990 in the rack + $10 profit; the flat stays up
  });

  it('point 2: odds pay 6 to 1, place 2 pays 11 to 2, making the point pays the line', () => {
    let s = roll(bet(crapless(), 'pass-line', 10), 1, 1).state; // point 2
    s = bet(s, 'pass-odds', 10); // max 1x
    expect(applyAction(s, { type: 'place-bet', betType: 'pass-odds', amount: $(1) })).toMatchObject(
      { ok: false, error: { code: 'odds-limit' } },
    );
    s = bet(s, 'place-12', 10);
    s = bet(s, 'place-3', 20);
    const before = s.bankroll;
    const r = roll(s, 1, 1);
    expect(r.events).toContainEqual({ type: 'point-made', point: 2 });
    const won = (t: BetTypeId) => r.events.find((e) => e.type === 'bet-won' && e.betType === t);
    expect(won('pass-line')).toMatchObject({ profit: $(10) });
    expect(won('pass-odds')).toMatchObject({ profit: $(60) });
    // line profit $10 (the flat stays up), odds $10 back + $60
    expect(r.state.bankroll).toBe(before + $(10) + $(70));
    const p12 = roll(r.state, 6, 6); // come-out 12 (place bets off): point 12
    expect(p12.state.point).toBe(12);
    const hit = roll(p12.state, 6, 6);
    expect(hit.events.find((e) => e.type === 'bet-won' && e.betType === 'place-12')).toMatchObject({
      profit: $(55),
    });
    const three = roll(hit.state, 1, 2); // come-out again: point 3
    const h3 = roll(three.state, 2, 1);
    expect(h3.events.find((e) => e.type === 'bet-won' && e.betType === 'place-3')).toMatchObject({
      profit: $(55),
    });
  });

  it('a come bet travels to 11 and its odds pay 3 to 1', () => {
    let s = roll(bet(crapless(), 'pass-line', 10), 2, 2).state; // point 4
    s = bet(s, 'come', 10);
    const t = roll(s, 5, 6);
    expect(t.events).toContainEqual(
      expect.objectContaining({ type: 'bet-travelled', betType: 'come', point: 11 }),
    );
    const come = t.state.bets.find((b) => b.type === 'come')!;
    s = act(t.state, {
      type: 'place-bet',
      betType: 'come-odds',
      amount: $(20),
      parentId: come.id,
    }).state;
    const r = roll(s, 6, 5);
    expect(r.events.find((e) => e.type === 'bet-won' && e.betType === 'come-odds')).toMatchObject({
      profit: $(60),
    });
  });

  it('createGame accepts crapless points and rejects them on a standard table', () => {
    expect(() => crapless({ bets: [{ type: 'come', amount: $(10), point: 2 }] })).not.toThrow();
    expect(() => game({ bets: [{ type: 'come', amount: $(10), point: 2 }] })).toThrow();
  });
});

describe('crapless Markov cross-check', () => {
  // Value iteration over the hand's states (come-out, point n): P(pass wins) from the dice alone.
  it('P(pass wins) by iteration matches 6557/13860 and the seeded engine within 1%', () => {
    const ways = (t: number) => 6 - Math.abs(7 - t);
    let comeOut = 0;
    const onPoint: Record<number, number> = {};
    for (const p of CRAPLESS_POINTS) onPoint[p] = 0;
    for (let i = 0; i < 2000; i++) {
      for (const p of CRAPLESS_POINTS)
        onPoint[p] = ways(p) / 36 + (1 - ways(p) / 36 - 6 / 36) * onPoint[p]!;
      let c = 6 / 36;
      for (const p of CRAPLESS_POINTS) c += (ways(p) / 36) * onPoint[p]!;
      comeOut = c;
    }
    expect(comeOut).toBeCloseTo(6557 / 13860, 12);

    // Seeded play: flat $10 pass line every hand.
    let s = crapless({ seed: 2024, bankroll: $(10_000_000) });
    let hands = 0;
    let wins = 0;
    while (hands < 40_000) {
      if (s.phase === 'come-out' && !s.bets.length) s = bet(s, 'pass-line', 10);
      const r = act(s, { type: 'roll' });
      for (const e of r.events) {
        if (e.type === 'bet-won') {
          hands++;
          wins++;
        } else if (e.type === 'bet-lost') hands++;
      }
      s = r.state;
    }
    expect(Math.abs(wins / hands - 6557 / 13860)).toBeLessThan(0.01);
  });
});
