import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import { AutoRollPanel } from './AutoRollPanel';
import { PlanPanel } from './PlanPanel';

async function until(el: HTMLElement, selector: string, ms = 20_000) {
  const end = Date.now() + ms;
  while (!el.querySelector(selector) && Date.now() < end)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
}
const pressed = (el: HTMLElement, group: string, text: string) =>
  [...el.querySelectorAll(`[aria-label="${group}"] button`)].find((b) => b.textContent === text) as
    HTMLButtonElement | undefined;

describe('PlanPanel', () => {
  it('shows the analytic expected loss at once, then simulated risk and a bankroll suggestion', async () => {
    const el = document.createElement('div');
    render(<PlanPanel bankroll={10_000} debounceMs={0} />, el);
    // instant: before any simulation finishes
    expect(el.querySelector('[data-testid="plan-expected"]')!.textContent).toMatch(
      /expected loss over 400 rolls/,
    );
    expect(el.querySelector('[data-testid="plan-risk"]')).toBeNull();
    await until(el, '[data-testid="plan-suggest"]');
    const risk = el.querySelector('[data-testid="plan-risk"]')!.textContent;
    expect(risk).toMatch(/Goes broke before the end: \d+(\.\d)?% of 500 simulated sessions/);
    expect(risk).toMatch(/Finishes ahead/);
    // $100 against $10 + max odds goes broke often, so a bigger bankroll is suggested
    expect(el.querySelector('[data-testid="plan-suggest"]')!.textContent).toMatch(
      /gets that under 5%/,
    );
    expect(el.querySelector('[data-testid="plan-stop"]')!.textContent).toMatch(/stop-loss: \$/);
  }, 60_000);

  it('changing an input restarts: the old result disappears and the expected loss updates', async () => {
    const el = document.createElement('div');
    render(<PlanPanel bankroll={100_000} debounceMs={0} />, el);
    await until(el, '[data-testid="plan-risk"]');
    const before = el.querySelector('[data-testid="plan-expected"]')!.textContent;
    await act(() => {
      pressed(el, 'Hours', '8 h')!.click();
    });
    expect(el.querySelector('[data-testid="plan-risk"]')).toBeNull();
    expect(el.querySelector('[data-testid="plan-expected"]')!.textContent).toMatch(/800 rolls/);
    expect(el.querySelector('[data-testid="plan-expected"]')!.textContent).not.toBe(before);
    await until(el, '[data-testid="plan-risk"]');
    expect(el.querySelector('[data-testid="plan-risk"]')).not.toBeNull();
  }, 60_000);

  it('is reachable from the auto-roll panel through the Plan tab', async () => {
    const el = document.createElement('div');
    render(<AutoRollPanel />, el);
    expect(el.querySelector('[data-testid="plan-panel"]')).toBeNull();
    await act(() => {
      pressed(el, 'Auto-roll mode', 'Plan')!.click();
    });
    expect(el.querySelector('[data-testid="plan-panel"]')).not.toBeNull();
    await act(() => {
      pressed(el, 'Auto-roll mode', 'Run')!.click();
    });
    expect(el.querySelector('[data-testid="auto-roll-run"]')).not.toBeNull();
  });

  it('is not offered in a scripted lesson (fixed strategies)', () => {
    const el = document.createElement('div');
    render(<AutoRollPanel config={{ defaultStrategy: { id: 'pass-max-odds', unit: 500 } }} />, el);
    expect(pressed(el, 'Auto-roll mode', 'Plan')).toBeUndefined();
  });
});
