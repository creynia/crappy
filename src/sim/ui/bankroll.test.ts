import { describe, expect, it } from 'vitest';
import { parseBankroll } from './bankroll';

describe('parseBankroll', () => {
  it('accepts whole dollars at or above the table minimum and converts to cents', () => {
    expect(parseBankroll('2500', 500)).toEqual({ ok: true, cents: 250_000 });
    expect(parseBankroll(' 5 ', 500)).toEqual({ ok: true, cents: 500 });
  });
  it('rejects bad values with a message', () => {
    expect(parseBankroll('', 500)).toMatchObject({ ok: false });
    expect(parseBankroll('12.5', 500)).toMatchObject({ ok: false });
    expect(parseBankroll('-3', 500)).toMatchObject({ ok: false });
    expect(parseBankroll('0', 500)).toMatchObject({ ok: false });
    expect(parseBankroll('4', 500)).toEqual({
      ok: false,
      message: 'The table minimum is $5.',
    });
    expect(parseBankroll('1000001', 500)).toEqual({
      ok: false,
      message: 'The maximum is $1,000,000.',
    });
  });
});

describe('parseBankroll edges', () => {
  it('accepts the cap exactly and the table minimum exactly', () => {
    expect(parseBankroll('1000000', 500)).toEqual({ ok: true, cents: 100_000_000 });
    expect(parseBankroll('500', 500)).toEqual({ ok: true, cents: 50_000 });
  });
});
