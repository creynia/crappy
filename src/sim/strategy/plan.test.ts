import { describe, expect, it } from 'vitest';
import {
  bustRateAt,
  planStopLossRate,
  planExpectedLoss,
  planRisk,
  planRolls,
  suggestBankroll,
  suggestStopLoss,
} from './plan';
import type { PlanInput } from './plan';

const sync = { schedule: (fn: () => void) => fn(), sessions: 150 };
const input: PlanInput = {
  strategy: { id: 'pass-max-odds', unit: 1000 },
  bankroll: 30_000,
  hours: 4,
  rollsPerHour: 100,
};

describe('session plan', () => {
  it('rolls = hours x rolls/hour, capped at 10,000', () => {
    expect(planRolls(4, 100)).toBe(400);
    expect(planRolls(100, 500)).toBe(10_000);
    expect(planRolls(0, 100)).toBe(1);
  });

  it('expected loss is the analytic loss per roll times the rolls', () => {
    const e = planExpectedLoss(input);
    expect(e.rolls).toBe(400);
    // $10 pass + max odds, 3-4-5x: about $0.042 per roll -> about $17 over 400 rolls
    expect(e.expectedLoss / 100).toBeGreaterThan(15);
    expect(e.expectedLoss / 100).toBeLessThan(19);
  });

  it('is deterministic for fixed seeds', async () => {
    const a = await planRisk(input, sync);
    const b = await planRisk(input, sync);
    expect(a).toEqual(b);
    expect(a.p10).toBeLessThan(a.p90);
    expect(a.bustRate).toBeGreaterThanOrEqual(0);
    expect(a.bustRate).toBeLessThanOrEqual(1);
  });

  it('bust probability never rises as the bankroll grows (same seeds)', async () => {
    const rates: number[] = [];
    for (const b of [5_000, 10_000, 20_000, 30_000, 50_000, 80_000, 150_000])
      rates.push(await bustRateAt(input, b, sync));
    for (let i = 1; i < rates.length; i++) expect(rates[i]!).toBeLessThanOrEqual(rates[i - 1]!);
    expect(rates[0]!).toBeGreaterThan(rates[rates.length - 1]!);
  }, 60_000);

  it('suggested bankroll keeps bust at or under 5%, and a smaller step does not', async () => {
    const s = await suggestBankroll(input, sync);
    expect(s.bankroll).not.toBeNull();
    expect(s.bustRate).toBeLessThanOrEqual(0.05);
    expect(await bustRateAt(input, s.bankroll!, sync)).toBeLessThanOrEqual(0.05);
    // pinned down to within `step`: a bankroll one step lower is over the target
    expect(await bustRateAt(input, Math.max(1000, s.bankroll! - s.step), sync)).toBeGreaterThan(
      0.05,
    );
    // seeds the search never saw: the claim "under 5%" holds for the real thing, not just the sample
    // (1500 sessions: standard error 0.6%, so 6.5% would be 2.5 sigma over; twice the target fails)
    const fresh = await bustRateAt(input, s.bankroll!, {
      schedule: sync.schedule,
      seed: 7_000_000,
      sessions: 1500,
    });
    expect(fresh).toBeLessThan(0.065);
  }, 60_000);

  it('a stop-loss is reached by fewer sessions the lower it is set... and never by more than go broke', async () => {
    const hi = await planStopLossRate(input, 5_000, sync);
    const lo = await planStopLossRate(input, 25_000, sync);
    expect(hi).toBeGreaterThanOrEqual(lo);
    expect(hi).toBeLessThanOrEqual(1);
  }, 60_000);

  it('says so when no bankroll up to the cap is enough', async () => {
    const s = await suggestBankroll(
      { ...input, strategy: { id: 'any-7-every-roll', unit: 500 }, hours: 8 },
      { ...sync, capMultiple: 20 },
    );
    expect(s.bankroll).toBeNull();
    expect(s.bustRate).toBeGreaterThan(0.05);
  }, 60_000);

  it('can be aborted', async () => {
    const ac = new AbortController();
    const p = planRisk(input, { sessions: 500, signal: ac.signal });
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('stop-loss is the 1-in-10 loss, at least the expected loss, rounded up to $5, within the bankroll', () => {
    expect(suggestStopLoss({ p10: -8_300 }, 1_700, 30_000)).toBe(8_500);
    expect(suggestStopLoss({ p10: 400 }, 1_700, 30_000)).toBe(2_000);
    expect(suggestStopLoss({ p10: -90_000 }, 1_700, 30_000)).toBe(30_000);
  });
});
