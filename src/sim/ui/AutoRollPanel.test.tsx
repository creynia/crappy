import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { AutoRollPanel } from './AutoRollPanel';

const spies = vi.hoisted(() => ({ simulateSession: null as null | ReturnType<typeof vi.fn> }));
vi.mock('../strategy', async (orig) => {
  const actual = await orig<typeof import('../strategy')>();
  const simulateSession = vi.fn(actual.simulateSession);
  spies.simulateSession = simulateSession;
  return { ...actual, simulateSession };
});

async function click(el: HTMLElement, selector: string) {
  await act(async () => {
    (el.querySelector(selector) as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
  });
}

/** Poll (inside act) until `check` returns a truthy value; the run is slow under CI load. */
async function waitUntil<T>(check: () => T | null | undefined | false): Promise<T> {
  let found: T | null | undefined | false = null;
  for (let i = 0; i < 80 && !found; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    found = check();
  }
  if (!found) throw new Error('timed out waiting for condition');
  return found;
}

describe('AutoRollPanel', () => {
  it('runs one session and shows the chart and summary', async () => {
    const el = document.createElement('div');
    const done = vi.fn();
    render(<AutoRollPanel initialSeed={7} onCompleted={done} />, el);
    await click(el, '[data-testid="auto-roll-run"]');
    expect(el.querySelector('[data-testid="bankroll-chart"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="auto-roll-summary"]')!.textContent).toContain(
      'Expected loss',
    );
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('runs 100 sessions with a band chart, survival tab and bust rate', async () => {
    const el = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} config={{ rollOptions: [10], sessions: [100] }} />, el);
    await click(el, '[data-testid="auto-roll-run"]');
    await waitUntil(() => el.querySelector('[data-role="band"]'));
    expect(el.querySelector('[data-role="band"]')).not.toBeNull();
    expect(el.textContent).toContain('Busted sessions');
  });

  it('shows the totals histogram for no-bet', async () => {
    const el = document.createElement('div');
    render(<AutoRollPanel config={{ defaultStrategy: { id: 'no-bet', unit: 500 } }} />, el);
    await click(el, '[data-testid="auto-roll-run"]');
    expect(el.querySelector('[data-testid="totals-histogram"]')).not.toBeNull();
  });

  it('compare mode draws one line per selected strategy', async () => {
    const el = document.createElement('div');
    render(<AutoRollPanel config={{ compareMode: true }} />, el);
    const boxes = el.querySelectorAll('input[type="checkbox"]');
    await act(async () => {
      boxes[3]!.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    });
    await click(el, '[data-testid="auto-roll-run"]');
    expect(el.querySelectorAll('[data-role="line"]').length).toBe(2);
  });

  it('learner-facing cost row comes from the run: Iron Cross at $5 is about $27 per 100 rolls', async () => {
    const el = document.createElement('div');
    render(
      <AutoRollPanel
        initialSeed={3}
        bankroll={200_000}
        config={{
          defaultStrategy: { id: 'iron-cross', unit: 500 },
          strategies: ['iron-cross'],
          rollOptions: [100],
          sessions: [100],
        }}
      />,
      el,
    );
    await click(el, '[data-testid="auto-roll-run"]');
    const row = await waitUntil(() =>
      [...el.querySelectorAll('[data-testid="auto-roll-summary"] tbody tr')].find((tr) =>
        tr.textContent?.startsWith('Expected cost per 100 rolls'),
      ),
    );
    const cost = Number(row.querySelector('td')!.textContent.replace(/[^0-9.]/g, ''));
    expect(cost).toBeGreaterThan(26);
    expect(cost).toBeLessThan(28);
    expect(row.querySelector('td')!.textContent).toMatch(/\.\d\d$/);
  });

  it('stop-win $50 passes stopWin 5000 to the simulator and shows the ended-by row', async () => {
    const el = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} />, el);
    const group = el.querySelector('[aria-label="Stop when ahead by"]') as HTMLElement;
    await click(group, 'button:nth-of-type(2)');
    await click(el, '[data-testid="auto-roll-run"]');
    expect(spies.simulateSession!.mock.calls.at(-1)![0]).toMatchObject({ stopWin: 5000 });
    expect(el.querySelector('[data-testid="auto-roll-summary"]')!.textContent).toMatch(
      /Stopped: up \$\d|All 100 rolls/,
    );
  });

  it('100 sessions with stop-win $50 show the share that ended by stop-win', async () => {
    const el = document.createElement('div');
    render(
      <AutoRollPanel
        initialSeed={7}
        config={{ rollOptions: [100], sessions: [100], stopWin: 5000 }}
      />,
      el,
    );
    await click(el, '[data-testid="auto-roll-run"]');
    for (let i = 0; i < 400; i++) {
      await act(async () => {
        await new Promise((r) => setTimeout(r, 25));
      });
      if (
        el
          .querySelector('[data-testid="auto-roll-summary"]')
          ?.textContent?.includes('% ended by stop-win')
      )
        break;
    }
    expect(el.querySelector('[data-testid="auto-roll-summary"]')!.textContent).toContain(
      '% ended by stop-win',
    );
  });

  it('"% of money bet" toggle swaps in the edge chart with axis labels and a summary', async () => {
    const el = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} config={{ rollOptions: [100], sessions: [1] }} />, el);
    await click(el, '[data-testid="auto-roll-run"]');
    expect(el.querySelector('[data-testid="edge-chart"]')).toBeNull();
    const toggle = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('% of money bet'),
    )!;
    await act(() => {
      toggle.click();
    });
    const chart = el.querySelector('[data-testid="edge-chart"]')!;
    expect(chart).not.toBeNull();
    expect(el.querySelector('[data-testid="bankroll-chart"]')).toBeNull();
    expect(chart.textContent).toContain('Rolls (log scale)');
    expect(chart.querySelector('svg desc')!.textContent).toContain('House edge');
    expect(chart.querySelector('[data-role="funnel"]')).not.toBeNull();
    expect(chart.querySelector('[data-role="house-edge"]')).not.toBeNull();
  });

  it('scene chart: edge opens on the edge chart', async () => {
    const el = document.createElement('div');
    render(
      <AutoRollPanel
        initialSeed={7}
        config={{ rollOptions: [100], sessions: [1], chart: 'edge' }}
      />,
      el,
    );
    await click(el, '[data-testid="auto-roll-run"]');
    expect(el.querySelector('[data-testid="edge-chart"]')).not.toBeNull();
  });
});
