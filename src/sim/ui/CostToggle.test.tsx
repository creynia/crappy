import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { createGame } from '../engine';
import { CostToggle } from './CostToggle';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

const passGame = () =>
  createGame({ bankroll: 100000, bets: [{ type: 'pass-line', amount: 1000 }] });

describe('CostToggle (I043)', () => {
  it('starts per roll, cycles per hour and per $100 bet, and names the unit in aria-label', () => {
    const { container } = render(<CostToggle game={passGame()} />);
    const btn = () => container.querySelector('.sim-cost-toggle') as HTMLButtonElement;
    expect(btn().textContent).toBe('$0.04/roll');
    expect(btn().getAttribute('aria-label')).toContain('Expected cost: $0.04 per roll');
    fireEvent.click(btn());
    expect(btn().textContent).toBe('$4.19/hr');
    expect(btn().getAttribute('aria-label')).toContain('Tap to show per $100 bet');
    fireEvent.click(btn());
    expect(btn().textContent).toBe('$1.41/$100');
    fireEvent.click(btn());
    expect(btn().textContent).toBe('$0.04/roll');
  });

  it('remembers the unit on this device and renders nothing with no bets', () => {
    window.localStorage.setItem('crappy.sim.costUnit', 'bet100');
    const { container } = render(<CostToggle game={passGame()} />);
    expect(container.querySelector('.sim-cost-toggle')!.textContent).toBe('$1.41/$100');
    cleanup();
    const empty = render(<CostToggle game={createGame({ bankroll: 100000 })} />);
    expect(empty.container.querySelector('.sim-cost-toggle')).toBeNull();
  });
});
