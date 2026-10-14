import { describe, expect, it } from 'vitest';
import { BET_TYPE_IDS, POINT_NUMBERS } from './index';

describe('contract', () => {
  it('lists the point numbers and a unique bet registry', () => {
    expect(POINT_NUMBERS).toEqual([4, 5, 6, 8, 9, 10]);
    expect(new Set(BET_TYPE_IDS).size).toBe(BET_TYPE_IDS.length);
    expect(BET_TYPE_IDS).toContain('buy-6');
    expect(BET_TYPE_IDS).toContain('lay-9');
  });
});
