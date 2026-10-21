import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../engine/rules';
import type { BetCtx } from './types';
import { countEffects, rollEffectGrid } from './outcomes';

const comeOut: BetCtx = { phase: 'come-out', point: null, rules: DEFAULT_RULES };
const onSix: BetCtx = { phase: 'point', point: 6, rules: DEFAULT_RULES };
const grid = (
  type: never,
  ctx: BetCtx,
  point: 4 | 6 | null = null,
  working?: 'on' | 'off' | 'auto',
) => countEffects(rollEffectGrid({ type, amount: 1000, point, working }, ctx));

describe('rollEffectGrid', () => {
  it('field has 16 win cells and 20 lose', () => {
    const c = grid('field' as never, comeOut);
    expect(c.win).toBe(16);
    expect(c.lose).toBe(20);
  });
  it('hard-6: 1 win, 10 lose', () => {
    const c = grid('hard-6' as never, onSix);
    expect(c.win).toBe(1);
    expect(c.lose).toBe(10);
    expect(c.none).toBe(25);
  });
  it('place-6 on the come-out is off: all none', () => {
    const c = grid('place-6' as never, comeOut, 6);
    expect(c.none).toBe(36);
  });
  it('pass line on come-out: 8 win, 4 lose, 24 set a point', () => {
    const c = grid('pass-line' as never, comeOut);
    expect([c.win, c.lose, c.travel, c.none]).toEqual([8, 4, 24, 0]);
  });
  it('place-6 turned ON during the come-out shows win and lose cells', () => {
    const c = grid('place-6' as never, comeOut, 6, 'on');
    expect([c.win, c.lose, c.none]).toEqual([5, 6, 25]);
  });
  it('place-6 turned OFF during a point shows 36 none', () => {
    expect(grid('place-6' as never, onSix, 6, 'off').none).toBe(36);
  });
  it('come odds off on the come-out show no pushes', () => {
    const c = grid('come-odds' as never, comeOut, 6);
    expect([c.push, c.none]).toEqual([0, 36]);
  });
});
