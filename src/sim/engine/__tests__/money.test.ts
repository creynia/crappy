import { describe, expect, it } from 'vitest';
import { computeVig, formatMoney, formatPct, payout, resolveRules } from '../index';

describe('formatMoney', () => {
  it('formats like the spec', () => {
    expect(formatMoney(-14)).toBe('-$0.14');
    expect(formatMoney(3900, { sign: true })).toBe('+$39');
    expect(formatMoney(125000)).toBe('$1,250');
    expect(formatMoney(0)).toBe('$0.00');
    expect(formatMoney(0, { sign: true })).toBe('$0.00');
    expect(formatMoney(583)).toBe('$5.83');
    expect(formatMoney(-2000, { sign: true })).toBe('-$20');
    expect(formatMoney(150000050)).toBe('$1,500,000.50');
    expect(formatMoney(5)).toBe('$0.05');
  });
});

describe('formatPct', () => {
  it('rounds exactly', () => {
    expect(formatPct({ n: 7n, d: 495n })).toBe('1.41%');
    expect(formatPct({ n: 1n, d: 66n })).toBe('1.52%');
    expect(formatPct({ n: 1n, d: 18n })).toBe('5.56%');
    expect(formatPct({ n: 0n, d: 1n })).toBe('0.00%');
    expect(formatPct({ n: 1n, d: 60n }, 3)).toBe('1.667%');
    expect(formatPct({ n: -1n, d: 9n }, 1)).toBe('-11.1%');
    expect(formatPct({ n: 1n, d: 3n }, 0)).toBe('33%');
    expect(formatPct({ n: 1n, d: -8n })).toBe('-12.50%');
  });
});

describe('vig and payout helpers', () => {
  const r = resolveRules();
  it('casino rounding: floor to the dollar, $1 minimum', () => {
    expect(computeVig(2000, r)).toBe(100);
    expect(computeVig(1000, r)).toBe(100);
    expect(computeVig(500, r)).toBe(100);
    expect(computeVig(2500, r)).toBe(100);
    expect(computeVig(3900, r)).toBe(100);
    expect(computeVig(4000, r)).toBe(200);
    expect(computeVig(10000, r)).toBe(500);
  });
  it('exact cents', () => {
    const e = resolveRules({ vig: { rate: 0.05, timing: 'on-win', rounding: 'exact-cents' } });
    expect(computeVig(2000, e)).toBe(100);
    expect(computeVig(1000, e)).toBe(50);
    expect(computeVig(333, e)).toBe(17);
  });
  it('payout floors to the unit', () => {
    expect(payout(500, 7, 6)).toBe(583);
    expect(payout(500, 7, 6, 100)).toBe(500);
    expect(payout(1200, 7, 6, 100)).toBe(1400);
  });
});

describe('resolveRules', () => {
  it('presets and overrides', () => {
    expect(resolveRules().presetId).toBe('standard-vegas');
    expect(resolveRules('field-3x-12').fieldPays).toEqual({ 2: 2, 12: 3 });
    expect(resolveRules('odds-10x').maxOdds[6]).toBe(10);
    expect(resolveRules('odds-100x').maxLayOdds[4]).toBe(200);
    expect(resolveRules({ tableMin: 1000 }).tableMin).toBe(1000);
    const a = resolveRules();
    a.maxOdds[4] = 99;
    expect(resolveRules().maxOdds[4]).toBe(3);
  });
});
