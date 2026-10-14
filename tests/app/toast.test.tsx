import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { UpdateToast, type UpdateSubscribe } from '../../src/app/components/UpdateToast';

describe('UpdateToast', () => {
  it('appears on update and calls apply on Reload', async () => {
    const apply = vi.fn();
    let fire: (a: () => void) => void = () => {};
    const subscribe: UpdateSubscribe = (l) => {
      fire = l;
      return () => {};
    };
    const el = document.createElement('div');
    await act(() => {
      render(<UpdateToast subscribe={subscribe} />, el);
    });
    expect(el.textContent).toBe('');
    await act(() => fire(apply));
    expect(el.textContent).toContain('Update available');
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Reload')!;
    await act(() => btn.click());
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
