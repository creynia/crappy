import type { BetTypeId, SessionStats } from '../engine/types';
import { luckOf, luckText } from '../math/luck';
import { betLabel, fmtMoney, fmtPct } from './text';

export interface SessionPanelProps {
  stats: SessionStats;
  rollCount: number;
}

/** Curriculum 6.4: total bet, expected, actual, luck, edge per dollar, and the per-bet breakdown. */
export function SessionPanel({ stats, rollCount }: SessionPanelProps) {
  const actual = stats.totalWon - stats.totalLost;
  const expected = -stats.expectedLoss;
  const luck = actual - expected;
  const band = luckOf(stats);
  const edge = stats.totalWagered > 0 ? stats.expectedLoss / stats.totalWagered : null;
  const rows = (
    Object.entries(stats.byType) as [BetTypeId, NonNullable<SessionStats['byType'][BetTypeId]>][]
  )
    .filter(([, s]) => s.count > 0)
    .sort((a, b) => b[1].wagered - a[1].wagered);
  if (rollCount === 0)
    return (
      <section class="sim-session-panel" aria-label="Session summary">
        <h3>Session</h3>
        <p class="sim-muted">
          Roll a few times and this panel shows what you bet, what the math expected, and how lucky
          you were.
        </p>
      </section>
    );
  return (
    <section class="sim-session-panel" aria-label="Session summary">
      <h3>
        Session after {rollCount} {rollCount === 1 ? 'roll' : 'rolls'}
      </h3>
      <dl class="sim-session-grid">
        <div>
          <dt>Total bet</dt>
          <dd data-k="total-bet">{fmtMoney(stats.totalWagered)}</dd>
        </div>
        <div>
          <dt>Expected result</dt>
          <dd data-k="expected">{fmtMoney(expected, { sign: true })}</dd>
        </div>
        <div>
          <dt>Actual result</dt>
          <dd data-k="actual">{fmtMoney(actual, { sign: true })}</dd>
        </div>
        <div>
          <dt>Luck</dt>
          <dd data-k="luck">{fmtMoney(luck, { sign: true })}</dd>
        </div>
        <div>
          <dt>Edge per $ bet</dt>
          <dd data-k="edge">{edge === null ? 'n/a' : fmtPct(edge)}</dd>
        </div>
      </dl>
      <p class={`sim-luck-text is-${band.verdict}`} data-k="luck-band">
        Luck: {fmtMoney(luck, { sign: true })} — {luckText(band)}
      </p>
      {band.z !== null ? (
        <div
          class="sim-luck-bar"
          role="img"
          aria-label={`Luck is ${band.z.toFixed(1)} typical swings from expected, on a scale from -2 to +2`}
        >
          <span class="sim-luck-mid" />
          <span
            class="sim-luck-marker"
            style={{ left: `${(Math.max(-2.5, Math.min(2.5, band.z)) + 2.5) * 20}%` }}
          />
        </div>
      ) : null}
      {rows.length ? (
        <div class="sim-session-table-wrap">
          <table class="sim-session-table">
            <caption class="sim-sr">Per-bet breakdown</caption>
            <thead>
              <tr>
                <th scope="col">Bet</th>
                <th scope="col">Wagered</th>
                <th scope="col">Expected</th>
                <th scope="col">Actual</th>
                <th scope="col">Edge (5+ bets)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([t, s]) => (
                <tr key={t}>
                  <th scope="row">{betLabel(t)}</th>
                  <td>{fmtMoney(s.wagered)}</td>
                  <td>{fmtMoney(-s.expectedLoss, { sign: true })}</td>
                  <td>{fmtMoney(s.net, { sign: true })}</td>
                  <td>
                    {s.wagered > 0 && s.count >= 5 ? fmtPct(s.expectedLoss / s.wagered) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
