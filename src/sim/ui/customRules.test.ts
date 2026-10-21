import { describe, expect, it } from 'vitest';
import { applyAction, createGame } from '../engine/game';
import { RULE_PRESETS, resolveRules } from '../engine/rules';
import type { RulePresetId } from '../engine/types';
import { frac } from '../math/fraction';
import {
  ODDS_CHOICES,
  fmtEdgePct,
  matchingPreset,
  oddsChoiceOf,
  oddsLimits,
  passMaxOddsEdge,
  rulesSummary,
} from './customRules';

describe('custom rules: odds choices', () => {
  it('3-4-5x is the default; 10x and 100x match their presets exactly', () => {
    expect(oddsChoiceOf(resolveRules())).toBe('3-4-5x');
    expect(oddsChoiceOf(resolveRules('odds-10x'))).toBe('10x');
    expect(oddsChoiceOf(resolveRules('odds-100x'))).toBe('100x');
    expect(oddsLimits('10x')).toEqual({
      maxOdds: RULE_PRESETS['odds-10x'].maxOdds,
      maxLayOdds: RULE_PRESETS['odds-10x'].maxLayOdds,
    });
  });
  it('every choice round-trips', () => {
    for (const c of ODDS_CHOICES) expect(oddsChoiceOf(resolveRules(oddsLimits(c)))).toBe(c);
  });
  it('a flat Nx table lays to win N x the flat bet', () => {
    expect(oddsLimits('2x').maxLayOdds).toEqual({ 4: 4, 5: 3, 6: 2.4, 8: 2.4, 9: 3, 10: 4 });
  });
  it('recognises presets and nothing else', () => {
    for (const id of Object.keys(RULE_PRESETS) as RulePresetId[])
      expect(matchingPreset(resolveRules(id))).toBe(id);
    expect(matchingPreset(resolveRules({ payoutUnit: 100 }))).toBeNull();
  });
});

describe('custom rules: live summary (exact)', () => {
  it('pass + 3-4-5x odds is 7/1870 = 0.37%', () => {
    // pass edge 7/495 over an expected stake of 1 + (2*3*3 + 2*4*4 + 2*5*5)/36 = 136/36 flat units
    expect(passMaxOddsEdge(resolveRules())).toEqual(frac(7, 1870));
    expect(fmtEdgePct(rulesSummary(resolveRules())[0]!.edge)).toBe('0.37%');
  });
  it('pass + 2x odds is 7/1287 and 100x approaches zero', () => {
    // 1 + 2 * (3+4+5+5+4+3)/36 = 1 + 48/36 = 84/36
    expect(passMaxOddsEdge(resolveRules(oddsLimits('2x')))).toEqual(frac(7 * 36, 495 * 84));
    expect(fmtEdgePct(rulesSummary(resolveRules('odds-100x'))[0]!.edge)).toBe('0.02%');
  });
  const pct = (over: Parameters<typeof resolveRules>[0]) =>
    Object.fromEntries(rulesSummary(resolveRules(over)).map((i) => [i.label, fmtEdgePct(i.edge)]));
  const VIG = (timing: 'on-win' | 'upfront', rounding: 'floor-dollar-min-1' | 'exact-cents') => ({
    vig: { rate: 0.05, timing, rounding },
  });
  it('standard rules: every line at its usual size', () => {
    expect(pct(undefined)).toEqual({
      'Pass $10 + max odds': '0.37%',
      'Field $5': '5.56%',
      'Buy 4 $25': '1.33%',
      'Place 6 $12': '1.52%',
      'Place 6 $5': '1.55%',
    });
  });
  it('field 3x on 12', () => {
    expect(pct({ fieldPays: { 2: 2, 12: 3 } })['Field $5']).toBe('2.78%');
  });
  it('vig timing and rounding move Buy 4 $25 (decisions.md: 1.33% / 3.85%)', () => {
    expect(pct(VIG('on-win', 'floor-dollar-min-1'))['Buy 4 $25']).toBe('1.33%'); // $1 vig on a win
    expect(pct(VIG('upfront', 'floor-dollar-min-1'))['Buy 4 $25']).toBe('3.85%'); // 1/26
    expect(pct(VIG('on-win', 'exact-cents'))['Buy 4 $25']).toBe('1.67%'); // $1.25 on a win
    expect(pct(VIG('upfront', 'exact-cents'))['Buy 4 $25']).toBe('4.76%'); // 1.25/26.25
  });
  it('payout unit moves Place 6 $5 (pays $5.83): 1.55% / 4.55% / 9.09%', () => {
    expect(pct({ payoutUnit: 1 })['Place 6 $5']).toBe('1.55%');
    expect(pct({ payoutUnit: 50 })['Place 6 $5']).toBe('4.55%');
    expect(pct({ payoutUnit: 100 })['Place 6 $5']).toBe('9.09%');
    // properly sized bets lose nothing to rounding
    expect(pct({ payoutUnit: 100 })['Place 6 $12']).toBe('1.52%');
  });
  it('bets are raised to the table minimum, so every line is legal', () => {
    expect(Object.keys(pct({ tableMin: 2500 }))).toEqual([
      'Pass $25 + max odds',
      'Field $25',
      'Buy 4 $25',
      'Place 6 $25',
    ]);
  });
});

describe('custom rules reach the engine', () => {
  it('a put bet is allowed only when the editor turns it on', () => {
    const put = { type: 'place-bet', betType: 'pass-line', amount: 1000 } as const;
    for (const allowPutBets of [false, true]) {
      const g = createGame({
        seed: 1,
        phase: 'point',
        point: 6,
        rules: resolveRules({ allowPutBets }),
      });
      expect(applyAction(g, put).ok).toBe(allowPutBets);
    }
  });
});
