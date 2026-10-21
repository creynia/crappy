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
    render(<RollLog entries={[entry(1, 500), entry(2, -500)]} focus={{ n: 1, nonce: 1 }} />);
    expect(scroll).toHaveBeenCalled();
    const el = document.querySelector('[data-roll="1"]') as HTMLElement;
    expect(el.className).toContain('is-focus');
    expect(document.activeElement).toBe(el);
  });

  it('focuses the roll again on a repeat tap, even after a filter was chosen', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const entries = [entry(1, 500), entry(2, -500)];
    const { rerender } = render(<RollLog entries={entries} focus={{ n: 1, nonce: 1 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Losses' }));
    (document.activeElement as HTMLElement).blur();
    rerender(<RollLog entries={entries} focus={{ n: 1, nonce: 2 }} />);
    expect(document.activeElement).toBe(document.querySelector('[data-roll="1"]'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2); // back on All
  });

  it('renders the newest 100 and offers the rest', () => {
    const entries = Array.from({ length: 250 }, (_, i) => entry(i + 1, 0));
    render(<RollLog entries={entries} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(100);
    expect(screen.getAllByRole('listitem')[0]!.getAttribute('data-roll')).toBe('250');
    fireEvent.click(screen.getByRole('button', { name: /older rolls/ }));
    expect(screen.getAllByRole('listitem')).toHaveLength(200);
  });

  it('the list is keyboard reachable', () => {
    render(<RollLog entries={[entry(1, 0)]} />);
    expect(screen.getByRole('list', { name: /newest first/i }).getAttribute('tabindex')).toBe('0');
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
