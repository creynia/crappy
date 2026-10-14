import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import content from 'virtual:content';
import { AppProviders } from '../../src/app/context';
import { Settings } from '../../src/app/screens/Settings';
import { MemoryStorage } from '../../src/app/storage';
import { Store } from '../../src/app/store';

async function mount(store: Store) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(() => {
    render(
      <AppProviders content={content} store={store}>
        <Settings />
      </AppProviders>,
      el,
    );
  });
  return el;
}
const btn = (el: HTMLElement, text: string) =>
  [...el.querySelectorAll('button')].find((b) => b.textContent === text)!;

describe('Settings', () => {
  it('import needs a second confirmation', async () => {
    const src = new Store(new MemoryStorage());
    src.completeLesson('a');
    const store = new Store(new MemoryStorage());
    const el = await mount(store);
    const ta = el.querySelector('textarea')!;
    await act(() => {
      ta.value = src.exportCode();
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(() => btn(el, 'Import').click());
    expect(store.status('a')).toBe('new');
    expect(el.textContent).toContain('Replace your current progress?');
    await act(() => btn(el, 'Yes, replace').click());
    expect(store.status('a')).toBe('done');
  });

  it('speed select is locked to instant under reduce motion', async () => {
    const store = new Store(new MemoryStorage());
    store.updateSettings({ reduceMotion: true });
    const el = await mount(store);
    const sel = el.querySelectorAll('select')[1]!;
    expect(sel.disabled).toBe(true);
    expect(sel.textContent).toContain('Instant (reduced motion)');
  });
});
