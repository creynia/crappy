import { render } from 'preact';
import { act } from 'preact/test-utils';
import { beforeEach, describe, expect, it } from 'vitest';
import content from 'virtual:content';
import { App } from '../../src/app/App';
import { AppProviders } from '../../src/app/context';
import { MemoryStorage } from '../../src/app/storage';
import { Store } from '../../src/app/store';

async function mount(hash: string) {
  location.hash = hash;
  const el = document.createElement('div');
  document.body.appendChild(el);
  const store = new Store(new MemoryStorage());
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

describe('App routes render', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it.each([
    ['#/', 'Learn craps'],
    ['#/learn', 'Learn'],
    ['#/bets', 'Bets'],
    ['#/glossary', 'Glossary'],
    ['#/settings', 'Settings'],
    ['#/more', 'More'],
    ['#/sources', 'Sources'],
    ['#/nope/nothing', 'Not found'],
    ['#/learn/does-not-exist', 'Not found'],
    ['#/bets/not-a-bet', 'Not found'],
  ])('%s shows "%s"', async (hash, heading) => {
    const { el } = await mount(hash);
    expect(el.querySelector('h1')?.textContent).toContain(heading);
  });

  it('bet reference survives stubbed math', async () => {
    const { el } = await mount('#/bets');
    expect(el.querySelectorAll('tbody tr').length).toBeGreaterThan(30);
    const { el: d } = await mount('#/bets/pass-line');
    expect(d.querySelector('h1')?.textContent).toBeTruthy();
  });

  it('opens the first lesson and marks it complete', async () => {
    const first = content.lessons[0]!;
    const { el, store } = await mount(`#/learn/${first.id}`);
    expect(el.querySelector('h1')?.textContent).toBe(first.title);
    const btn = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Mark complete')!;
    await act(() => btn.click());
    expect(store.status(first.id)).toBe('done');
  });

  it('answers a quiz and records it', async () => {
    const lesson = content.lessons.find((l) => l.blocks.some((b) => b.kind === 'quiz'))!;
    const quiz = lesson.blocks.find((b) => b.kind === 'quiz')!.quiz;
    const { el, store } = await mount(`#/learn/${lesson.id}`);
    const radios = el.querySelectorAll<HTMLInputElement>(`input[name="quiz-${quiz.id}"]`);
    await act(() => {
      radios[quiz.answer]!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const check = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Check answer')!;
    await act(() => check.click());
    expect(store.lesson(lesson.id)?.quizzes[quiz.id]).toEqual({
      correct: true,
      attempts: 1,
      firstTry: true,
    });
  });
});
