import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import type { SessionStats } from '../engine/types';
import { SessionPanel } from './SessionPanel';

afterEach(cleanup);

const stats = (
  won: number,
  lost: number,
  expectedLoss: number,
  variance: number,
): SessionStats => ({
  totalWagered: 10_000,
  totalWon: won,
  totalLost: lost,
  totalVig: 0,
  expectedLoss,
  variance,
  byType: {},
});

describe('SessionPanel luck band', () => {
  it('says within the normal range for |z| < 2', () => {
    render(<SessionPanel stats={stats(0, 1000, 100, 250_000)} rollCount={5} />);
    expect(screen.getByText(/within the normal range/)).toBeTruthy();
  });
  it('says unusually unlucky below -2', () => {
    render(<SessionPanel stats={stats(0, 5000, 100, 250_000)} rollCount={5} />);
    expect(screen.getByText(/unusually unlucky/)).toBeTruthy();
  });
  it('says unusually lucky above +2', () => {
    render(<SessionPanel stats={stats(5000, 0, 100, 250_000)} rollCount={5} />);
    expect(screen.getByText(/unusually lucky/)).toBeTruthy();
  });
  it('a session with nothing resolved yet shows no verdict bar', () => {
    render(<SessionPanel stats={stats(0, 1000, 0, 0)} rollCount={5} />);
    expect(screen.getByText(/too early to say/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('says so when the save predates luck tracking', () => {
    render(<SessionPanel stats={stats(0, 1000, 100, NaN)} rollCount={5} />);
    expect(screen.getByText(/not available/)).toBeTruthy();
  });
});

describe('SessionPanel bankroll note (I057)', () => {
  it('says how many decisions the bankroll covers when the layout exposure is over a quarter of it', () => {
    const { container } = render(
      <SessionPanel
        stats={stats(0, 1000, 100, 250_000)}
        rollCount={5}
        exposure={60_000}
        bankroll={50_000}
      />,
    );
    const note = container.querySelector('.sim-session-note');
    expect(note?.textContent).toContain('does not cover one decision');
    expect(note?.getAttribute('role')).toBeNull();
    expect(container.querySelector('[aria-live]')).toBeNull();
  });

  it('shows no note for a small exposure, or when no exposure is given', () => {
    const { container } = render(
      <SessionPanel
        stats={stats(0, 1000, 100, 250_000)}
        rollCount={5}
        exposure={6_000}
        bankroll={50_000}
      />,
    );
    expect(container.querySelector('.sim-session-note')).toBeNull();
    const none = render(<SessionPanel stats={stats(0, 1000, 100, 250_000)} rollCount={5} />);
    expect(none.container.querySelector('.sim-session-note')).toBeNull();
  });
});
