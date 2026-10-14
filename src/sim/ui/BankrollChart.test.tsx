import { render } from 'preact';
import { describe, expect, it } from 'vitest';
import { BankrollChart, formatAxisMoney } from './BankrollChart';
import { TotalsHistogram } from './TotalsHistogram';

function walk(n: number, start: number, step: number): Float64Array {
  const a = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) a[i] = start + Math.sin(i / 7) * 800 + i * step;
  return a;
}

describe('BankrollChart', () => {
  it('renders one session: equity line, dashed expected line, break-even, accessible summary', () => {
    const el = document.createElement('div');
    render(
      <BankrollChart
        mode="running"
        start={50_000}
        series={[
          {
            id: 'a',
            label: 'Pass line',
            line: walk(100, 50_000, -5),
            expected: walk(100, 50_000, -4),
          },
        ]}
      />,
      el,
    );
    const svg = el.querySelector('svg[role="img"]')!;
    expect(svg.getAttribute('aria-labelledby')).toBeTruthy();
    expect(el.querySelector('[data-role="line"]')!.getAttribute('d')).toMatch(/^M/);
    expect(
      el.querySelector('[data-role="expected"]')!.getAttribute('stroke-dasharray'),
    ).toBeTruthy();
    expect(el.querySelector('[data-testid="break-even"]')).not.toBeNull();
    expect(el.textContent).toContain('Break even $500');
    expect(el.querySelector('desc')!.textContent).toContain('Pass line');
    expect(el.querySelectorAll('[data-testid="chart-summary"] tbody tr').length).toBe(2);
  });

  it('renders 100 sessions as percentile bands and downsamples long series', () => {
    const el = document.createElement('div');
    render(
      <BankrollChart
        mode="sessions"
        start={50_000}
        sessions={100}
        series={[
          {
            id: 'a',
            label: 'Pass line',
            line: walk(10_000, 50_000, -1),
            band: { lo: walk(10_000, 48_000, -2), hi: walk(10_000, 52_000, 0) },
            expected: walk(10_000, 50_000, -1),
          },
        ]}
      />,
      el,
    );
    expect(el.querySelector('[data-role="band"]')!.getAttribute('d')).toMatch(/Z$/);
    const d = el.querySelector('[data-role="line"]')!.getAttribute('d')!;
    expect(d.split('L').length).toBeLessThan(400);
    expect(el.textContent).toContain('10th percentile');
    expect(el.textContent).toContain('100 sessions');
  });

  it('renders multi-strategy compare lines and a survival chart in percent', () => {
    const el = document.createElement('div');
    const s = (id: string) => ({ id, label: id, line: Float64Array.from([1, 1, 0.9, 0.7]) });
    render(<BankrollChart mode="survival" start={50_000} series={[s('a'), s('b')]} />, el);
    expect(el.querySelectorAll('[data-role="line"]').length).toBe(2);
    const dashes = [...el.querySelectorAll('[data-role="line"]')].map((n) =>
      n.getAttribute('stroke-dasharray'),
    );
    expect(new Set(dashes).size).toBe(2);
    expect(el.querySelectorAll('[data-role="end-labels"] text').length).toBe(2);
    expect(el.querySelector('[data-testid="break-even"]')).toBeNull();
    expect(el.textContent).toContain('100%');
    expect(el.querySelector('desc')!.textContent).toContain('70%');
  });

  it('labels axes in dollars', () => {
    expect(formatAxisMoney(50_000)).toBe('$500');
    expect(formatAxisMoney(-2500)).toBe('-$25');
    expect(formatAxisMoney(150_000)).toBe('$1.5k');
  });
});

describe('TotalsHistogram', () => {
  it('shows counts against the 1-2-3-4-5-6-5-4-3-2-1 shape', () => {
    const el = document.createElement('div');
    const counts = new Int32Array(13);
    for (let t = 2; t <= 12; t++) counts[t] = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1][t]! * 10;
    render(<TotalsHistogram counts={counts} />, el);
    expect(el.querySelectorAll('[data-total]').length).toBe(11);
    expect(el.querySelector('desc')!.textContent).toContain('360 rolls');
    expect(el.textContent).toContain('1-2-3-4-5-6-5-4-3-2-1');
  });
});
