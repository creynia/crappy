import { describe, expect, it } from 'vitest';
import { $, bet, game, roll } from '../engine/__tests__/helpers';
import { equity } from '../engine';
import { appendLog, autoRollEntry, LOG_LIMIT, matchesFilter, summarizeRoll } from './rollLog';
import { describeRoll } from './text';

describe('summarizeRoll', () => {
  it('come-out natural', () => {
    const s = bet(game(), 'pass-line', 10);
    const r = roll(s, 3, 4);
    const e = summarizeRoll(s, r.state, r.events)!;
    expect(e).toMatchObject({ kind: 'roll', n: 1, total: 7, point: 'natural', net: $(10) });
    expect(e.outcomes).toEqual(['win']);
    expect(e.text).toBe(describeRoll(r.events, s.bets));
    expect(e.text).toContain('Natural!');
    expect(e.bankroll).toBe(equity(r.state));
  });

  it('point set', () => {
    const s = bet(game(), 'pass-line', 10);
    const r = roll(s, 3, 3);
    const e = summarizeRoll(s, r.state, r.events)!;
    expect(e.point).toBe('point-set');
    expect(e.outcomes).toEqual([]);
    expect(e.text).toContain('Point is 6.');
    expect(e.net).toBe(0);
  });

  it('point made with odds', () => {
    let s = bet(game(), 'pass-line', 10);
    s = roll(s, 3, 3).state;
    s = bet(s, 'pass-odds', 20, s.bets[0]!.id);
    const r = roll(s, 4, 2);
    const e = summarizeRoll(s, r.state, r.events)!;
    expect(e.point).toBe('point-made');
    expect(e.outcomes).toEqual(['win', 'win']);
    expect(e.text).toContain('Point made!');
    expect(e.text).toContain('pass odds wins');
    expect(e.net).toBe($(10) + $(24));
  });

  it('seven-out with several bets', () => {
    let s = bet(game(), 'pass-line', 10);
    s = roll(s, 3, 3).state;
    s = bet(s, 'place-8', 12);
    s = bet(s, 'field', 5);
    const r = roll(s, 3, 4);
    const e = summarizeRoll(s, r.state, r.events)!;
    expect(e.point).toBe('seven-out');
    expect(e.outcomes.filter((o) => o === 'lose')).toHaveLength(3);
    expect(e.outcomes).toContain('lose');
    expect(e.text).toContain('Seven out.');
    expect(e.net).toBeLessThan(0);
  });

  it('a come bet travelling is listed', () => {
    let s = bet(game(), 'pass-line', 10);
    s = roll(s, 3, 3).state;
    s = bet(s, 'come', 10);
    const r = roll(s, 2, 2);
    const e = summarizeRoll(s, r.state, r.events)!;
    expect(e.outcomes).toContain('travel');
    expect(e.text).toContain('Come moves to the 4.');
  });

  it('filters and trims', () => {
    const s = bet(game(), 'pass-line', 10);
    const r = roll(s, 3, 4);
    const e = summarizeRoll(s, r.state, r.events)!;
    expect(matchesFilter(e, 'wins')).toBe(true);
    expect(matchesFilter(e, 'losses')).toBe(false);
    expect(matchesFilter(e, 'points')).toBe(false); // a natural is not a point event
    let log = [] as ReturnType<typeof appendLog>;
    for (let i = 0; i < LOG_LIMIT + 5; i++) log = appendLog(log, { ...e, id: `r${i}`, n: i });
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]!.n).toBe(5);
  });

  it("names a don't come going behind a number and lower-cases grouped items", () => {
    let s = bet(game(), 'pass-line', 10);
    s = roll(s, 3, 3).state;
    s = bet(s, 'dont-come', 10);
    s = bet(s, 'field', 5);
    s = bet(s, 'place-8', 12);
    const r = roll(s, 2, 2);
    const e = summarizeRoll(s, r.state, r.events)!;
    expect(e.text).toContain("Don't come goes behind the 4");
    let t = bet(game(), 'pass-line', 10);
    t = roll(t, 3, 3).state;
    t = bet(t, 'place-6', 12);
    const r2 = roll(t, 3, 3);
    expect(summarizeRoll(t, r2.state, r2.events)!.text).toContain(
      'Pass line wins $10, place 6 wins',
    );
  });

  it('point events exclude naturals and craps', () => {
    const s = bet(game(), 'pass-line', 10);
    const nat = roll(s, 3, 4);
    expect(matchesFilter(summarizeRoll(s, nat.state, nat.events)!, 'points')).toBe(false);
    const pt = roll(s, 3, 3);
    expect(matchesFilter(summarizeRoll(s, pt.state, pt.events)!, 'points')).toBe(true);
  });
});

describe('autoRollEntry', () => {
  const single = (start: number, final: number) =>
    ({ rollsPlayed: 100, finalEquity: final, actualLoss: start - final }) as never;
  it("uses the run's own starting bankroll, not the table", () => {
    const g = game();
    const e = autoRollEntry(single(100_000, 90_000), g, 1);
    expect(e.net).toBe(-10_000);
    expect(e.text).toBe('Auto-roll: 100 rolls, net -$100.');
    const many = {
      sessions: 50,
      p50: Float64Array.from([20_000, 21_000, 25_000]),
    } as never;
    expect(autoRollEntry(many, g, 2).net).toBe(5_000);
  });
});
