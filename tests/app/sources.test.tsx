import { render } from 'preact';
import { act } from 'preact/test-utils';
import { describe, expect, it } from 'vitest';
import content from 'virtual:content';
import { AppProviders } from '../../src/app/context';
import { More } from '../../src/app/screens/More';
import { Sources } from '../../src/app/screens/Sources';
import { MemoryStorage } from '../../src/app/storage';
import { Store } from '../../src/app/store';

async function mount(ui: preact.VNode) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(() => {
    render(
      <AppProviders content={content} store={new Store(new MemoryStorage())}>
        {ui}
      </AppProviders>,
      el,
    );
  });
  return el;
}

describe('Sources screen', () => {
  it('renders every group with its items', async () => {
    const el = await mount(<Sources />);
    expect(el.querySelector('h1')?.textContent).toBe('Sources');
    expect(content.sources.length).toBeGreaterThan(3);
    expect([...el.querySelectorAll('h2')].map((h) => h.textContent)).toEqual(
      content.sources.map((g) => g.group),
    );
    const total = content.sources.reduce((n, g) => n + g.items.length, 0);
    expect(el.querySelectorAll('li').length).toBe(total);
    expect(el.textContent).toContain('computed by the app itself');
  });

  it('links open externally and are valid https URLs', async () => {
    const el = await mount(<Sources />);
    const links = [...el.querySelectorAll<HTMLAnchorElement>('li a')];
    expect(links.length).toBeGreaterThan(5);
    for (const a of links) {
      expect(() => new URL(a.href)).not.toThrow();
      expect(new URL(a.href).protocol).toBe('https:');
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
      expect(a.rel).toContain('noreferrer');
    }
    const withUrl = content.sources.flatMap((g) => g.items).filter((i) => i.url);
    expect(links.length).toBe(withUrl.length);
  });

  it('is linked from More, before Settings', async () => {
    const el = await mount(<More />);
    const hrefs = [...el.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    const s = hrefs.findIndex((h) => h?.endsWith('/sources'));
    const set = hrefs.findIndex((h) => h?.endsWith('/settings'));
    expect(s).toBeGreaterThan(-1);
    expect(s).toBeLessThan(set);
  });
});
