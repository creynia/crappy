import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGame } from '../engine';
import { SimControls, type Panels } from './SimControls';

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});

const panels: Panels = { auto: false, session: false, log: false, menu: false };

function controls(
  game = createGame({ bankroll: 100000, bets: [{ type: 'pass-line', amount: 1000 }] }),
) {
  return (
    <SimControls
      ui={{}}
      chips={[100, 500]}
      chip={500}
      game={game}
      onSelectChip={vi.fn()}
      onRoll={vi.fn()}
      rollDisabled={false}
      busy={false}
      lock={null}
      view="table"
      setView={vi.fn()}
      autoAvailable={false}
      showMenu={false}
      panels={panels}
      onToggle={vi.fn()}
    />
  );
}

describe('cost unit toggle (I043)', () => {
  it('starts per roll, cycles to per hour, per $100 bet and back, and shows each change', () => {
    render(controls());
    const btn = () => document.querySelector('.sim-cost-cycle') as HTMLButtonElement;
    expect(btn().getAttribute('aria-label')).toContain('Expected cost: $0.04 per roll');
    expect(btn().textContent).toBe('$0.04/roll');
    fireEvent.click(btn());
    expect(btn().getAttribute('aria-label')).toContain('Expected cost: $4.19 per hour');
    expect(btn().textContent).toBe('$4.19/hr');
    fireEvent.click(btn());
    expect(btn().getAttribute('aria-label')).toContain('Expected cost: $1.41 per $100 bet');
    expect(btn().textContent).toBe('$1.41/$100');
    fireEvent.click(btn());
    expect(btn().getAttribute('aria-label')).toContain('Expected cost: $0.04 per roll');
    expect(btn().textContent).toBe('$0.04/roll');
  });

  it('keeps the unit chosen on this device, and Roll stays in place with no bets', async () => {
    window.localStorage.setItem('crappy.sim.costUnit', 'bet100');
    render(controls());
    await act(async () => {});
    expect(document.querySelector('.sim-cost-cycle')!.textContent).toBe('$1.41/$100');
    cleanup();
    render(controls(createGame({ bankroll: 100000 })));
    expect(document.querySelector('.sim-cost-cycle:not(.sim-cost-cycle-empty)')).toBeNull();
    expect(screen.getByRole('button', { name: /Roll/ })).toBeTruthy();
    expect(document.querySelector('.sim-roll-row')).toBeTruthy();
  });
});
