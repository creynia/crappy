import { describe, expect, it } from 'vitest';
import { initScene } from '../scene';
import type { TypeOption } from './BetSheet';
import { SANDBOX_SCENE } from './simCore';
import { defaultAmount } from './simHelpers';
import { buildSheetModel, type SheetState } from './useSheetModel';

const CHIP = 500;

function freshGame() {
  return initScene(SANDBOX_SCENE, { seed: 1 });
}

function sheetFor(amount: number, type: SheetState['type'] = 'place-4') {
  const { game, runtime } = freshGame();
  return buildSheetModel(
    { regionId: 'box-4', type, amount },
    game,
    SANDBOX_SCENE,
    runtime,
    100,
    CHIP,
  )!;
}

const option = (opts: TypeOption[], label: string) => opts.find((o) => o.label === label)!;

describe('box-4 type switcher labels', () => {
  it('labels each type at the amount a tap would place, and says so when that differs', () => {
    const m = sheetFor(1000);
    expect(option(m.options, 'Buy 4').edgeText).toBe('1.67% at $20');
    expect(option(m.options, 'Place 4').tier).toBe('poor');
  });

  it('a selected type is priced at the sheet amount: Buy 4 at $10 reads 3.33% with no "at"', () => {
    const m = sheetFor(1000, 'buy-4');
    expect(option(m.options, 'Buy 4').edgeText).toBe('3.33%');
  });

  it('after tapping a type, its label equals the edge of the sheet it opens', () => {
    const before = sheetFor(1000);
    const label = option(before.options, 'Buy 4').edgeText!;
    const tap = defaultAmount('buy-4', 'box-4', freshGame().game, CHIP);
    const after = sheetFor(tap, 'buy-4');
    expect(option(after.options, 'Buy 4').edgeText).toBe(label.replace(/ at .*/, ''));
    expect(option(after.options, 'Buy 4').edgeText).not.toContain(' at ');
  });
});
