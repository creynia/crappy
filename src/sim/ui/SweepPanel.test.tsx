import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { SweepPanel } from './SweepPanel';
import { AutoRollPanel } from './AutoRollPanel';

const sweep = {
  strategy: 'pass-max-odds' as const,
  oddsMultiples: [0, 1, 2, 'max' as const, 10, 100],
};

async function run(el: HTMLElement) {
  await act(async () => {
    (el.querySelector('[data-testid="sweep-run"]') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
  });
  for (let i = 0; i < 100 && !el.querySelector('[data-testid="sweep-row"]'); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
  }
}

describe('SweepPanel', () => {
  it('shows one row per multiple with the analytic edges and constant expected loss', async () => {
    const el = document.createElement('div');
    render(<SweepPanel config={sweep} bankroll={10_000_000} />, el);
    await run(el);
    const rows = [...el.querySelectorAll('[data-testid="sweep-row"]')];
    expect(rows).toHaveLength(6);
    const cells = rows.map((r) => [...r.querySelectorAll('th,td')].map((c) => c.textContent));
    expect(cells.map((c) => c[1])).toEqual([
      '1.41%',
      '0.848%',
      '0.606%',
      '0.374%',
      '0.184%',
      '0.021%',
    ]);
    expect(new Set(cells.map((c) => c[2])).size).toBe(1);
  }, 10_000);

  it('AutoRollPanel renders the sweep when the scene configures one', () => {
    const el = document.createElement('div');
    render(<AutoRollPanel config={{ sweep }} />, el);
    expect(el.querySelector('[data-testid="sweep-panel"]')).not.toBeNull();
  });
});
