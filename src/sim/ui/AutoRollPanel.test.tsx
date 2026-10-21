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

  it("crapless rules: don't-side strategies are disabled and labelled", () => {
    const el = document.createElement('div');
    render(<AutoRollPanel rules="crapless" initialSeed={1} />, el);
    const opt = (id: string) =>
      el.querySelector<HTMLOptionElement>(`select[aria-label="Strategy"] option[value="${id}"]`)!;
    expect(opt('dont-pass-max-lay').disabled).toBe(true);
    expect(opt('dont-pass-max-lay').textContent).toContain('(not on crapless)');
    expect(opt('pass-max-odds').disabled).toBe(false);
    const std = document.createElement('div');
    render(<AutoRollPanel rules="standard-vegas" initialSeed={1} />, std);
    expect(
      std.querySelector<HTMLOptionElement>('option[value="dont-pass-max-lay"]')!.disabled,
    ).toBe(false);
  });
});

describe('AutoRollPanel starting bankroll', () => {
  const bustRow = (el: HTMLElement) =>
    [...el.querySelectorAll('[data-testid="auto-roll-summary"] tbody tr')].find((tr) =>
      tr.textContent?.startsWith('Busted sessions'),
    ) ?? null;
  const bustRate = (el: HTMLElement) => parseFloat(bustRow(el)!.querySelector('td')!.textContent);
  const clickButton = async (el: HTMLElement, name: string) => {
    await act(async () => {
      const b = [...el.querySelectorAll('button')].find((x) => x.textContent === name)!;
      b.click();
      await new Promise((r) => setTimeout(r, 50));
    });
  };

  it('a $5,000 run starts at $5,000 and busts less often than a $200 run on the same seed', async () => {
    const config = { rollOptions: [100], sessions: [100] };
    const small = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} bankroll={20_000} config={config} />, small);
    await click(small, '[data-testid="auto-roll-run"]');
    await waitUntil(() => bustRow(small));
    const smallRate = bustRate(small);

    const big = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} bankroll={20_000} config={config} />, big);
    await clickButton(big, '$5,000');
    await click(big, '[data-testid="auto-roll-run"]');
    await waitUntil(() => bustRow(big));
    const bigRate = bustRate(big);
    const start = [...big.querySelectorAll('[data-testid="auto-roll-summary"] tbody tr')].find(
      (tr) => tr.textContent?.startsWith('Starting bankroll'),
    )!;
    expect(start.querySelector('td')!.textContent).toBe('$5,000.00');
    expect(bigRate).toBeLessThan(smallRate);
  });
});

describe('AutoRollPanel bankroll controls', () => {
  const group = (el: HTMLElement, label: string) =>
    el.querySelector(`[role="group"][aria-label="${label}"]`) as HTMLElement;
  const btn = (scope: HTMLElement, text: string) =>
    [...scope.querySelectorAll('button')].find((b) => b.textContent === text) as HTMLButtonElement;
  const config = { rollOptions: [100], sessions: [100] };

  it('disables stop-if-down chips above the starting bankroll', () => {
    const el = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} bankroll={20_000} config={config} />, el);
    expect(btn(group(el, 'Stop when behind by'), '$250').disabled).toBe(true);
    expect(btn(group(el, 'Stop when behind by'), '$50').disabled).toBe(false);
  });

  it('clears a selected stop-if-down that becomes larger than the new bankroll', async () => {
    const el = document.createElement('div');
    render(
      <AutoRollPanel initialSeed={7} bankroll={50_000} config={{ ...config, stopLoss: 25_000 }} />,
      el,
    );
    expect(btn(group(el, 'Stop when behind by'), '$250').getAttribute('aria-pressed')).toBe('true');
    await act(async () => {
      btn(group(el, 'Starting bankroll'), '$200').click();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(btn(group(el, 'Stop when behind by'), '$250').getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('marks invalid custom input and clears the error when the field is emptied', async () => {
    const el = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} bankroll={50_000} config={config} />, el);
    const input = group(el, 'Starting bankroll').querySelector('input') as HTMLInputElement;
    await act(async () => {
      input.value = '4';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#bankroll-error')!.textContent).toContain('table minimum');
    expect(input.getAttribute('aria-describedby')).toBe('bankroll-error');
    await act(async () => {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(el.querySelector('#bankroll-error')).toBeNull();
  });

  it('shows the table value and disables the Table chip when it is below the table minimum', () => {
    const el = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} bankroll={312_00} config={config} />, el);
    expect(btn(group(el, 'Starting bankroll'), 'Table ($312)')).toBeTruthy();
    const small = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} bankroll={300} config={config} />, small);
    expect(btn(group(small, 'Starting bankroll'), 'Table ($3)').disabled).toBe(true);
  });

  it('remembers the sandbox bankroll pick, and ignores storage that throws', async () => {
    const key = 'crappy.test.autoroll.bankroll';
    window.localStorage.removeItem(key);
    const el = document.createElement('div');
    render(
      <AutoRollPanel initialSeed={7} bankroll={50_000} persistKey={key} config={config} />,
      el,
    );
    await act(async () => {
      btn(group(el, 'Starting bankroll'), '$1,000').click();
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(window.localStorage.getItem(key)).toBe('100000');
    const again = document.createElement('div');
    render(
      <AutoRollPanel initialSeed={7} bankroll={50_000} persistKey={key} config={config} />,
      again,
    );
    expect(btn(group(again, 'Starting bankroll'), '$1,000').getAttribute('aria-pressed')).toBe(
      'true',
    );
    window.localStorage.removeItem(key);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const blocked = document.createElement('div');
    expect(() =>
      render(
        <AutoRollPanel initialSeed={7} bankroll={50_000} persistKey={key} config={config} />,
        blocked,
      ),
    ).not.toThrow();
    spy.mockRestore();
  });

  it('a scene with no table equity still runs: Table is disabled and the run uses $500', async () => {
    const el = document.createElement('div');
    render(<AutoRollPanel initialSeed={7} bankroll={0} config={config} />, el);
    await waitUntil(() =>
      btn(group(el, 'Starting bankroll'), '$500').getAttribute('aria-pressed') === 'true'
        ? true
        : null,
    );
    expect(btn(group(el, 'Starting bankroll'), 'Table ($0.00)').disabled).toBe(true);
    expect(btn(group(el, 'Starting bankroll'), 'Table ($0.00)').getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(el.textContent).toContain('Table has $0.00, so runs start at $500.');
    await click(el, '[data-testid="auto-roll-run"]');
    await waitUntil(() => el.querySelector('[data-testid="auto-roll-output"]'));
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelector('[data-testid="auto-roll-summary"]')!.textContent).toContain('$500.00');
  });
});
