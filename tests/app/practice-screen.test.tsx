import { render } from 'preact';
import { act } from 'preact/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import content from 'virtual:content';
import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/context';
import { lineCalls, type LineCallItem } from '../../src/app/practice/drills/lineCalls';
import { deriveSeed } from '../../src/app/practice/rng';
import { createRound } from '../../src/app/practice/round';
import { MemoryStorage } from '../../src/app/storage';
import { Store } from '../../src/app/store';

async function mount(hash: string, store = new Store(new MemoryStorage())) {
  location.hash = hash;
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(() => {
    render(
      <AppProviders content={content} store={store}>
        <App />
      </AppProviders>,
      el,
    );
  });
  return { el, store };
}

const buttons = (el: Element) => [...el.querySelectorAll('button')];
const byText = (el: Element, t: string) => buttons(el).find((b) => b.textContent?.trim() === t);

describe('practice routes', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['#/practice', 'Practice'],
    ['#/practice/line-calls', 'Line calls'],
    ['#/practice/no-such-drill', 'Not found'],
  ])('%s shows "%s"', async (hash, heading) => {
    const { el } = await mount(hash);
    expect(el.querySelector('h1')?.textContent).toContain(heading);
  });

  it('the hub lists every drill with its progress', async () => {
    const store = new Store(new MemoryStorage());
    store.recordPracticeRound('line-calls', 8, 1);
    const { el } = await mount('#/practice', store);
    const card = el.querySelector('a[href="#/practice/line-calls"]')!;
    expect(card.textContent).toContain('Best 8/10');
    expect(el.querySelector('nav.tabbar [aria-current="page"]')?.textContent).toContain('More');
  });

  it('plays a seeded 10-item round, re-asks a miss and records the result', async () => {
    const { el, store } = await mount('#/practice/line-calls?seed=99&level=1');
    // The runner's first round uses deriveSeed(seed, 0); mirror it to know the answers.
    const expected = createRound(lineCalls, { seed: deriveSeed(99, 0), level: 1 });
    const first = expected.queue[0]!.item as LineCallItem;
    expect(el.querySelector('.pr-prompt')?.textContent).toBe(first.prompt);
    const labels = { win: 'Wins', lose: 'Loses', push: 'Pushes', none: 'No decision' };
    const byKey = new Map(expected.queue.map((e) => [e.item.key, e.item as LineCallItem]));
    let missed = false;
    let asked = 0;
    for (; asked < 40 && !el.querySelector('.pr-summary'); asked++) {
      const current = byKey.get(el.querySelector('.pr-item')!.getAttribute('data-key')!)!;
      // Miss the first question once; answer everything else right.
      const wrong = !missed;
      missed = true;
      const choices = [...el.querySelectorAll<HTMLButtonElement>('.pr-choice')];
      const target = choices.find((c) =>
        wrong
          ? c.textContent !== labels[current.outcome]
          : c.textContent === labels[current.outcome],
      )!;
      await act(() => target.click());
      expect(el.querySelector('.pr-feedback strong')?.textContent).toBe(
        wrong ? 'Not quite.' : 'Correct.',
      );
      if (wrong) {
        // the right answer is marked too
        const marked = el.querySelector('.pr-choice.is-answer');
        expect(marked?.textContent).toContain(labels[current.outcome]);
        expect(marked?.textContent).toContain('(correct answer)');
      }
      await act(() => (byText(el, 'Next') ?? byText(el, 'See results'))!.click());
    }
    expect(asked).toBe(11); // 10 questions + 1 re-ask of the miss
    expect(el.querySelector('.pr-summary h2')?.textContent).toBe('Round complete: 9 of 10');
    expect(el.querySelectorAll('.pr-missed li')).toHaveLength(1);
    const p = store.drill('line-calls')!;
    expect(p).toMatchObject({ rounds: 1, best: 9, last: 9, level: 1 });
    expect(p.review).toEqual([{ ...expected.queue[0]!.ref, due: 1, gap: 1 }]);

    // Play again: the missed item opens the next round as a review item.
    await act(() => byText(el, 'Play again')!.click());
    expect(el.querySelector('.pr-prompt')?.textContent).toBe(first.prompt);
    expect(el.querySelector('.pr-count')?.textContent).toContain('Review');
  });

  it('switching level restarts the round and is remembered', async () => {
    const { el, store } = await mount('#/practice/line-calls?seed=1');
    const l3 = [...el.querySelectorAll<HTMLButtonElement>('[role="radio"]')][2]!;
    await act(() => l3.click());
    expect(l3.getAttribute('aria-checked')).toBe('true');
    expect(store.drill('line-calls')?.level).toBe(3);
    expect(el.querySelectorAll('.pr-choice')).toHaveLength(4);
  });

  it('a new seed in the URL starts a new round', async () => {
    const { el } = await mount('#/practice/line-calls?seed=1&level=2');
    const prompt = (seed: number) =>
      createRound(lineCalls, { seed: deriveSeed(seed, 0), level: 2 }).queue[0]!.item.key;
    expect(el.querySelector('.pr-item')?.getAttribute('data-key')).toBe(prompt(1));
    await act(async () => {
      location.hash = '#/practice/line-calls?seed=2&level=2';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(prompt(1)).not.toBe(prompt(2));
    expect(el.querySelector('.pr-item')?.getAttribute('data-key')).toBe(prompt(2));
  });
});
