import { render } from 'preact';
import { describe, expect, it } from 'vitest';
import { createGame } from '../engine/game';
import type { BetInit } from '../engine/game';
import { centerLayout, landscapeLayout, portraitLayout } from './layouts';
import type { TableLayout } from './layouts/types';
import { Table, type StackAnnotation } from './Table';

type R = { x: number; y: number; w: number; h: number };
const hit = (a: R, b: R) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A crowded layout: line + odds, two come bets with odds, place bets in the same boxes, props. */
const DENSE: BetInit[] = [
  { ref: 'p', type: 'pass-line', amount: 1000 },
  { type: 'pass-odds', amount: 2000, parentRef: 'p' },
  { ref: 'c6', type: 'come', amount: 1000, point: 6 },
  { type: 'come-odds', amount: 2000, parentRef: 'c6' },
  { ref: 'c8', type: 'come', amount: 1000, point: 8 },
  { type: 'come-odds', amount: 2000, parentRef: 'c8' },
  { type: 'dont-come', amount: 1000, point: 9 },
  { type: 'come', amount: 1000 },
  { type: 'place-6', amount: 1200 },
  { type: 'place-8', amount: 1200 },
  { type: 'field', amount: 500 },
  { type: 'big-6', amount: 1000 },
  { type: 'hard-8', amount: 500 },
  { type: 'any-7', amount: 500 },
  { type: 'yo-11', amount: 500 },
];

function badgeRects(layout: TableLayout, text: string): R[] {
  const g = createGame({ seed: 1, bankroll: 1_000_000, phase: 'point', point: 4, bets: DENSE });
  const annotate = new Map<string, StackAnnotation>(
    g.bets.map((b) => [b.id, { text, tone: 'wrong' as const, name: b.type }]),
  );
  const el = document.createElement('div');
  render(<Table layout={layout} bets={g.bets} point={4} annotate={annotate} />, el);
  return [...el.querySelectorAll('.sim-call rect')].map((r) => ({
    x: Number(r.getAttribute('x')),
    y: Number(r.getAttribute('y')),
    w: Number(r.getAttribute('width')),
    h: Number(r.getAttribute('height')),
  }));
}

describe('Table annotate badges', () => {
  it.each([
    ['portrait', portraitLayout],
    ['landscape', landscapeLayout],
    ['center', centerLayout],
  ] as const)('%s: no two badges overlap on a dense layout, even with the longest call', (_, l) => {
    for (const text of ['Wins', 'Travels', 'Pushes', '?']) {
      const rects = badgeRects(l, text);
      expect(rects.length).toBeGreaterThan(0);
      for (let i = 0; i < rects.length; i++) {
        const a = rects[i]!;
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x + a.w).toBeLessThanOrEqual(l.viewBox.w);
        for (let j = i + 1; j < rects.length; j++)
          expect(hit(a, rects[j]!), `${text} #${i} vs #${j}`).toBe(false);
      }
    }
  });

  it('names the stack with the given name and spoken call', () => {
    const g = createGame({ seed: 1, phase: 'point', point: 4, bets: DENSE.slice(2, 4) });
    const annotate = new Map<string, StackAnnotation>([
      [
        g.bets[0]!.id,
        { text: 'Wins', tone: 'wrong', name: 'Come on 6', spoken: 'Wins, wrong, Stays' },
      ],
    ]);
    const el = document.createElement('div');
    render(<Table layout={portraitLayout} bets={g.bets} point={4} annotate={annotate} />, el);
    const stack = el.querySelector(`[data-stack="${g.bets[0]!.id}"]`)!;
    expect(stack.getAttribute('aria-label')).toBe('Come on 6, $10: Wins, wrong, Stays');
    expect(stack.querySelector('.sim-stack-target')!.getAttribute('r')).toBe(
      String(portraitLayout.chipRadius * 1.5),
    );
  });
});
