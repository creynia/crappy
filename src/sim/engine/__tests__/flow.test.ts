import { describe, expect, it } from 'vitest';
import { applyAction, createGame, equity, isWorking, replay, resolveRoll, seedRng } from '../index';
import type { Action, GameEvent, GameState } from '../index';
import { $, act, bet, betsOf, deepFreeze, game, roll, rollTotals } from './helpers';

const types = (ev: GameEvent[]) => ev.map((e) => e.type);

describe('phase flow', () => {
  it('natural, craps, point established, point made', () => {
    let s = game();
    let r = roll(s, 3, 4);
    expect(types(r.events)).toEqual(['natural', 'dice-rolled']);
    expect(r.state.phase).toBe('come-out');
    r = roll(r.state, 1, 1);
    expect(r.events[0]).toEqual({ type: 'craps', total: 2 });
    r = roll(r.state, 5, 6);
    expect(r.events[0]).toEqual({ type: 'natural', total: 11 });
    r = roll(r.state, 2, 4);
    expect(r.events[0]).toEqual({ type: 'point-established', point: 6 });
    expect(r.state).toMatchObject({ phase: 'point', point: 6 });
    r = roll(r.state, 1, 2); // nothing
    expect(types(r.events)).toEqual(['dice-rolled']);
    r = roll(r.state, 4, 2);
    expect(r.events[0]).toEqual({ type: 'point-made', point: 6 });
    expect(r.state).toMatchObject({ phase: 'come-out', point: null });
    s = rollTotals(r.state, [2, 2], [3, 4]);
    expect(types(roll(s, 1, 1).events)).toContain('craps');
  });

  it('seven-out', () => {
    const s = game({ phase: 'point', point: 8 });
    const r = roll(s, 3, 4);
    expect(r.events[0]).toEqual({ type: 'seven-out', point: 8 });
    expect(r.state.phase).toBe('come-out');
  });

  it('pass line stays up after a win and keeps working next hand; loses on seven-out', () => {
    let s = bet(game(), 'pass-line', 10);
    s = roll(s, 3, 4).state;
    expect(s.bets).toHaveLength(1);
    expect(s.bankroll).toBe($(1000 - 10 + 10));
    s = rollTotals(s, [2, 2]);
    s = rollTotals(s, [3, 4]);
    expect(s.bets).toHaveLength(0);
    expect(equity(s)).toBe($(1000));
  });

  it('dont-pass: 12 pushes and stays; 7 on come-out loses', () => {
    let s = bet(game(), 'dont-pass', 10);
    const r = roll(s, 6, 6);
    expect(types(r.events)).toContain('bet-pushed');
    expect(r.state.bets).toHaveLength(1);
    expect(equity(r.state)).toBe($(1000));
    s = roll(r.state, 3, 4).state;
    expect(s.bets).toHaveLength(0);
    expect(equity(s)).toBe($(990));
  });

  it('field and props come down after one roll; place/hard/big stay up', () => {
    let s = game({ phase: 'point', point: 9 });
    for (const [t, a] of [
      ['field', 10],
      ['any-7', 5],
      ['place-6', 6],
      ['hard-8', 5],
      ['big-6', 6],
      ['lay-4', 40],
      ['buy-10', 20],
    ] as const)
      s = bet(s, t, a);
    const r = roll(s, 1, 5); // 6: field loses, any-7 loses, place-6 wins, big-6 wins
    const left = r.state.bets.map((b) => b.type).sort();
    expect(left).toEqual(['big-6', 'buy-10', 'hard-8', 'lay-4', 'place-6'].sort());
    const r2 = roll(r.state, 4, 4); // hard 8 wins and stays
    expect(r2.state.bets.some((b) => b.type === 'hard-8')).toBe(true);
    expect(r2.events.find((e) => e.type === 'bet-won')).toMatchObject({
      betType: 'hard-8',
      staysUp: true,
    });
    const r3 = roll(r2.state, 3, 4); // seven: all multi-roll lose except lay
    expect(r3.state.bets.map((b) => b.type)).toEqual(['lay-4']);
  });
});

describe('working rules', () => {
  it('place/buy/hard are off on the come-out by default and on in the point phase', () => {
    let s = game();
    for (const [t, a] of [
      ['place-6', 12],
      ['buy-4', 20],
      ['hard-6', 5],
      ['lay-4', 40],
      ['big-6', 6],
    ] as const)
      s = bet(s, t, a);
    const w = Object.fromEntries(s.bets.map((b) => [b.type, isWorking(b, s)]));
    expect(w).toEqual({
      'place-6': false,
      'buy-4': false,
      'hard-6': false,
      'lay-4': true,
      'big-6': true,
    });
    const r = roll(s, 3, 3); // 6 on come-out: place & hard off; big-6 wins; point established 6
    expect(
      r.events.filter((e) => e.type === 'bet-won').map((e) => e.type === 'bet-won' && e.betType),
    ).toEqual(['big-6']);
    const pt = r.state;
    expect(pt.bets.map((b) => isWorking(b, pt))).toEqual([true, true, true, true, true]);
  });
  it('a 7 on the come-out does not take non-working place bets but takes lay bets', () => {
    let s = bet(game(), 'place-6', 12);
    s = bet(s, 'lay-4', 40);
    const r = roll(s, 3, 4);
    expect(betsOf(r.state, 'place-6')).toHaveLength(1);
    expect(betsOf(r.state, 'lay-4')).toHaveLength(1);
    expect(r.events.some((e) => e.type === 'bet-won' && e.betType === 'lay-4')).toBe(true);
  });
  it('rules flags and explicit overrides turn them on', () => {
    const s = bet(game({ rules: { placeBetsWorkOnComeOut: true } }), 'place-6', 12);
    expect(roll(s, 3, 3).events.some((e) => e.type === 'bet-won')).toBe(true);
    let t = bet(game({ phase: 'point', point: 4 }), 'place-6', 12);
    t = act(t, { type: 'set-working', betId: t.bets[0]!.id, working: 'off' }).state;
    expect(roll(t, 3, 3).events.some((e) => e.type === 'bet-won')).toBe(false);
  });
});

describe('come bets', () => {
  it('come wins on 7/11, loses on craps, otherwise travels and then wins on its number', () => {
    let s = bet(game({ phase: 'point', point: 9 }), 'come', 10);
    let r = roll(s, 3, 4);
    expect(r.state.phase).toBe('come-out'); // seven-out; come won first
    expect(r.state.bets).toHaveLength(0);
    expect(equity(r.state)).toBe($(1010));
    s = bet(game({ phase: 'point', point: 9 }), 'come', 10);
    r = roll(s, 1, 1);
    expect(equity(r.state)).toBe($(990));
    r = roll(s, 2, 4);
    expect(r.events[0]).toEqual({ type: 'bet-travelled', betId: 'b1', betType: 'come', point: 6 });
    expect(r.state.bets[0]).toMatchObject({ type: 'come', point: 6 });
    const w = roll(r.state, 1, 5);
    expect(w.state.bets).toHaveLength(0);
    expect(equity(w.state)).toBe($(1010));
  });

  it('come odds: placed on a travelled come bet, win with it, lose on 7, off on the come-out by default', () => {
    let s = game({ phase: 'point', point: 9 });
    s = bet(s, 'come', 10);
    s = roll(s, 2, 4).state; // travels to 6
    const come = s.bets[0]!;
    s = bet(s, 'come-odds', 25, come.id);
    expect(betsOf(s, 'come-odds')[0]).toMatchObject({ point: 6, parentId: come.id });
    const win = roll(s, 1, 5);
    expect(win.events.find((e) => e.type === 'bet-won' && e.betType === 'come-odds')).toMatchObject(
      { profit: $(30) },
    );
    expect(equity(win.state) - equity(s)).toBe($(10) + $(30));
    const lose = roll(s, 3, 4);
    expect(equity(lose.state) - equity(s)).toBe(-$(35));
  });

  it('come-odds are returned on a come-out 7 / number roll while the come bet resolves', () => {
    let s = game({ phase: 'point', point: 9 });
    s = bet(s, 'come', 10);
    s = roll(s, 2, 4).state;
    s = bet(s, 'come-odds', 25, s.bets[0]!.id);
    s = roll(s, 4, 5).state; // point made -> come-out, come bet on 6 remains
    expect(s.phase).toBe('come-out');
    const sevenCopy = roll(s, 3, 4);
    expect(types(sevenCopy.events)).toContain('bet-returned');
    expect(sevenCopy.state.bets).toHaveLength(0);
    expect(equity(sevenCopy.state)).toBe(equity(s) - $(10));
    const sixCopy = roll(s, 1, 5);
    expect(sixCopy.events.find((e) => e.type === 'bet-returned')).toMatchObject({
      reason: 'odds-off',
      amount: $(25),
    });
    expect(equity(sixCopy.state)).toBe(equity(s) + $(10));
    // with the rule flag on, odds work
    let w = game({ phase: 'point', point: 9, rules: { comeOddsWorkOnComeOut: true } });
    w = bet(w, 'come', 10);
    w = roll(w, 2, 4).state;
    w = bet(w, 'come-odds', 25, w.bets[0]!.id);
    w = roll(w, 4, 5).state;
    expect(
      roll(w, 1, 5).events.find((e) => e.type === 'bet-won' && e.betType === 'come-odds'),
    ).toBeTruthy();
  });

  it('a come bet travelling to a number where an older come bet wins is independent', () => {
    let s = game({ phase: 'point', point: 9 });
    s = bet(s, 'come', 10);
    s = roll(s, 2, 4).state; // old come on 6
    s = bet(s, 'come', 15); // new one in the box
    const r = roll(s, 1, 5); // 6: old wins, new travels to 6
    expect(r.events.map((e) => e.type)).toEqual(['bet-won', 'bet-travelled', 'dice-rolled']);
    expect(r.state.bets).toHaveLength(1);
    expect(r.state.bets[0]).toMatchObject({ type: 'come', point: 6, amount: $(15) });
    expect(equity(r.state) - equity(s)).toBe($(10));
  });

  it('dont-come: travel, 12 push stays in the box, 7 wins with its odds', () => {
    let s = bet(game({ phase: 'point', point: 9 }), 'dont-come', 10);
    const p = roll(s, 6, 6);
    expect(p.state.bets).toHaveLength(1);
    expect(p.state.bets[0]!.point).toBeNull();
    s = roll(s, 1, 3).state; // travels to 4
    s = bet(s, 'dont-come-odds', 60, s.bets[0]!.id);
    const w = roll(s, 3, 4);
    expect(equity(w.state) - equity(s)).toBe($(10) + $(30));
    expect(w.state.bets).toHaveLength(0);
  });

  it('removing a flat with odds takes the odds along; odds can be removed alone', () => {
    let s = game({ phase: 'point', point: 6, bets: [{ type: 'dont-pass', amount: $(10) }] });
    s = bet(s, 'dont-pass-odds', 30);
    const odds = s.bets[1]!;
    const r = act(s, { type: 'remove-bet', betId: odds.id });
    expect(r.state.bets).toHaveLength(1);
    expect(r.state.bankroll).toBe(s.bankroll + $(30));
  });
});

describe('money conservation', () => {
  it('sum(net) equals the equity delta for every roll of a busy session', () => {
    let s = game({ seed: 99, bankroll: $(100000) });
    const e0 = equity(s);
    let sumNet = 0;
    const setup = (st: GameState): GameState => {
      const tryBet = (x: GameState, a: Action) => {
        const r = applyAction(x, a);
        return r.ok ? r.state : x;
      };
      let x = st;
      if (x.phase === 'come-out') {
        x = tryBet(x, { type: 'place-bet', betType: 'pass-line', amount: $(10) });
      } else {
        x = tryBet(x, { type: 'place-bet', betType: 'come', amount: $(10) });
        x = tryBet(x, { type: 'place-bet', betType: 'pass-odds', amount: $(30) });
        for (const b of x.bets)
          if (b.type === 'come' && b.point !== null)
            x = tryBet(x, {
              type: 'place-bet',
              betType: 'come-odds',
              amount: $(20),
              parentId: b.id,
            });
      }
      for (const [t, a] of [
        ['place-6', 12],
        ['place-8', 12],
        ['buy-4', 20],
        ['lay-10', 40],
        ['field', 5],
        ['hard-8', 5],
        ['any-7', 1],
        ['horn', 4],
        ['world', 5],
        ['big-6', 6],
      ] as const)
        x = tryBet(x, { type: 'place-bet', betType: t, amount: $(a) });
      return x;
    };
    for (let i = 0; i < 3000; i++) {
      s = setup(s);
      const before = equity(s);
      const r = applyAction(s, { type: 'roll' });
      if (!r.ok) throw new Error('roll failed');
      const rec = r.state.history[r.state.history.length - 1]!;
      expect(equity(r.state) - before).toBe(rec.net);
      sumNet += rec.net;
      s = r.state;
    }
    expect(equity(s) - e0).toBe(sumNet);
    expect(s.stats.totalWon - s.stats.totalLost).toBe(sumNet);
    const byTypeNet = Object.values(s.stats.byType).reduce((a, t) => a + t.net, 0);
    expect(byTypeNet).toBe(sumNet);
    expect(s.history).toHaveLength(200);
    expect(s.rollCount).toBe(3000);
  });
});

describe('stats', () => {
  it('tracks wagered/won/lost/vig and per-type breakdown', () => {
    let s = game({ phase: 'point', point: 9 });
    s = bet(s, 'buy-4', 20);
    s = bet(s, 'field', 10);
    const r1 = roll(s, 1, 3); // buy-4 wins +39; field wins +10
    const st = r1.state.stats;
    expect(st).toMatchObject({
      totalWon: $(49),
      totalVig: $(1),
      totalLost: 0,
      totalWagered: $(30),
    });
    expect(st.byType['buy-4']).toMatchObject({
      count: 1,
      wagered: $(20),
      won: $(39),
      vig: $(1),
      net: $(39),
    });
    expect(st.byType.field).toMatchObject({ net: $(10) });
    const r2 = roll(r1.state, 3, 4);
    expect(r2.state.stats.byType['buy-4']).toMatchObject({ count: 2, lost: $(20), net: $(19) });
  });
  it('accumulates expected loss from the injected functions', () => {
    const s = bet(game({ phase: 'point', point: 9 }), 'field', 10);
    const r = applyAction(
      s,
      { type: 'roll', dice: [1, 1] },
      {
        expectedLossFn: () => 55.5,
        expectedLossByTypeFn: () => ({ field: 55.5 }),
      },
    );
    if (!r.ok) throw new Error('x');
    expect(r.state.stats.expectedLoss).toBe(55.5);
    expect(r.state.stats.byType.field!.expectedLoss).toBe(55.5);
    const r2 = applyAction(r.state, { type: 'roll' }, { expectedLossFn: () => 10 });
    if (!r2.ok) throw new Error('x');
    expect(r2.state.stats.expectedLoss).toBe(65.5);
  });
});

describe('createGame', () => {
  it('starts mid-hand with pass line, point and odds', () => {
    const s = createGame({
      seed: 1,
      bankroll: $(500),
      phase: 'point',
      point: 6,
      bets: [
        { ref: 'p', type: 'pass-line', amount: $(10) },
        { type: 'pass-odds', amount: $(50), parentRef: 'p' },
        { type: 'place-8', amount: $(12) },
        { ref: 'c', type: 'come', amount: $(10), point: 4 },
        { type: 'come-odds', amount: $(30), parentRef: 'c' },
      ],
    });
    expect(s.bankroll).toBe($(500 - 10 - 50 - 12 - 10 - 30));
    expect(s.bets.map((b) => b.id)).toEqual(['b1', 'b2', 'b3', 'b4', 'b5']);
    expect(s.bets[1]).toMatchObject({ parentId: 'b1', point: 6 });
    expect(s.bets[4]).toMatchObject({ parentId: 'b4', point: 4 });
    expect(s.nextBetId).toBe(6);
  });
  it('throws on inconsistency or invalid bets', () => {
    expect(() => createGame({ phase: 'point' })).toThrow();
    expect(() => createGame({ phase: 'come-out', point: 6 })).toThrow();
    expect(() =>
      createGame({ bankroll: $(5), bets: [{ type: 'pass-line', amount: $(10) }] }),
    ).toThrow();
    expect(() => createGame({ bets: [{ type: 'pass-odds', amount: $(10) }] })).toThrow();
    expect(() => createGame({ bets: [{ type: 'pass-line', amount: $(1) }] })).toThrow();
  });
  it('defaults', () => {
    const s = createGame({ seed: 5 });
    expect(s).toMatchObject({
      version: 1,
      bankroll: 50000,
      phase: 'come-out',
      point: null,
      rollCount: 0,
      seed: 5,
    });
    expect(s.rules.presetId).toBe('standard-vegas');
    expect(createGame({ rules: 'odds-10x' }).rules.maxOdds[4]).toBe(10);
  });
});

describe('determinism', () => {
  const script: Action[] = [
    { type: 'place-bet', betType: 'pass-line', amount: $(10) },
    { type: 'roll' },
    { type: 'roll', dice: [2, 4] },
    { type: 'place-bet', betType: 'pass-odds', amount: $(50) },
    { type: 'place-bet', betType: 'place-8', amount: $(12) },
    { type: 'roll' },
    { type: 'roll' },
    { type: 'roll' },
  ];
  it('replay reproduces live play exactly', () => {
    const init = createGame({ seed: 31337, bankroll: $(1000) });
    let live = init;
    for (const a of script) {
      const r = applyAction(live, a);
      if (r.ok) live = r.state;
    }
    // drop rejected actions like a log would
    const log: Action[] = [];
    let probe = init;
    for (const a of script) {
      const r = applyAction(probe, a);
      if (r.ok) {
        log.push(a);
        probe = r.state;
      }
    }
    expect(replay(init, log)).toEqual(live);
    expect(replay(init, log)).toEqual(replay(init, log));
  });
  it('same seed same rolls; different seed differs', () => {
    const run = (seed: number) => {
      let s = createGame({ seed });
      for (let i = 0; i < 20; i++) s = roll(s, 1, 1).state;
      let u = createGame({ seed });
      const totals: number[] = [];
      for (let i = 0; i < 20; i++) {
        const r = applyAction(u, { type: 'roll' });
        if (!r.ok) throw new Error('x');
        u = r.state;
        totals.push(u.history[u.history.length - 1]!.total);
      }
      return totals;
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });
  it('replay throws on a rejected action', () => {
    expect(() =>
      replay(createGame(), [{ type: 'place-bet', betType: 'come', amount: $(10) }]),
    ).toThrow();
  });
  it('forced dice: queue then RNG; explicit dice do not touch the queue or RNG', () => {
    const s = createGame({ seed: 8, forcedDice: [[3, 4]] });
    const a = applyAction(s, { type: 'roll' });
    if (!a.ok) throw new Error('x');
    expect(a.state.history[0]).toMatchObject({ total: 7, forced: true });
    expect(a.state.rng).toEqual(s.rng);
    const b = applyAction(a.state, { type: 'roll' });
    if (!b.ok) throw new Error('x');
    expect(b.state.history[1]!.forced).toBe(false);
    const c = applyAction(s, { type: 'roll', dice: [6, 6] });
    if (!c.ok) throw new Error('x');
    expect(c.state.forcedDice).toHaveLength(1);
    expect(c.state.rng).toEqual(s.rng);
    expect(c.state.history[0]).toMatchObject({ forced: true, hard: true, total: 12 });
  });
  it('actions never mutate (deep-frozen input state)', () => {
    let s = deepFreeze(
      game({ phase: 'point', point: 6, bets: [{ type: 'pass-line', amount: $(10) }] }),
    );
    const acts: Action[] = [
      { type: 'place-bet', betType: 'pass-odds', amount: $(30) },
      { type: 'place-bet', betType: 'place-8', amount: $(12) },
      { type: 'place-bet', betType: 'field', amount: $(5) },
      { type: 'set-amount', betId: 'b3', amount: $(18) },
      { type: 'set-working', betId: 'b3', working: 'off' },
      { type: 'roll' },
      { type: 'roll', dice: [2, 5] },
      { type: 'remove-bet', betId: 'b3' },
    ];
    for (const a of acts) {
      const r = applyAction(s, a);
      if (r.ok) s = deepFreeze(r.state);
    }
    expect(s.rollCount).toBe(2);
    expect(() => resolveRoll(deepFreeze(game()), [3, 4], false)).not.toThrow();
    expect(seedRng(1)).toEqual(seedRng(1));
  });
});

describe('performance', () => {
  it('100k rolls with a working layout in under 1s (best of 3 to absorb CI noise)', () => {
    const run = (): number => {
      let s = createGame({ seed: 1, bankroll: 1e12, rules: { tableMax: 1e12 } });
      const start = performance.now();
      for (let i = 0; i < 100_000; i++) {
        if (s.bets.length === 0) {
          const place = (x: GameState, a: Action) => {
            const r = applyAction(x, a);
            return r.ok ? r.state : x;
          };
          if (s.phase === 'come-out')
            s = place(s, { type: 'place-bet', betType: 'pass-line', amount: $(10) });
          else {
            s = place(s, { type: 'place-bet', betType: 'place-6', amount: $(12) });
            s = place(s, { type: 'place-bet', betType: 'place-8', amount: $(12) });
          }
        }
        const r = applyAction(s, { type: 'roll' });
        if (!r.ok) throw new Error('x');
        s = r.state;
      }
      expect(s.rollCount).toBe(100_000);
      return performance.now() - start;
    };
    expect(Math.min(run(), run(), run())).toBeLessThan(1000);
  });
});
