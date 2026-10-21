import { describe, expect, it } from 'vitest';
import { bankrollNote } from './bankrollNote';

describe('bankrollNote (I057)', () => {
  it('no note at exactly 25% of the bankroll; a note just over it', () => {
    expect(bankrollNote(25, 100)).toBeNull();
    expect(bankrollNote(26, 100)).not.toBeNull();
  });

  it('floors the number of decisions', () => {
    expect(bankrollNote(30, 100)).toContain('covers about 3 decisions');
    expect(bankrollNote(50, 100)).toContain('covers about 2 decisions');
  });

  it('says when the bankroll covers no decision at all', () => {
    expect(bankrollNote(600, 500)).toContain('does not cover one decision');
  });

  it('marks an approximate figure', () => {
    expect(bankrollNote(600, 500, true)).toContain('Approximate');
  });

  it('no note when there is no exposure', () => {
    expect(bankrollNote(0, 100)).toBeNull();
  });
});
