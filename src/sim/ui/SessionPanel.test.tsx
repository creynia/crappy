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

describe('SessionPanel loss share (I023)', () => {
  it('shows each bet share of the loss and the takeaway sentence', () => {
    const base = stats(0, 1000, 183, 250_000);
    const { container } = render(
      <SessionPanel
        stats={{
          ...base,
          totalWagered: 10_000,
          byType: {
            field: {
              count: 5,
              wagered: 1000,
              won: 0,
              lost: 1000,
              vig: 0,
              net: -1000,
              expectedLoss: 56,
            },
            'pass-line': {
              count: 5,
              wagered: 9000,
              won: 0,
              lost: 0,
              vig: 0,
              net: 0,
              expectedLoss: 127,
            },
          },
        }}
        rollCount={10}
      />,
    );
    const share = [...container.querySelectorAll('[data-k="loss-share"]')].map(
      (td) => td.textContent,
    );
    expect(share).toEqual(['69%', '31%']); // rows sort by wagered, pass line first
    expect(container.querySelector('.sim-session-note')?.textContent).toContain(
      'Field bets were 10% of your action but 31% of your expected loss.',
    );
  });
});
