import { pointsFor, resolveRules } from '../engine/rules';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { applyAction, createGame } from '../engine';
import type { BetTypeId, Dice, GameState } from '../engine';
import { validateScene } from '../scene';
import { nextU32, seedRng } from '../engine';
import type { Action, Bet, Die, RngState } from '../engine';
import {
  bootFromParams,
  buildShareUrl,
  describeSkipped,
  MAX_BANKROLL,
  parseBets,
  rngDraws,
  serializeBets,
  shareStateOf,
  toParams,
  toSceneYaml,
} from './shareLink';

/** A tiny seeded helper for the fuzz test (the engine's own xoshiro). */
function createDrillRng(seed: number) {
  let st: RngState = seedRng(seed);
  const u32 = () => {
    const [u, next] = nextU32(st);
    st = next;
    return u;
  };
  const int = (lo: number, hi: number) => lo + (u32() % (hi - lo + 1));
  return {
    int,
    pick: <T>(xs: readonly T[]): T => xs[int(0, xs.length - 1)]!,
    chance: (p: number) => u32() / 2 ** 32 < p,
    die: () => int(1, 6) as Die,
  };
}

const defaults = { rules: 'standard-vegas' as const, bankroll: 50_000, seed: 1 };
const place = (g: GameState, betType: BetTypeId, amount: number, parentId?: string) => {
  const r = applyAction(g, {
    type: 'place-bet',
    betType,
    amount,
    ...(parentId ? { parentId } : {}),
  });
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};
const roll = (g: GameState, dice?: Dice) => {
  const r = applyAction(g, dice ? { type: 'roll', dice } : { type: 'roll' });
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};

describe('bets param', () => {
  it('round-trips a layout with come bets, their odds and a bonus bet in progress', () => {
    let g = createGame({ seed: 5, bankroll: 50_000 });
    g = place(g, 'small', 100);
    g = place(g, 'pass-line', 1000);
    g = roll(g, [4, 4]); // point 8
    g = place(g, 'pass-odds', 3000);
    g = place(g, 'come', 500);
    g = roll(g, [2, 4]); // come travels to 6; small collects 6
    const come = g.bets.find((b) => b.type === 'come')!;
    g = place(g, 'come-odds', 1000, come.id);
    g = place(g, 'place-5', 1000);
    const text = serializeBets(g.bets);
    expect(text).toBe('small@6:1,pass-line:10,pass-odds:30,come@6:5,come-odds@6:10,place-5:10');
    const parsed = parseBets(text);
    expect(parsed.skipped).toEqual([]);
    const again = createGame({
      seed: 5,
      bankroll: g.bankroll,
      phase: 'point',
      point: 8,
      bets: parsed.bets,
    });
    expect(again.bets.map((b) => [b.type, b.amount, b.point])).toEqual(
      g.bets.map((b) => [b.type, b.amount, b.point]),
    );
    expect(again.bets.find((b) => b.type === 'small')?.progress).toEqual([6]);
    expect(again.bets.find((b) => b.type === 'come-odds')?.parentId).toBe(
      again.bets.find((b) => b.type === 'come')?.id,
    );
  });

  it('skips malformed parts without throwing', () => {
    const p = parseBets('pass-line:10,nonsense:5,place-6,come@13:5,field:0,hard-8@2:1, ,horn:4');
    expect(p.bets.map((b) => b.type)).toEqual(['pass-line', 'horn']);
    expect(p.skipped).toEqual(['nonsense:5', 'place-6', 'come@13:5', 'field:0', 'hard-8@2:1']);
    expect(parseBets(null)).toEqual({ bets: [], skipped: [] });
  });
});

describe('share link boot', () => {
  it('reproduces the layout, the rack and the next rolls', () => {
    let g = createGame({ seed: 42, bankroll: 50_000, rules: 'odds-10x' });
    g = place(g, 'pass-line', 1000);
    g = roll(g); // random rolls from the seed
    g = roll(g);
    g = roll(g);
    const url = buildShareUrl('https://example.test/crappy/', g);
    expect(url.startsWith('https://example.test/crappy/#/play?seed=42&skip=3&rules=odds-10x')).toBe(
      true,
    );
    const params = new URLSearchParams(url.slice(url.indexOf('?') + 1));
    const boot = bootFromParams(params, defaults)!;
    expect(boot.skipped).toEqual([]);
    expect(boot.game.bankroll).toBe(g.bankroll);
    expect(boot.game.point).toBe(g.point);
    expect(boot.game.rules.presetId).toBe('odds-10x');
    expect(boot.game.bets.map((b) => [b.type, b.amount])).toEqual(
      g.bets.map((b) => [b.type, b.amount]),
    );
    // the same dice come next on both tables
    const a = roll(roll(g), undefined)
      .history.slice(-2)
      .map((r) => r.total);
    const b = roll(roll(boot.game), undefined)
      .history.slice(-2)
      .map((r) => r.total);
    expect(b).toEqual(a);
  });

  it('ignores malformed params and reports bets the table refuses', () => {
    const p = new URLSearchParams(
      'seed=x&rules=nope&bankroll=-5&point=7&bets=pass-odds:10,pass-line:10,come:5,hard-8:1',
    );
    const boot = bootFromParams(p, defaults)!;
    expect(boot.game.seed).toBe(1);
    expect(boot.game.rules.presetId).toBe('standard-vegas');
    // a come bet in the box is a legal starting position (scenes start mid-hand); odds without a
    // flat bet are not
    expect(boot.game.bankroll).toBe(50_000 - 1000 - 500 - 100);
    expect(boot.game.point).toBeNull();
    expect(boot.game.bets.map((b) => b.type)).toEqual(['pass-line', 'come', 'hard-8']);
    expect(boot.skipped.join(' | ')).toMatch(/bankroll "-5"/);
    expect(boot.skipped.join(' | ')).toMatch(/point "7"/);
    expect(boot.skipped.join(' | ')).toMatch(/bet pass-odds/);
    expect(boot.skipped.join(' | ')).not.toMatch(/bet come/);
    expect(bootFromParams(new URLSearchParams('seed=3'), defaults)).toBeNull();
  });

  it('forced dice do not count as skipped RNG rolls', () => {
    let g = createGame({ seed: 9, bankroll: 50_000, forcedDice: [[3, 4]] });
    g = roll(g);
    const pos = { bootSkip: 0, bootForced: 1 };
    expect(shareStateOf(g, pos).skip).toBe(0);
    expect(toParams(shareStateOf(g, pos)).get('skip')).toBeNull();
    expect(shareStateOf(roll(g), pos).skip).toBe(1);
  });
});

describe('scene YAML', () => {
  it('is valid YAML that validateScene accepts and that rebuilds the table', () => {
    let g = createGame({ seed: 7, bankroll: 50_000 });
    g = place(g, 'pass-line', 1000);
    g = roll(g, [3, 3]);
    g = place(g, 'pass-odds', 2000);
    g = place(g, 'come', 500);
    const yaml = toSceneYaml(g);
    const parsed = parseYaml(yaml) as { bets?: unknown[] };
    const v = validateScene(parsed);
    expect(v.ok, JSON.stringify(v)).toBe(true);
    expect(parsed).toMatchObject({
      id: 'shared-table',
      version: 1,
      seed: 7,
      phase: 'point',
      point: 6,
    });
    expect(parsed.bets).toHaveLength(3);
  });
});

describe('review round: hop bets, working flags, limits and the RNG position', () => {
  it('fuzz: random layouts round-trip through the bets param and the scene YAML', () => {
    const TYPES: BetTypeId[] = [
      'pass-line',
      'dont-pass',
      'place-5',
      'place-6',
      'buy-4',
      'lay-10',
      'field',
      'hard-8',
      'any-7',
      'hop',
      'small',
      'fire',
    ];
    for (let seed = 1; seed <= 60; seed++) {
      const rng = createDrillRng(seed);
      let g = createGame({ seed, bankroll: 200_000 });
      const n = rng.int(1, 6);
      for (let i = 0; i < n; i++) {
        const type = rng.pick(TYPES);
        const action: Action = {
          type: 'place-bet',
          betType: type,
          amount: rng.pick([100, 500, 1200, 2000]),
          ...(type === 'hop' ? { hop: [rng.die(), rng.die()] as unknown as Dice } : {}),
        };
        const r = applyAction(g, action);
        if (r.ok) g = r.state;
      }
      // a working override on one toggleable bet
      const tog = g.bets.find((b) => b.type.startsWith('place-') || b.type.startsWith('buy-'));
      if (tog && rng.chance(0.5)) {
        const r = applyAction(g, { type: 'set-working', betId: tog.id, working: 'on' });
        if (r.ok) g = r.state;
      }
      if (rng.chance(0.5)) {
        const r = applyAction(g, { type: 'roll', dice: [rng.pick([2, 3, 4] as const), 4] as Dice });
        if (r.ok) g = r.state;
      }
      const text = serializeBets(g.bets);
      const parsed = parseBets(text);
      expect(parsed.skipped, `${seed}: ${text}`).toEqual([]);
      const again = createGame({
        seed,
        bankroll: 10_000_000,
        ...(g.point !== null ? { phase: 'point', point: g.point } : {}),
        bets: parsed.bets,
      });
      const shape = (bets: readonly Bet[]) =>
        bets.map((b) => [b.type, b.amount, b.point, b.hop ?? null, b.working, b.progress ?? null]);
      expect(shape(again.bets), `${seed}: ${text}`).toEqual(shape(g.bets));
      const v = validateScene(parseYaml(toSceneYaml(g)) as unknown);
      expect(v.ok, `${seed}: ${JSON.stringify(v)}`).toBe(true);
    }
  });

  it('encodes hop pairs, working flags and refuses a second come bet on the same number', () => {
    let g = createGame({ seed: 1, bankroll: 50_000, phase: 'point', point: 8 });
    g = applyAction(g, { type: 'place-bet', betType: 'hop', amount: 100, hop: [4, 2] as Dice }).ok
      ? (
          applyAction(g, {
            type: 'place-bet',
            betType: 'hop',
            amount: 100,
            hop: [4, 2] as Dice,
          }) as { state: GameState }
        ).state
      : g;
    g = (
      applyAction(g, { type: 'place-bet', betType: 'place-6', amount: 1200 }) as {
        state: GameState;
      }
    ).state;
    const p6 = g.bets.find((b) => b.type === 'place-6')!;
    g = (
      applyAction(g, { type: 'set-working', betId: p6.id, working: 'off' }) as { state: GameState }
    ).state;
    expect(serializeBets(g.bets)).toBe('hop@2-4:1,place-6:12!off');
    const parsed = parseBets(
      'hop@2-4:1,place-6:12!off,come@6:5,come@6:10,hop:1,hop@7-1:1,place-6:5!maybe',
    );
    expect(parsed.bets.map((b) => [b.type, b.hop ?? null, b.working ?? null])).toEqual([
      ['hop', [2, 4], null],
      ['place-6', null, 'off'],
      ['come', null, null],
    ]);
    expect(parsed.skipped).toEqual(['come@6:10', 'hop:1', 'hop@7-1:1', 'place-6:5!maybe']);
    expect(toSceneYaml(g)).toContain('hop: [2, 4]');
    expect(toSceneYaml(g)).toContain('working: off');
  });

  it('caps the bankroll, requires decimal digits for point and skip, and reports each', () => {
    const d = { rules: 'standard-vegas' as const, bankroll: 50_000, seed: 1 };
    const big = bootFromParams(new URLSearchParams('bankroll=99999999'), d)!;
    expect(big.game.bankroll).toBe(50_000);
    expect(big.skipped).toEqual(['bankroll "99999999"']);
    expect(bootFromParams(new URLSearchParams('bankroll=10000000'), d)!.game.bankroll).toBe(
      MAX_BANKROLL,
    );
    const odd = bootFromParams(new URLSearchParams('bankroll=1e3&point=0x8&skip=1234567'), d)!;
    expect(odd.skipped).toEqual(['bankroll "1e3"', 'point "0x8"', 'skip "1234567"']);
    expect(odd.rng).toEqual({ bootSkip: 0, bootForced: 0 });
  });

  it('re-sharing keeps the RNG position: boot skip plus the rolls drawn since', () => {
    let g = createGame({ seed: 21, bankroll: 50_000 });
    g = roll(g);
    g = roll(g);
    const first = buildShareUrl('https://x/', g);
    expect(first).toContain('skip=2');
    const boot = bootFromParams(new URLSearchParams(first.slice(first.indexOf('?') + 1)), {
      rules: 'standard-vegas',
      bankroll: 50_000,
      seed: 1,
    })!;
    expect(boot.rng).toEqual({ bootSkip: 2, bootForced: 0 });
    let h = roll(boot.game);
    h = roll(h);
    const second = buildShareUrl('https://x/', h, boot.rng);
    expect(second).toContain('skip=4');
    // the table that opens the second link rolls what the original rolls next
    const again = bootFromParams(new URLSearchParams(second.slice(second.indexOf('?') + 1)), {
      rules: 'standard-vegas',
      bankroll: 50_000,
      seed: 1,
    })!.game;
    let orig = roll(roll(g));
    orig = roll(orig);
    expect(roll(again).history.at(-1)?.total).toBe(orig.history.at(-1)?.total);
    // forced rolls at boot do not count as draws, even beyond the history cap
    const forced = createGame({
      seed: 3,
      bankroll: 50_000,
      forcedDice: [
        [3, 4],
        [2, 2],
      ],
    });
    const f2 = roll(roll(forced));
    expect(rngDraws(f2, { bootSkip: 0, bootForced: 2 })).toBe(0);
    expect(rngDraws(roll(f2), { bootSkip: 5, bootForced: 2 })).toBe(6);
  });

  it('describes skipped parts briefly', () => {
    const many = Array.from({ length: 8 }, (_, i) => `bet "x${i}:${'9'.repeat(50)}"`);
    const text = describeSkipped(many);
    expect(text).toMatch(/^Skipped from the link: /);
    expect(text).toContain('(+3 more)');
    expect(text.length).toBeLessThan(5 * 42 + 60);
    expect(describeSkipped(['point "7"'])).toBe('Skipped from the link: point "7".');
  });

  it('crapless links keep points 2, 3, 11 and 12 and come bets on them (I036)', () => {
    expect(parseBets('come@3:5,come-odds@3:10').bets).toEqual([]);
    const p = parseBets('come@3:5,come-odds@3:10', pointsFor(resolveRules('crapless')));
    expect(p.skipped).toEqual([]);
    expect(p.bets.map((b) => [b.type, b.point])).toEqual([
      ['come', 3],
      ['come-odds', undefined],
    ]);
  });
});
