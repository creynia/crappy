import { describe, expect, it } from 'vitest';
import { shortPayout } from '../../src/app/bets';

describe('shortPayout', () => {
  it('keeps vig visible and flags multi-part payouts', () => {
    expect(shortPayout('buy-4', '2 to 1, 5% vig')).toBe('2 to 1 + 5% vig');
    expect(shortPayout('lay-4', '1 to 2, 5% vig on the win')).toBe('1 to 2 + 5% vig');
    expect(shortPayout('field', '1 to 1 (2 pays 2 to 1, 12 pays 2 to 1)')).toBe(
      'varies (see details)',
    );
    expect(shortPayout('horn', 'x')).toBe('varies (see details)');
    expect(shortPayout('place-6', '7 to 6')).toBe('7 to 6');
    expect(shortPayout('place-6', null)).toBeNull();
  });
});
