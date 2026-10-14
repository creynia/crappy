import { describe, expect, it } from 'vitest';
import {
  BET_TYPE_IDS,
  applyAction,
  legalBetTypes,
  maxOddsAmount,
  suggestAmount,
  validateAction,
} from '../index';
import type { Action, GameState, ValidationCode } from '../index';
import { $, act, bet, game, roll } from './helpers';

const place = (betType: Parameters<typeof bet>[1], dollars: number, parentId?: string): Action => ({
  type: 'place-bet',
  betType,
  amount: $(dollars),
  ...(parentId ? { parentId } : {}),
});

function code(s: GameState, a: Action): ValidationCode | 'ok' {
  const v = validateAction(s, a);
  return v.ok ? 'ok' : v.code;
}
function warns(s: GameState, a: Action): string[] {
  const v = validateAction(s, a);
  return v.ok ? v.warnings.map((w) => w.code) : [];
}
const pointState = (extra: Parameters<typeof game>[0] = {}) =>
  game({ phase: 'point', point: 6, ...extra });

describe('validation codes', () => {
  it('unknown-bet', () => {
    expect(code(game(), place('nope' as never, 10))).toBe('unknown-bet');
    expect(code(game(), { type: 'remove-bet', betId: 'zz' })).toBe('unknown-bet');
    expect(code(game(), { type: 'set-amount', betId: 'zz', amount: 500 })).toBe('unknown-bet');
  });
  it('bad-amount', () => {
    for (const amount of [0, -500, 550, 1.5, NaN]) {
      expect(code(game(), { type: 'place-bet', betType: 'pass-line', amount })).toBe('bad-amount');
    }
    expect(code(game(), { type: 'roll', dice: [7, 1] as never })).toBe('bad-amount');
  });
  it('below-min / above-max (tableMin $5, propMin $1, hardways use propMin)', () => {
    expect(code(game(), place('pass-line', 4))).toBe('below-min');
    expect(code(game(), place('pass-line', 5))).toBe('ok');
    expect(code(pointState(), place('place-6', 4))).toBe('below-min');
    expect(code(game(), place('any-7', 1))).toBe('ok');
    expect(code(pointState(), place('hard-6', 1))).toBe('ok');
    expect(code(game({ bankroll: $(9000) }), place('pass-line', 5001))).toBe('above-max');
  });
  it('insufficient-funds', () => {
    expect(code(game({ bankroll: $(10) }), place('pass-line', 15))).toBe('insufficient-funds');
    const up = game({
      bankroll: $(20),
      rules: { vig: { rate: 0.05, timing: 'upfront', rounding: 'floor-dollar-min-1' } },
    });
    expect(code(up, place('buy-4', 20))).toBe('insufficient-funds'); // 20 + $1 vig
  });
  it('wrong-phase', () => {
    expect(code(game(), place('come', 10))).toBe('wrong-phase');
    expect(code(game(), place('dont-come', 10))).toBe('wrong-phase');
    expect(code(pointState(), place('pass-line', 10))).toBe('wrong-phase');
    expect(code(pointState(), place('dont-pass', 10))).toBe('wrong-phase');
    expect(code(pointState({ rules: { allowPutBets: true } }), place('pass-line', 10))).toBe('ok');
  });
  it('needs-parent', () => {
    expect(code(game(), place('pass-odds', 10))).toBe('needs-parent');
    expect(code(pointState(), place('pass-odds', 10))).toBe('needs-parent'); // no pass line
    expect(code(pointState(), place('dont-pass-odds', 10))).toBe('needs-parent');
    expect(code(pointState(), place('come-odds', 10))).toBe('needs-parent');
    const s = bet(pointState(), 'come', 10);
    const id = s.bets[0]!.id;
    expect(code(s, place('come-odds', 10, id))).toBe('needs-parent'); // still in the box
  });
  it('odds-limit per preset (3-4-5x, 10x, 100x; lay 6x/12x/120x)', () => {
    const mk = (rules: Parameters<typeof game>[0], p: 4 | 5 | 6) =>
      game({ ...rules, phase: 'point', point: p, bets: [{ type: 'pass-line', amount: $(10) }] });
    expect(code(mk({}, 4), place('pass-odds', 30))).toBe('ok');
    expect(code(mk({}, 4), place('pass-odds', 31))).toBe('odds-limit');
    expect(code(mk({}, 5), place('pass-odds', 40))).toBe('ok');
    expect(code(mk({}, 5), place('pass-odds', 41))).toBe('odds-limit');
    expect(code(mk({}, 6), place('pass-odds', 50))).toBe('ok');
    expect(code(mk({}, 6), place('pass-odds', 51))).toBe('odds-limit');
    expect(code(mk({ rules: 'odds-10x' }, 6), place('pass-odds', 100))).toBe('ok');
    expect(code(mk({ rules: 'odds-10x' }, 6), place('pass-odds', 101))).toBe('odds-limit');
    expect(code(mk({ rules: 'odds-100x', bankroll: $(5000) }, 4), place('pass-odds', 1000))).toBe(
      'ok',
    );
    expect(code(mk({ rules: 'odds-100x', bankroll: $(5000) }, 4), place('pass-odds', 1001))).toBe(
      'odds-limit',
    );
    const dp = (rules: Parameters<typeof game>[0]) =>
      game({ ...rules, phase: 'point', point: 4, bets: [{ type: 'dont-pass', amount: $(10) }] });
    expect(code(dp({}), place('dont-pass-odds', 60))).toBe('ok');
    expect(code(dp({}), place('dont-pass-odds', 61))).toBe('odds-limit');
    expect(code(dp({ rules: 'odds-10x' }), place('dont-pass-odds', 200))).toBe('ok');
    expect(code(dp({ rules: 'odds-10x' }), place('dont-pass-odds', 201))).toBe('odds-limit');
    expect(code(dp({ rules: 'odds-100x', bankroll: $(5000) }), place('dont-pass-odds', 2000))).toBe(
      'ok',
    );
  });
  it('odds-limit counts existing odds (merge) and maxOddsAmount reports the cap', () => {
    let s = game({
      phase: 'point',
      point: 5,
      bets: [{ type: 'pass-line', amount: $(10), ref: 'f' }],
    });
    s = bet(s, 'pass-odds', 30);
    expect(code(s, place('pass-odds', 11))).toBe('odds-limit');
    expect(code(s, place('pass-odds', 10))).toBe('ok');
    expect(maxOddsAmount(s, s.bets[0]!.id)).toBe($(40));
    expect(maxOddsAmount(s, 'nope')).toBe(0);
  });
  it('contract-bet', () => {
    const s = game({ phase: 'point', point: 6, bets: [{ type: 'pass-line', amount: $(10) }] });
    const id = s.bets[0]!.id;
    expect(code(s, { type: 'remove-bet', betId: id })).toBe('contract-bet');
    expect(code(s, { type: 'set-amount', betId: id, amount: $(5) })).toBe('contract-bet');
    let c = bet(pointState(), 'come', 10);
    c = roll(c, 2, 3).state; // travels to 5
    const cid = c.bets.find((b) => b.type === 'come')!.id;
    expect(c.bets.find((b) => b.id === cid)!.point).toBe(5);
    expect(code(c, { type: 'remove-bet', betId: cid })).toBe('contract-bet');
    expect(code(c, { type: 'set-amount', betId: cid, amount: $(15) })).toBe('contract-bet');
  });
  it('cannot-increase', () => {
    const s = game({ phase: 'point', point: 6, bets: [{ type: 'dont-pass', amount: $(10) }] });
    const id = s.bets[0]!.id;
    expect(code(s, { type: 'set-amount', betId: id, amount: $(15) })).toBe('cannot-increase');
    expect(code(s, { type: 'set-amount', betId: id, amount: $(5) })).toBe('ok');
    const pl = game({ phase: 'point', point: 6, bets: [{ type: 'pass-line', amount: $(10) }] });
    expect(code(pl, { type: 'set-amount', betId: pl.bets[0]!.id, amount: $(15) })).toBe(
      'cannot-increase',
    );
    const put = game({
      phase: 'point',
      point: 6,
      rules: { allowPutBets: true },
      bets: [{ type: 'pass-line', amount: $(10) }],
    });
    expect(code(put, { type: 'set-amount', betId: put.bets[0]!.id, amount: $(15) })).toBe('ok');
    let d = bet(pointState(), 'dont-come', 10);
    d = roll(d, 2, 3).state;
    expect(code(d, { type: 'set-amount', betId: d.bets[0]!.id, amount: $(15) })).toBe(
      'cannot-increase',
    );
  });
  it('not-removable: only toggleable bets accept set-working', () => {
    let s = bet(pointState(), 'field', 10);
    expect(code(s, { type: 'set-working', betId: s.bets[0]!.id, working: 'off' })).toBe(
      'not-removable',
    );
    s = bet(pointState(), 'place-6', 12);
    expect(code(s, { type: 'set-working', betId: s.bets[0]!.id, working: 'off' })).toBe('ok');
  });
  it('unit-multiple', () => {
    expect(code(game(), place('horn', 5))).toBe('unit-multiple');
    expect(code(game(), place('horn', 8))).toBe('ok');
    expect(code(game(), place('world', 7))).toBe('unit-multiple');
    expect(code(game(), place('world', 10))).toBe('ok');
    expect(code(game(), place('c-e', 3))).toBe('unit-multiple');
    expect(code(game(), place('c-e', 4))).toBe('ok');
  });
  it('roll is always valid', () => {
    expect(code(game(), { type: 'roll' })).toBe('ok');
  });
});

describe('warnings', () => {
  it('short-pay with suggested amounts', () => {
    const w = validateAction(pointState(), place('place-6', 5));
    expect(w.ok && w.warnings[0]).toMatchObject({ code: 'short-pay', suggestedAmount: $(6) });
    expect(w.ok && w.warnings[0]!.message).toContain('$5.83');
    expect(warns(pointState(), place('place-6', 12))).toEqual([]);
    expect(warns(pointState(), place('place-5', 10))).toEqual([]);
    expect(warns(pointState(), place('place-5', 11))).toContain('short-pay');
    expect(warns(pointState(), place('place-8', 7))).toContain('short-pay');
    expect(warns(pointState(), place('buy-5', 25))).toContain('short-pay');
    expect(warns(pointState(), place('lay-5', 40))).toContain('short-pay');
    expect(warns(pointState(), place('lay-6', 30))).toEqual([]);
    expect(warns(pointState(), place('lay-6', 25))).toContain('short-pay');
    const odds = pointState({ bets: [{ type: 'pass-line', amount: $(10) }] });
    expect(warns(odds, place('pass-odds', 11))).toContain('short-pay'); // point 6 needs $5 units
    expect(warns(odds, place('pass-odds', 15))).toEqual([]);
    const lay5 = game({ phase: 'point', point: 5, bets: [{ type: 'dont-pass', amount: $(10) }] });
    expect(warns(lay5, place('dont-pass-odds', 31))).toContain('short-pay'); // 3 unit
  });
  it('vig-rounding', () => {
    const w = validateAction(pointState(), place('buy-4', 10));
    expect(w.ok && w.warnings.find((x) => x.code === 'vig-rounding')).toMatchObject({
      suggestedAmount: $(20),
    });
    expect(warns(pointState(), place('buy-4', 20))).toEqual([]);
    expect(warns(pointState(), place('buy-4', 25))).toEqual([]);
    expect(warns(pointState(), place('lay-4', 20))).toContain('vig-rounding');
    expect(warns(pointState(), place('lay-4', 40))).toEqual([]);
    expect(
      warns(
        pointState({ rules: { vig: { rate: 0.05, timing: 'on-win', rounding: 'exact-cents' } } }),
        place('buy-4', 10),
      ),
    ).toEqual([]);
  });
  it('off-on-come-out', () => {
    expect(warns(game(), place('place-6', 12))).toContain('off-on-come-out');
    expect(warns(game(), place('buy-4', 20))).toContain('off-on-come-out');
    expect(warns(game(), place('hard-6', 5))).toContain('off-on-come-out');
    expect(
      warns(game({ rules: { placeBetsWorkOnComeOut: true } }), place('place-6', 12)),
    ).not.toContain('off-on-come-out');
    expect(warns(pointState(), place('place-6', 12))).not.toContain('off-on-come-out');
    expect(warns(game(), place('field', 10))).toEqual([]);
  });
  it('gives-up-ev', () => {
    const s = game({ phase: 'point', point: 4, bets: [{ type: 'dont-pass', amount: $(10) }] });
    expect(warns(s, { type: 'remove-bet', betId: s.bets[0]!.id })).toContain('gives-up-ev');
    expect(warns(s, { type: 'set-amount', betId: s.bets[0]!.id, amount: $(5) })).toContain(
      'gives-up-ev',
    );
    const co = bet(game(), 'dont-pass', 10);
    expect(warns(co, { type: 'remove-bet', betId: co.bets[0]!.id })).toEqual([]);
  });
});

describe('suggestAmount', () => {
  const s = pointState();
  it('bumps to full-pay units and to the vig-efficient minimum', () => {
    expect(suggestAmount('place-6', $(5), s)).toBe($(6));
    expect(suggestAmount('place-6', $(12), s)).toBe($(12));
    expect(suggestAmount('place-5', $(7), s)).toBe($(10));
    expect(suggestAmount('buy-4', $(10), s)).toBe($(20));
    expect(suggestAmount('buy-5', $(10), s)).toBe($(20));
    expect(suggestAmount('buy-6', $(5), s)).toBe($(20));
    expect(suggestAmount('buy-4', $(30), s)).toBe($(30));
    expect(suggestAmount('lay-4', $(10), s)).toBe($(40));
    expect(suggestAmount('lay-5', $(10), s)).toBe($(30));
    expect(suggestAmount('lay-9', $(10), s)).toBe($(30));
    expect(suggestAmount('lay-6', $(10), s)).toBe($(24));
    expect(suggestAmount('lay-8', $(25), s)).toBe($(30));
    expect(suggestAmount('horn', $(5), s)).toBe($(8));
    expect(suggestAmount('field', $(5), s)).toBe($(5));
  });
});

describe('suggestAmount for odds and minimums', () => {
  it('uses the parent bet number, not the table point', () => {
    let s = game({ phase: 'point', point: 6 });
    s = bet(s, 'come', 10);
    s = roll(s, 2, 3).state; // travels to 5
    s = bet(s, 'come', 10);
    const id = s.bets.find((b) => b.type === 'come' && b.point === 5)!.id;
    expect(suggestAmount('come-odds', $(5), s, { parentId: id })).toBe($(6)); // 3:2 -> $2 units
    expect(suggestAmount('come-odds', $(5), s, { point: 6 })).toBe($(5)); // 6:5 -> $5 units
    expect(suggestAmount('come-odds', $(5), s, { point: 5 })).toBe($(6));
  });
  it('respects table and prop minimums', () => {
    const s = game({ phase: 'point', point: 6 });
    expect(suggestAmount('place-6', $(1), s)).toBe($(6));
    expect(suggestAmount('place-5', $(1), s)).toBe($(5));
    expect(suggestAmount('pass-line', $(1), s)).toBe($(5));
    expect(suggestAmount('hard-6', $(1), s)).toBe($(1));
    expect(suggestAmount('any-7', 0, s)).toBe($(1));
  });
});

describe('input checks', () => {
  it('roll needs exactly two valid dice', () => {
    expect(code(game(), { type: 'roll', dice: [1, 2, 3] as never })).toBe('bad-amount');
    expect(code(game(), { type: 'roll', dice: [1] as never })).toBe('bad-amount');
    expect(code(game(), { type: 'roll', dice: [1, 6] })).toBe('ok');
  });
  it('set-working rejects unknown values with not-removable, not bad-amount', () => {
    const s = bet(pointState(), 'place-6', 12);
    expect(code(s, { type: 'set-working', betId: s.bets[0]!.id, working: 'maybe' as never })).toBe(
      'not-removable',
    );
  });
});

describe('legalBetTypes', () => {
  it('come-out vs point', () => {
    const co = legalBetTypes(game());
    expect(co).toContain('pass-line');
    expect(co).toContain('dont-pass');
    expect(co).not.toContain('come');
    expect(co).not.toContain('pass-odds');
    expect(co).toContain('buy-5');
    expect(co).toContain('world');
    const pt = legalBetTypes(pointState({ bets: [{ type: 'pass-line', amount: $(10) }] }));
    expect(pt).not.toContain('pass-line');
    expect(pt).toContain('come');
    expect(pt).toContain('pass-odds');
    expect(pt).not.toContain('dont-pass-odds');
    expect(pt).not.toContain('come-odds');
    expect(legalBetTypes(game()).every((t) => BET_TYPE_IDS.includes(t))).toBe(true);
  });
});

describe('applyAction mechanics', () => {
  it('rejects invalid actions with the state untouched', () => {
    const s = game();
    const r = applyAction(s, place('come', 10));
    expect(r.ok).toBe(false);
    expect(r.state).toBe(s);
  });
  it('placing again merges into one bet', () => {
    let s = bet(game(), 'pass-line', 10);
    s = bet(s, 'pass-line', 5);
    expect(s.bets).toHaveLength(1);
    expect(s.bets[0]!.amount).toBe($(15));
    expect(s.bankroll).toBe($(1000 - 15));
  });
  it('set-amount moves money; remove refunds and takes odds with it', () => {
    let s = game({ phase: 'point', point: 6, bets: [{ type: 'dont-pass', amount: $(10) }] });
    s = bet(s, 'dont-pass-odds', 30);
    const flat = s.bets[0]!.id;
    const down = act(s, { type: 'set-amount', betId: flat, amount: $(5) });
    expect(code(s, { type: 'set-amount', betId: flat, amount: $(5) })).toBe('ok');
    expect(down.state.bankroll).toBe(s.bankroll + $(5));
    const gone = act(s, { type: 'remove-bet', betId: flat });
    expect(gone.state.bets).toHaveLength(0);
    expect(gone.state.bankroll).toBe($(1000));
    expect(gone.events.filter((e) => e.type === 'bet-removed')).toHaveLength(2);
  });
  it('upfront vig is charged, adjusted and refunded', () => {
    const rules = {
      vig: { rate: 0.05, timing: 'upfront' as const, rounding: 'floor-dollar-min-1' as const },
    };
    let s = game({ rules, phase: 'point', point: 6 });
    s = bet(s, 'buy-4', 20);
    expect(s.bankroll).toBe($(1000 - 21));
    expect(s.bets[0]!.vigPaid).toBe($(1));
    const id = s.bets[0]!.id;
    s = act(s, { type: 'set-amount', betId: id, amount: $(40) }).state;
    expect(s.bankroll).toBe($(1000 - 42));
    s = act(s, { type: 'remove-bet', betId: id }).state;
    expect(s.bankroll).toBe($(1000));
    expect(s.stats.totalVig).toBe(0);
  });
  it('set-working toggles and changes behaviour', () => {
    let s = bet(game(), 'place-6', 12);
    const id = s.bets[0]!.id;
    s = act(s, { type: 'set-working', betId: id, working: 'on' }).state;
    const r = roll(s, 3, 3);
    expect(r.events.some((e) => e.type === 'bet-won')).toBe(true);
  });
});
