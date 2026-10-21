/**
 * The I057 note: when one decision's worst-case exposure is over a quarter of the bankroll (fewer than four
 * decisions at full size), say how many decisions the bankroll covers. Shared by the auto-roll panel and the
 * session panel.
 */
export function bankrollNote(exposure: number, bankroll: number): string | null {
  if (!(exposure > 0) || !(exposure > bankroll * 0.25)) return null;
  const decisions = Math.floor(bankroll / exposure);
  return decisions >= 1
    ? `Your bankroll covers about ${decisions} decisions at this size; expect a high bust rate.`
    : 'Your bankroll does not cover one decision at this size; expect a high bust rate.';
}
