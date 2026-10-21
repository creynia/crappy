import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import { applyAction, createGame } from '../engine';
import type { BetTypeId, Dice, GameState } from '../engine';
import { validateScene } from '../scene';
import {
  bootFromParams,
  buildShareUrl,
  parseBets,
  serializeBets,
  shareStateOf,
  toParams,
  toSceneYaml,
} from './shareLink';

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
    expect(shareStateOf(g).skip).toBe(0);
    expect(toParams(shareStateOf(g)).get('skip')).toBeNull();
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
