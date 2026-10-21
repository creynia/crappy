import { describe, expect, it } from 'vitest';
import { $, bet, game, roll } from '../engine/__tests__/helpers';
import { appendLog, LOG_LIMIT, matchesFilter, summarizeRoll } from './rollLog';
import { describeRoll } from './text';

describe('summarizeRoll', () => {
  it('come-out natural', () => {
    const s = bet(game(), 'pass-line', 10);
    const r = roll(s, 3, 4);
    const e = summarizeRoll(r.state, r.events)!;
    expect(e).toMatchObject({ kind: 'roll', n: 1, total: 7, point: 'natural', net: $(10) });
    expect(e.outcomes).toEqual(['win']);
    expect(e.text).toBe(describeRoll(r.events));
    expect(e.text).toContain('Natural!');
    expect(e.bankroll).toBe(r.state.bankroll);
  });

  it('point set', () => {
    const s = bet(game(), 'pass-line', 10);
    const r = roll(s, 3, 3);
    const e = summarizeRoll(r.state, r.events)!;
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
    const e = summarizeRoll(r.state, r.events)!;
    expect(e.point).toBe('point-made');
    expect(e.outcomes).toEqual(['win', 'win']);
    expect(e.text).toContain('Point made!');
    expect(e.text).toContain('Pass odds wins');
    expect(e.net).toBe($(10) + $(24));
  });

  it('seven-out with several bets', () => {
    let s = bet(game(), 'pass-line', 10);
    s = roll(s, 3, 3).state;
    s = bet(s, 'place-8', 12);
    s = bet(s, 'field', 5);
    const r = roll(s, 3, 4);
    const e = summarizeRoll(r.state, r.events)!;
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
    const e = summarizeRoll(r.state, r.events)!;
    expect(e.outcomes).toContain('travel');
    expect(e.text).toContain('Come moves to the 4.');
  });

  it('filters and trims', () => {
    const s = bet(game(), 'pass-line', 10);
    const r = roll(s, 3, 4);
    const e = summarizeRoll(r.state, r.events)!;
    expect(matchesFilter(e, 'wins')).toBe(true);
    expect(matchesFilter(e, 'losses')).toBe(false);
    expect(matchesFilter(e, 'points')).toBe(true);
    let log = [] as ReturnType<typeof appendLog>;
    for (let i = 0; i < LOG_LIMIT + 5; i++) log = appendLog(log, { ...e, id: `r${i}`, n: i });
    expect(log).toHaveLength(LOG_LIMIT);
    expect(log[0]!.n).toBe(5);
  });
});
