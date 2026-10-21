import type { Cents } from '../engine/types';

/** Starting-bankroll chips in the Auto-roll panel: $200, $500, $1,000, $5,000. */
export const BANKROLL_CHIPS: Cents[] = [20_000, 50_000, 100_000, 500_000];
/** localStorage key for the last starting-bankroll pick (sandbox only). */
export const AUTOROLL_BANKROLL_KEY = 'crappy.autoroll.bankroll';
/** Upper limit for a custom starting bankroll: $1,000,000. */
export const MAX_BANKROLL: Cents = 100_000_000;

export type BankrollParse = { ok: true; cents: Cents } | { ok: false; message: string };

/** Parse a whole-dollar entry such as "2500" into cents, with a message the learner can act on. */
export function parseBankroll(text: string, tableMin: Cents): BankrollParse {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return { ok: false, message: 'Enter whole dollars, like 2500.' };
  const cents = Number(t) * 100;
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return { ok: false, message: 'Enter a bankroll above $0.' };
  }
  if (cents < tableMin) {
    return { ok: false, message: `The table minimum is $${Math.round(tableMin / 100)}.` };
  }
  if (cents > MAX_BANKROLL) return { ok: false, message: 'The maximum is $1,000,000.' };
  return { ok: true, cents };
}
