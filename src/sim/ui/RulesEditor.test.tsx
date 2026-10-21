import { fireEvent, render, screen } from '@testing-library/preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveRules } from '../engine/rules';
import type { TableRules } from '../engine/types';
import { Simulator } from '../index';
import { AutoRollPanel } from './AutoRollPanel';
import { RulesEditor } from './RulesEditor';

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
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

function editor(initial: TableRules = resolveRules()) {
  const onApply = vi.fn<(r: TableRules) => void>();
  const { container } = render(
    <RulesEditor initial={initial} onApply={onApply} onCancel={() => {}} />,
  );
  const el = (name: string) => container.querySelector(`[name="${name}"]`) as HTMLInputElement;
  const pick = (name: string, value: string) => change(el(name), value);
  const apply = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    return onApply.mock.calls.at(-1)![0];
  };
  return { container, el, pick, apply, onApply };
}

describe('RulesEditor: each field maps to TableRules', () => {
  it('applies the starting rules unchanged', () => {
    expect(editor().apply()).toEqual(resolveRules());
  });
  it('max odds sets maxOdds and the matching lay limit', () => {
    const e = editor();
    e.pick('odds', '10x');
    expect(e.apply()).toEqual({ ...resolveRules('odds-10x'), presetId: 'standard-vegas' });
    e.pick('odds', '2x');
    const r = e.apply();
    // (the tables also list the crapless points 2/3/11/12; I036)
    expect(r.maxOdds).toMatchObject({ 4: 2, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2 });
    expect(r.maxLayOdds).toMatchObject({ 4: 4, 5: 3, 6: 2.4, 8: 2.4, 9: 3, 10: 4 });
  });
  it('field 12, vig timing and rounding, payout unit, table min and max', () => {
    const e = editor();
    e.pick('field12', '3');
    e.pick('vigTiming', 'upfront');
    e.pick('vigRounding', 'exact-cents');
    e.pick('payoutUnit', '50');
    e.pick('tableMin', '1500');
    e.pick('tableMax', '100000');
    expect(e.apply()).toEqual({
      ...resolveRules(),
      fieldPays: { 2: 2, 12: 3 },
      vig: { rate: 0.05, timing: 'upfront', rounding: 'exact-cents' },
      payoutUnit: 50,
      tableMin: 1500,
      tableMax: 100_000,
    });
  });
  it('the four on/off rules', () => {
    const e = editor();
    for (const k of [
      'placeBetsWorkOnComeOut',
      'hardwaysWorkOnComeOut',
      'comeOddsWorkOnComeOut',
      'allowPutBets',
    ] as const) {
      fireEvent.click(e.el(k));
      expect(e.apply()[k]).toBe(true);
    }
  });
  it('the live summary follows the form', () => {
    const e = editor();
    const summary = () => e.container.querySelector('[data-testid="rules-summary"]')!.textContent;
    expect(summary()).toContain('Pass $10 + max odds: 0.37%');
    expect(summary()).toContain('Buy 4 $25: 1.33%');
    e.pick('vigTiming', 'upfront');
    e.pick('field12', '3');
    expect(summary()).toContain('Buy 4 $25: 3.85%');
    expect(summary()).toContain('Field $5: 2.78%');
  });
  it('keeps an odds limit or table minimum a scene set, without forcing a choice', () => {
    const e = editor(
      resolveRules({ maxOdds: { 4: 7, 5: 7, 6: 7, 8: 7, 9: 7, 10: 7 }, tableMin: 300 }),
    );
    expect(e.el('odds').value).toBe('');
    expect(e.el('tableMin').value).toBe('300');
    expect(e.apply().maxOdds[6]).toBe(7);
  });
});

describe('rules editor: game variant', () => {
  it('shows and keeps crapless; switching the game is explicit', () => {
    const e = editor(resolveRules('crapless'));
    expect(e.el('variant').value).toBe('crapless');
    expect(e.apply().variant).toBe('crapless');
    e.pick('odds', '10x');
    expect(e.apply().maxOdds[2]).toBe(10);
    e.pick('variant', 'standard');
    expect(e.apply().variant).toBe('standard');
    e.pick('variant', 'crapless');
    expect(e.apply().maxOdds[12]).toBe(10);
    const s = editor();
    expect(s.el('variant').value).toBe('standard');
  });
});

describe('sandbox: custom rules from the menu', () => {
  const open = (container: Element) => {
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    return container.querySelector('.sim-menu select') as HTMLSelectElement;
  };
  it('applies upfront vig to the table and restores it after a reload', () => {
    const first = render(<Simulator initialSettings={{ speed: 'instant' }} persistKey="t" />);
    const sel = open(first.container);
    change(sel, 'custom');
    change(first.container.querySelector('[name="vigTiming"]'), 'upfront');
    fireEvent.click(screen.getByRole('button', { name: /^Apply/ }));
    expect(sel.value).toBe('custom');
    // place a bet so the restored table is recognisably the same one
    fireEvent.click(first.container.querySelector('[data-region="pass"]')!);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    first.unmount();

    const again = render(<Simulator initialSettings={{ speed: 'instant' }} persistKey="t" />);
    expect(again.container.textContent).toContain('On table $5');
    const sel2 = open(again.container);
    expect(sel2.value).toBe('custom');
    fireEvent.click(screen.getByRole('button', { name: 'Edit custom rules' }));
    expect((again.container.querySelector('[name="vigTiming"]') as HTMLSelectElement).value).toBe(
      'upfront',
    );
  });
  it('a custom form equal to a preset applies as that preset', () => {
    const { container } = render(<Simulator initialSettings={{ speed: 'instant' }} />);
    const sel = open(container);
    change(sel, 'custom');
    change(container.querySelector('[name="odds"]'), '10x');
    fireEvent.click(screen.getByRole('button', { name: /^Apply/ }));
    expect(sel.value).toBe('odds-10x');
  });
});

describe('auto-roll panel: custom rules', () => {
  it('Custom… opens the editor and the runs use the applied rules', async () => {
    const { container } = render(
      <AutoRollPanel config={{ defaultStrategy: { id: 'field-every-roll', unit: 500 } }} />,
    );
    const sel = [...container.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => o.value === 'custom'),
    )!;
    change(sel, 'custom');
    change(container.querySelector('[name="field12"]'), '3');
    // plus a payout unit, so the form is not just the "field 3x on 12" preset
    change(container.querySelector('[name="payoutUnit"]'), '50');
    void act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    });
    expect(container.querySelector('form.sim-rules')).toBeNull();
    expect(sel.value).toBe('custom');
    void act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit custom rules' }));
    });
    expect((container.querySelector('[name="field12"]') as HTMLSelectElement).value).toBe('3');
    // the run's edge reflects the custom rules: field 3x on 12 is 2.78% (5.56% standard)
    await act(async () => {
      (container.querySelector('[data-testid="auto-roll-run"]') as HTMLElement).click();
      await new Promise((r) => setTimeout(r, 50));
    });
    const summary = container.querySelector('[data-testid="auto-roll-summary"]')!.textContent;
    expect(summary).toContain('2.78%');
    expect(summary).not.toContain('5.56%');
  });
  it('a form equal to a preset selects that preset', () => {
    const { container } = render(<AutoRollPanel />);
    const sel = [...container.querySelectorAll('select')].find((s) =>
      [...s.options].some((o) => o.value === 'custom'),
    )!;
    change(sel, 'custom');
    change(container.querySelector('[name="odds"]'), '100x');
    void act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    });
    expect(sel.value).toBe('odds-100x');
  });
});
