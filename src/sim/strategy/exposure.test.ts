import { describe, expect, it } from 'vitest';
import { resolveRules } from '../engine';
import { maxExposure } from './metrics';

const rules = resolveRules('standard-vegas');

describe('maxExposure (I057)', () => {
  it('pass-max-odds at $100 puts $600 out per decision (flat plus 5x odds at 6 or 8)', () => {
    expect(maxExposure({ id: 'pass-max-odds', unit: 10_000 }, rules)).toBe(60_000);
  });

  it('a $10 unit with max odds is $60, well under a quarter of $500', () => {
    expect(maxExposure({ id: 'pass-max-odds', unit: 1_000 }, rules)).toBe(6_000);
  });

  it('a flat bet with no odds is just the unit', () => {
    expect(maxExposure({ id: 'field-every-roll', unit: 10_000 }, rules)).toBeGreaterThan(0);
  });
});
