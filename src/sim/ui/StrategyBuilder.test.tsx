import { fireEvent, render } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { validateScene } from '../scene';
import { PRESETS_AS_CUSTOM, encodeCustom } from '../strategy/custom';
import { AutoRollPanel } from './AutoRollPanel';

/** Set a select's value and fire a native change (testing-library's change event does not reach
 * Preact's listener under happy-dom). */
function change(el: Element | null, value: string) {
  void act(() => {
    (el as HTMLSelectElement).value = value;
    el!.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

afterEach(() => {
  document.body.innerHTML = '';
});

const panel = () =>
  render(
    <AutoRollPanel
      config={{
        defaultStrategy: {
          id: 'custom',
          unit: 500,
          custom: { line: { side: 'pass', odds: 'max' } },
        },
      }}
    />,
  );
const q = (c: Element, name: string) => c.querySelector(`[name="${name}"]`) as HTMLSelectElement;

describe('StrategyBuilder in the auto-roll panel', () => {
  it('shows the builder for "My system" and starts from a known system', () => {
    const { container } = panel();
    expect(container.querySelector('.sim-sb')).not.toBeNull();
    expect(q(container, 'line').value).toBe('pass');
    const start = container.querySelector('.sim-sb select') as HTMLSelectElement;
    change(start, 'iron-cross');
    expect(q(container, 'line').value).toBe('none');
    expect(q(container, 'numbersKind').value).toBe('place');
    expect((q(container, 'n5') as unknown as HTMLInputElement).checked).toBe(true);
    expect(q(container, 'n5').getAttribute('aria-label')).toBe('Place 5');
    expect(q(container, 'u6').value).toBe('1.2');
    expect((q(container, 'field') as unknown as HTMLInputElement).checked).toBe(true);
    // the share link encodes exactly this system
    const link = container.querySelector('.sim-sb-link input') as HTMLInputElement;
    expect(link.value).toBe(`#/play?system=${encodeCustom(PRESETS_AS_CUSTOM['iron-cross']!)}`);
  });
  it('builds a Molly with a Martingale guard and runs it', async () => {
    const { container } = panel();
    change(q(container, 'comeCount'), '2');
    expect(q(container, 'onLoss').disabled).toBe(true); // Martingale cannot combine with come bets
    change(q(container, 'comeOdds'), '2');
    await act(async () => {
      (container.querySelector('[data-testid="auto-roll-run"]') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(container.querySelector('[data-testid="auto-roll-summary"]')).not.toBeNull();
  });
  it('a progression reports a simulated edge', async () => {
    const { container } = panel();
    change(q(container, 'comeCount'), '0');
    change(q(container, 'onLoss'), '5');
    await act(async () => {
      (container.querySelector('[data-testid="auto-roll-run"]') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(container.querySelector('[data-testid="auto-roll-summary"]')!.textContent).toMatch(
      /\d\.\d\d% \(simulated\)/,
    );
  });
  it('an empty system cannot run and says why', () => {
    const { container } = panel();
    change(q(container, 'line'), 'none');
    expect(container.querySelector('.sim-sb-errors')!.textContent).toContain(
      'needs at least one bet',
    );
    expect(
      (container.querySelector('[data-testid="auto-roll-run"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(container.querySelector('[data-testid="auto-roll-run"]')!);
    expect(container.querySelector('[data-testid="auto-roll-summary"]')).toBeNull();
  });
});

describe('scene validation: custom strategy specs', () => {
  const scene = (spec: unknown) => ({
    id: 's',
    version: 1,
    autoRoll: { enabled: true, defaultStrategy: spec },
  });
  it('accepts a valid custom system', () => {
    expect(
      validateScene(
        scene({ id: 'custom', unit: 500, custom: PRESETS_AS_CUSTOM['three-point-molly'] }),
      ),
    ).toMatchObject({ ok: true });
  });
  it('requires the system on id "custom" and validates it', () => {
    const r = validateScene(scene({ id: 'custom', unit: 500 }));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errors).toContain(
        'autoRoll.defaultStrategy.custom: the custom strategy needs its system',
      );
    const r2 = validateScene(
      scene({ id: 'custom', unit: 500, custom: { come: { count: 1, odds: 2 } } }),
    );
    expect(r2.ok).toBe(false);
    if (!r2.ok)
      expect(r2.errors).toContain('autoRoll.defaultStrategy.custom.come: needs a line bet');
  });
  it('rejects a system on another strategy', () => {
    const r = validateScene(
      scene({ id: 'place-6-8', unit: 500, custom: PRESETS_AS_CUSTOM['place-6-8'] }),
    );
    expect(r.ok).toBe(false);
  });
});
