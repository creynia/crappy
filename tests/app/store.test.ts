import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage, STORAGE_KEY, load } from '../../src/app/storage';
import { Store, nextLesson, overallProgress } from '../../src/app/store';
import type { ContentBundle } from '../../src/content/types';

const bundle = (ids: string[]): ContentBundle => ({
  chapters: [{ id: 'c', title: 'C', summary: '', lessons: ids }],
  lessons: ids.map((id) => ({
    id,
    title: id,
    summary: '',
    minutes: 1,
    chapterId: 'c',
    blocks: [],
  })),
  glossary: [],
  bets: {} as ContentBundle['bets'],
});

describe('Store', () => {
  it('tracks status: new -> progress -> done and back', () => {
    const s = new Store(new MemoryStorage());
    expect(s.status('a')).toBe('new');
    s.start('a');
    expect(s.status('a')).toBe('progress');
    s.completeLesson('a');
    expect(s.status('a')).toBe('done');
    s.completeLesson('a', false);
    expect(s.status('a')).toBe('progress');
  });

  it('records quizzes (sticky correct, counted attempts) and scene progress', () => {
    const s = new Store(new MemoryStorage());
    s.markQuiz('a', 'a-q1', false);
    s.markQuiz('a', 'a-q1', true);
    s.markQuiz('a', 'a-q1', false);
    expect(s.lesson('a')?.quizzes['a-q1']).toEqual({ correct: true, attempts: 3, firstTry: false });
    s.markSceneStep('a', 's', 2);
    s.markSceneStep('a', 's', 1);
    s.markSceneComplete('a', 's');
    expect(s.lesson('a')?.scenes.s).toEqual({ completed: true, step: 2 });
  });

  it('notifies subscribers and gives a new snapshot per change', () => {
    const s = new Store(new MemoryStorage());
    const fn = vi.fn();
    const off = s.subscribe(fn);
    const before = s.snapshot;
    s.updateSettings({ theme: 'light' });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(s.snapshot).not.toBe(before);
    off();
    s.updateSettings({ theme: 'dark' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('debounces saves and flushes on demand', () => {
    vi.useFakeTimers();
    const m = new MemoryStorage();
    const s = new Store(m, 300);
    s.completeLesson('a');
    expect(m.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(301);
    expect(load(m).lessons.a?.completedAt).toBeTypeOf('number');
    vi.useRealTimers();
  });

  it('loads previous data', () => {
    const m = new MemoryStorage();
    const a = new Store(m);
    a.updateSettings({ defaultBankroll: 1000 });
    a.flush();
    expect(new Store(m).settings.defaultBankroll).toBe(1000);
  });

  it('export/import and reset', () => {
    const s = new Store(new MemoryStorage());
    s.completeLesson('a');
    s.updateSettings({ theme: 'dark' });
    const code = s.exportCode();
    s.reset();
    expect(s.status('a')).toBe('new');
    expect(s.settings.theme).toBe('dark');
    expect(s.importCode('nope')).toBe(false);
    expect(s.importCode(code)).toBe(true);
    expect(s.status('a')).toBe('done');
    s.reset(true);
    expect(s.settings.theme).toBe('system');
  });

  it('nextLesson picks the first unfinished lesson; overallProgress counts', () => {
    const s = new Store(new MemoryStorage());
    const c = bundle(['a', 'b', 'c']);
    expect(nextLesson(c, s)).toBe('a');
    s.completeLesson('a');
    s.completeLesson('c');
    expect(nextLesson(c, s)).toBe('b');
    expect(overallProgress(c, s)).toEqual({ done: 2, total: 3 });
    s.completeLesson('b');
    expect(nextLesson(c, s)).toBeNull();
  });
});

describe('Perfect Strategy badge', () => {
  it('needs 80% of the final exam quizzes correct', async () => {
    const { hasPerfectStrategyBadge } = await import('../../src/app/store');
    const c = bundle(['final-exam']);
    c.lessons[0]!.blocks = Array.from({ length: 5 }, (_, i) => ({
      kind: 'quiz' as const,
      quiz: {
        id: `final-exam-q${i + 1}`,
        prompt: 'p',
        choices: ['a', 'b'],
        answer: 0,
        explanation: 'e',
      },
    }));
    const s = new Store(new MemoryStorage());
    for (let i = 1; i <= 3; i++) s.markQuiz('final-exam', `final-exam-q${i}`, true);
    expect(hasPerfectStrategyBadge(c, s)).toBe(false);
    s.markQuiz('final-exam', 'final-exam-q4', true);
    expect(hasPerfectStrategyBadge(c, s)).toBe(true);
  });
});

describe('Perfect Strategy badge: first attempts only', () => {
  it('wrong-then-right does not count', async () => {
    const { hasPerfectStrategyBadge, finalExamScore } = await import('../../src/app/store');
    const c = bundle(['final-exam']);
    c.lessons[0]!.blocks = Array.from({ length: 5 }, (_, i) => ({
      kind: 'quiz' as const,
      quiz: {
        id: `final-exam-q${i + 1}`,
        prompt: 'p',
        choices: ['a', 'b'],
        answer: 0,
        explanation: 'e',
      },
    }));
    const s = new Store(new MemoryStorage());
    for (let i = 1; i <= 3; i++) s.markQuiz('final-exam', `final-exam-q${i}`, true);
    s.markQuiz('final-exam', 'final-exam-q4', false);
    s.markQuiz('final-exam', 'final-exam-q4', true);
    s.markQuiz('final-exam', 'final-exam-q5', false);
    s.markQuiz('final-exam', 'final-exam-q5', true);
    expect(finalExamScore(c, s)).toBeCloseTo(0.6);
    expect(hasPerfectStrategyBadge(c, s)).toBe(false);
  });
});
