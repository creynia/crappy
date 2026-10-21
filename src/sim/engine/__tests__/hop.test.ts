import { describe, expect, it } from 'vitest';
import {
  ALL_HOPS,
  applyAction,
  BET_TYPES,
  createGame,
  equity,
  hopLabel,
  legalBetTypes,
  normalizeHop,
  replay,
  validateAction,
} from '../index';
import type { Action, Dice, GameState } from '../index';
import { $, D, act, game, roll } from './helpers';

const hop = (amount: number, d: Dice): Action => ({
  type: 'place-bet',
  betType: 'hop',
  amount: $(amount),
  hop: d,
});

describe('hop bets: registry', () => {
  it('is a one-roll prop that comes down after a win', () => {
    const def = BET_TYPES.hop;
    expect(def.category).toBe('prop');
    expect(def.oneRoll).toBe(true);
    expect(def.afterWin).toBe('comes-down');
    expect(def.unitMultiple).toBe(1);
    expect(def.describePayout(game().rules, null)).toMatch(/15 to 1.*30 to 1/);
  });
  it('lists the 21 distinct pairs low-high, 6 hard and 15 easy', () => {
    expect(ALL_HOPS).toHaveLength(21);
    expect(ALL_HOPS.every((d) => d[0] <= d[1])).toBe(true);
    expect(ALL_HOPS.filter((d) => d[0] === d[1])).toHaveLength(6);
    expect(normalizeHop(D(4, 2))).toEqual([2, 4]);
    expect(hopLabel(D(4, 2))).toBe('Hop 2-4');
    expect(hopLabel(D(3, 3))).toBe('Hop 3-3 (hard)');
  });
});

describe('hop bets: golden payouts', () => {
  it('$1 hard hop 3-3 rolled 3-3 wins +$30', () => {
    const s0 = act(game(), hop(1, D(3, 3))).state;
    const { state, events } = roll(s0, 3, 3);
    expect(equity(state) - equity(s0)).toBe($(30));
    expect(state.bankroll).toBe(s0.bankroll + $(31)); // bet comes down with the win
    expect(state.bets).toHaveLength(0);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'bet-won', betType: 'hop', profit: $(30), vig: 0 }),
    );
  });
  it('$2 easy hop 2-4 rolled 4-2 wins +$30', () => {
    const s0 = act(game(), hop(2, D(2, 4))).state;
    const { state } = roll(s0, 4, 2);
    expect(equity(state) - equity(s0)).toBe($(30));
  });
  it('the same total another way loses (2-4 on 1-5 and 3-3; 3-3 on 2-4)', () => {
    for (const [h, d] of [
      [D(2, 4), D(1, 5)],
      [D(2, 4), D(3, 3)],
      [D(3, 3), D(2, 4)],
    ] as const) {
      const s0 = act(game(), hop(5, h)).state;
      const { state, events } = roll(s0, d[0], d[1]);
      expect(equity(state) - equity(s0)).toBe(-$(5));
      expect(events).toContainEqual(expect.objectContaining({ type: 'bet-lost', betType: 'hop' }));
    }
  });
  it('several hops resolve on one roll, each on its own pair', () => {
    let s = game();
    for (const d of [D(1, 2), D(2, 1), D(5, 6), D(6, 6)]) s = act(s, hop(1, d)).state;
    expect(s.bets).toHaveLength(3); // 1-2 and 2-1 merged
    const s0 = s;
    const { state } = roll(s, 2, 1);
    // 1-2 ($2) wins 15:1 = +$30; 5-6 and 6-6 lose $1 each
    expect(equity(state) - equity(s0)).toBe($(30) - $(2));
    expect(state.stats.byType.hop).toMatchObject({ count: 3, won: $(30), lost: $(2) });
  });
  it('works on come-out and on a point, and is unaffected by the line', () => {
    const s0 = act(game({ point: 8 }), hop(1, D(4, 4))).state;
    const r = roll(s0, 4, 4);
    expect(equity(r.state) - equity(s0)).toBe($(30));
    expect(r.state.phase).toBe('come-out'); // point made
  });
});

describe('hop bets: validation', () => {
  it('needs a valid pair', () => {
    const g = game();
    for (const bad of [
      { type: 'place-bet', betType: 'hop', amount: $(1) },
      { type: 'place-bet', betType: 'hop', amount: $(1), hop: [0, 3] },
      { type: 'place-bet', betType: 'hop', amount: $(1), hop: [2, 7] },
      { type: 'place-bet', betType: 'hop', amount: $(1), hop: [2] },
      { type: 'place-bet', betType: 'hop', amount: $(1), hop: [2.5, 3] },
    ]) {
      const v = validateAction(g, bad as Action);
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.code).toBe('bad-dice');
    }
  });
  it('rejects a pair on any other bet', () => {
    const v = validateAction(game(), {
      type: 'place-bet',
      betType: 'any-7',
      amount: $(5),
      hop: D(3, 4),
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('bad-dice');
  });
  it('uses the prop minimum, table max and bankroll', () => {
    const g = game({ rules: { propMin: 200 } });
    expect(validateAction(g, hop(1, D(1, 2)))).toMatchObject({ ok: false, code: 'below-min' });
    expect(validateAction(g, hop(2, D(1, 2))).ok).toBe(true);
    expect(validateAction(game(), hop(5001, D(1, 2)))).toMatchObject({
      ok: false,
      code: 'above-max',
    });
    expect(validateAction(game({ bankroll: $(3) }), hop(4, D(1, 2)))).toMatchObject({
      ok: false,
      code: 'insufficient-funds',
    });
  });
  it('merges per pair (either order), and min/max count the merged total', () => {
    let s = act(game(), hop(1, D(4, 2))).state;
    expect(s.bets[0]!.hop).toEqual([2, 4]);
    const r = applyAction(s, hop(2, D(2, 4)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    s = r.state;
    expect(s.bets).toHaveLength(1);
    expect(s.bets[0]!.amount).toBe($(3));
    expect(r.events[0]).toMatchObject({ type: 'bet-amount-changed', from: $(1), to: $(3) });
    s = act(s, hop(1, D(3, 3))).state;
    expect(s.bets.map((b) => b.hop)).toEqual([
      [2, 4],
      [3, 3],
    ]);
    expect(validateAction(s, hop(4998, D(2, 4)))).toMatchObject({ ok: false, code: 'above-max' });
  });
  it('set-amount and remove-bet work on a hop like any prop', () => {
    let s = act(game(), hop(1, D(5, 6))).state;
    const id = s.bets[0]!.id;
    s = act(s, { type: 'set-amount', betId: id, amount: $(4) }).state;
    expect(s.bets[0]).toMatchObject({ amount: $(4), hop: [5, 6] });
    const before = s.bankroll;
    s = act(s, { type: 'remove-bet', betId: id }).state;
    expect(s.bankroll).toBe(before + $(4));
    expect(validateAction(s, { type: 'set-working', betId: id, working: 'off' }).ok).toBe(false);
  });
  it('is a legal bet type in every phase', () => {
    expect(legalBetTypes(game())).toContain('hop');
    expect(legalBetTypes(game({ point: 6 }))).toContain('hop');
  });
});

describe('hop bets: createGame BetInit', () => {
  it('places a hop from a BetInit with its pair normalized', () => {
    const g = createGame({ bets: [{ type: 'hop', amount: $(1), hop: D(6, 1) }] });
    expect(g.bets[0]).toMatchObject({ type: 'hop', hop: [1, 6] });
  });
  it('allows two pairs but rejects the same pair twice and a missing pair', () => {
    expect(
      createGame({
        bets: [
          { type: 'hop', amount: $(1), hop: D(1, 6) },
          { type: 'hop', amount: $(1), hop: D(2, 5) },
        ],
      }).bets,
    ).toHaveLength(2);
    expect(() =>
      createGame({
        bets: [
          { type: 'hop', amount: $(1), hop: D(1, 6) },
          { type: 'hop', amount: $(1), hop: D(6, 1) },
        ],
      }),
    ).toThrow(/duplicate/);
    expect(() => createGame({ bets: [{ type: 'hop', amount: $(1) }] })).toThrow(/pair/);
    expect(() => createGame({ bets: [{ type: 'field', amount: $(5), hop: D(1, 1) }] })).toThrow(
      /pair/,
    );
  });
});

describe('hop bets: determinism and backward compatibility', () => {
  it('replay with hop actions is deterministic', () => {
    const actions: Action[] = [];
    for (let i = 0; i < 60; i++) {
      const d = ALL_HOPS[i % 21]!;
      actions.push(hop(1 + (i % 3), i % 2 ? [d[1], d[0]] : d), { type: 'roll' });
    }
    const a = replay(game({ seed: 99 }), actions);
    const b = replay(game({ seed: 99 }), actions);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.stats.byType.hop?.count).toBe(60);
  });
  it('non-hop bets carry no hop field, so saved states are unchanged', () => {
    const s = act(game(), { type: 'place-bet', betType: 'field', amount: $(5) }).state;
    expect('hop' in s.bets[0]!).toBe(false);
  });
  it('a state saved before hop bets existed still loads and plays', () => {
    // Built by hand in the old shape: no `hop` keys anywhere.
    const old = JSON.parse(
      JSON.stringify(
        act(act(game(), { type: 'place-bet', betType: 'pass-line', amount: $(10) }).state, {
          type: 'place-bet',
          betType: 'any-7',
          amount: $(5),
        }).state,
      ),
    ) as GameState;
    expect(JSON.stringify(old)).not.toContain('hop');
    const s = act(old, hop(1, D(1, 1))).state;
    const r = roll(s, 3, 4);
    expect(r.state.bets.map((b) => b.type)).toEqual(['pass-line']);
  });
});
