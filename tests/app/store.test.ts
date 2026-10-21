import { describe, expect, it, vi } from 'vitest';
import { MemoryStorage, REVIEW_LIMIT, STORAGE_KEY, load } from '../../src/app/storage';
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

describe('resetLesson (exam retake)', () => {
  it('clears quizzes but keeps completion, so a retake can earn first-try credit', async () => {
    const { finalExamScore } = await import('../../src/app/store');
    const c = bundle(['final-exam']);
    c.lessons[0]!.blocks = [
      {
        kind: 'quiz',
        quiz: {
          id: 'final-exam-q1',
          prompt: 'p',
          choices: ['a', 'b'],
          answer: 0,
          explanation: 'e',
        },
      },
    ];
    const s = new Store(new MemoryStorage());
    s.markQuiz('final-exam', 'final-exam-q1', false);
    s.markQuiz('final-exam', 'final-exam-q1', true);
    s.completeLesson('final-exam');
    expect(finalExamScore(c, s)).toBe(0);
    s.resetLesson('final-exam');
    expect(s.status('final-exam')).toBe('done');
    s.markQuiz('final-exam', 'final-exam-q1', true);
    expect(finalExamScore(c, s)).toBe(1);
    expect(() => s.resetLesson('nope')).not.toThrow();
    expect(s.lesson('constructor')).toBeUndefined();
  });
});

describe('practice progress', () => {
  it('tracks streaks, the review list and round bests per drill', () => {
    const m = new MemoryStorage();
    const s = new Store(m);
    expect(s.drill('d')).toBeUndefined();
    s.recordPracticeAnswer('d', true);
    s.recordPracticeAnswer('d', true);
    s.recordPracticeAnswer('d', false, { addReview: { seed: 1, level: 1 } });
    s.recordPracticeAnswer('d', false, { addReview: { seed: 1, level: 1 } });
    s.recordPracticeAnswer('d', true, { passReview: { seed: 9, level: 1 } });
    s.recordPracticeAnswer('d', true, { scored: false }); // a re-ask: streak unchanged
    expect(s.drill('d')).toMatchObject({
      streak: 1,
      bestStreak: 2,
      review: [{ seed: 1, level: 1, due: 1, gap: 1 }],
    });
    s.recordPracticeRound('d', 7, 2, 50);
    s.recordPracticeRound('d', 5, 2, 60);
    s.recordPracticeAnswer('d', true, { passReview: { seed: 1, level: 1 } });
    expect(s.drill('d')?.review).toEqual([{ seed: 1, level: 1, due: 4, gap: 2 }]);
    expect(s.drill('d')).toMatchObject({ rounds: 2, best: 7, last: 5, level: 2, lastPlayedAt: 60 });
    s.setPracticeLevel('d', 3);
    expect(s.drill('d')?.level).toBe(3);
    expect(s.drill('constructor')).toBeUndefined();
    s.flush();
    expect(new Store(m).drill('d')?.best).toBe(7);
    s.reset();
    expect(s.drill('d')).toBeUndefined();
  });
});

describe('spaced review schedule', () => {
  it('a miss comes back next round, then 2, then 4 rounds later, then leaves', () => {
    const s = new Store(new MemoryStorage());
    const ref = { seed: 5, level: 1 };
    const round = () => s.recordPracticeRound('d', 0, 1);
    const item = () => s.drill('d')!.review[0];
    s.recordPracticeAnswer('d', false, { addReview: ref }); // round 0
    expect(item()).toEqual({ ...ref, due: 1, gap: 1 });
    round();
    s.recordPracticeAnswer('d', true, { passReview: ref }); // round 1
    expect(item()).toEqual({ ...ref, due: 3, gap: 2 });
    round();
    round();
    s.recordPracticeAnswer('d', true, { passReview: ref }); // round 3
    expect(item()).toEqual({ ...ref, due: 7, gap: 4 });
    s.recordPracticeAnswer('d', false, { addReview: ref }); // missed again: back to the start
    expect(item()).toEqual({ ...ref, due: 4, gap: 1 });
    expect(s.drill('d')!.review).toHaveLength(1);
  });

  it('keeps the REVIEW_LIMIT most recent misses', () => {
    const s = new Store(new MemoryStorage());
    for (let i = 0; i < REVIEW_LIMIT + 3; i++)
      s.recordPracticeAnswer('d', false, { addReview: { seed: i, level: 1 } });
    const seeds = s.drill('d')!.review.map((r) => r.seed);
    expect(seeds).toHaveLength(REVIEW_LIMIT);
    expect(seeds[0]).toBe(3);
  });
});
