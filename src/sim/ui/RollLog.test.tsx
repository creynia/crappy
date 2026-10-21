import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HistoryStrip } from './HistoryStrip';
import { RollLog } from './RollLog';
import type { RollLogEntry } from './rollLog';

afterEach(cleanup);

const entry = (n: number, net: number, point: RollLogEntry['point'] = null): RollLogEntry => ({
  id: `r${n}`,
  kind: 'roll',
  n,
  dice: [1, 2],
  total: 3,
  text: `Roll text ${n}.`,
  point,
  outcomes: net > 0 ? ['win'] : net < 0 ? ['lose'] : [],
  net,
  bankroll: 50_000 + net,
});

describe('RollLog', () => {
  it('lists newest first with list semantics', () => {
    render(<RollLog entries={[entry(1, 500), entry(2, -500), entry(3, 0, 'point-set')]} />);
    const list = screen.getByRole('list', { name: /newest first/i });
    const items = within(list).getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-roll'))).toEqual(['3', '2', '1']);
    expect(items[0]!.textContent).toContain('Roll 3. Roll text 3.');
  });

  it('filters wins, losses and point events', () => {
    render(<RollLog entries={[entry(1, 500), entry(2, -500), entry(3, 0, 'point-set')]} />);
    const ids = () => screen.getAllByRole('listitem').map((li) => li.getAttribute('data-roll'));
    fireEvent.click(screen.getByRole('button', { name: 'Wins' }));
    expect(ids()).toEqual(['1']);
    fireEvent.click(screen.getByRole('button', { name: 'Losses' }));
    expect(ids()).toEqual(['2']);
    fireEvent.click(screen.getByRole('button', { name: 'Point events' }));
    expect(ids()).toEqual(['3']);
  });

  it('scrolls to the focused roll', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<RollLog entries={[entry(1, 500), entry(2, -500)]} focusRoll={1} />);
    expect(scroll).toHaveBeenCalled();
    expect(document.querySelector('[data-roll="1"]')!.className).toContain('is-focus');
  });

  it('shows an empty state', () => {
    render(<RollLog entries={[]} />);
    expect(screen.getByText(/No rolls yet/)).toBeTruthy();
  });
});

describe('HistoryStrip pill tap', () => {
  it('reports the tapped roll number', () => {
    const onOpen = vi.fn();
    const rec = (n: number) => ({
      n,
      dice: [1, 2] as [number, number],
      total: 3,
      hard: false,
      phaseBefore: 'come-out' as const,
      pointBefore: null,
      forced: false,
      net: 0,
    });
    render(<HistoryStrip history={[rec(1), rec(2)] as never} onOpenAll={onOpen} />);
    fireEvent.click(screen.getAllByRole('listitem')[1]!);
    expect(onOpen).toHaveBeenCalledWith(1);
  });
});
