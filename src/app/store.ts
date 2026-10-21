import {
  createStorage,
  decodeImport,
  defaultPersisted,
  emptyDrillProgress,
  encodeExport,
  load,
  REVIEW_LIMIT,
  save,
  type DrillProgress,
  type LessonProgress,
  type Persisted,
  type PracticeItemRef,
  type Settings,
  type StorageLike,
} from './storage';
import type { ContentBundle } from '../content/types';

export type LessonStatus = 'new' | 'progress' | 'done';

const emptyLesson = (): LessonProgress => ({ quizzes: {}, scenes: {} });

export class Store {
  private data: Persisted;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private storage: StorageLike = createStorage(),
    private debounceMs = 300,
  ) {
    this.data = load(storage);
  }

  get snapshot(): Persisted {
    return this.data;
  }
  get settings(): Settings {
    return this.data.settings;
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private commit(next: Persisted) {
    this.data = next; // new object identity on every change
    this.listeners.forEach((l) => l());
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.debounceMs);
  }

  /** Write to storage now. */
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    save(this.storage, this.data);
  }

  private patchLesson(id: string, fn: (p: LessonProgress) => LessonProgress) {
    const cur = this.data.lessons[id] ?? emptyLesson();
    this.commit({ ...this.data, lessons: { ...this.data.lessons, [id]: fn(cur) } });
  }

  lesson(id: string): LessonProgress | undefined {
    return Object.hasOwn(this.data.lessons, id) ? this.data.lessons[id] : undefined;
  }

  /** Clear a lesson's quiz results (keeps completedAt and scene progress), e.g. to retake an exam. */
  resetLesson(id: string) {
    if (!Object.hasOwn(this.data.lessons, id)) return;
    this.patchLesson(id, (l) => ({ ...l, quizzes: {} }));
  }

  status(id: string): LessonStatus {
    const p = this.data.lessons[id];
    if (!p) return 'new';
    if (p.completedAt) return 'done';
    if (p.startedAt || Object.keys(p.quizzes).length || Object.keys(p.scenes).length)
      return 'progress';
    return 'new';
  }

  /** Called when a lesson is opened. */
  start(id: string, now = Date.now()) {
    const p = this.data.lessons[id];
    if (p?.startedAt) return;
    this.patchLesson(id, (l) => ({ ...l, startedAt: now }));
  }

  markQuiz(lessonId: string, quizId: string, correct: boolean) {
    this.patchLesson(lessonId, (l) => {
      const prev = l.quizzes[quizId];
      return {
        ...l,
        startedAt: l.startedAt ?? Date.now(),
        quizzes: {
          ...l.quizzes,
          [quizId]: {
            correct: (prev?.correct ?? false) || correct,
            attempts: (prev?.attempts ?? 0) + 1,
            firstTry: prev ? (prev.firstTry ?? (prev.attempts === 1 && prev.correct)) : correct,
          },
        },
      };
    });
  }

  markSceneStep(lessonId: string, sceneId: string, step: number) {
    this.patchLesson(lessonId, (l) => {
      const prev = l.scenes[sceneId];
      return {
        ...l,
        scenes: {
          ...l.scenes,
          [sceneId]: { completed: prev?.completed ?? false, step: Math.max(prev?.step ?? 0, step) },
        },
      };
    });
  }

  markSceneComplete(lessonId: string, sceneId: string) {
    this.patchLesson(lessonId, (l) => ({
      ...l,
      scenes: { ...l.scenes, [sceneId]: { step: l.scenes[sceneId]?.step ?? 0, completed: true } },
    }));
  }

  completeLesson(id: string, done = true, now = Date.now()) {
    this.patchLesson(id, (l) => {
      const { completedAt: _drop, ...rest } = l;
      return done ? { ...rest, startedAt: l.startedAt ?? now, completedAt: now } : rest;
    });
  }

  // ---- practice drills (src/app/practice) ----

  /** Saved progress for a drill, if it was ever played. */
  drill(id: string): DrillProgress | undefined {
    return Object.hasOwn(this.data.practice, id) ? this.data.practice[id] : undefined;
  }

  private patchDrill(id: string, fn: (p: DrillProgress) => DrillProgress) {
    const cur = this.drill(id) ?? emptyDrillProgress();
    this.commit({ ...this.data, practice: { ...this.data.practice, [id]: fn(cur) } });
  }

  /**
   * One answered drill item: updates the running streak and the spaced-review list
   * (`addReview`: missed on the first try; `clearReview`: a review item answered right).
   */
  recordPracticeAnswer(
    drillId: string,
    ok: boolean,
    opts: { addReview?: PracticeItemRef; clearReview?: PracticeItemRef } = {},
  ) {
    const same = (a: PracticeItemRef) => (b: PracticeItemRef) =>
      a.seed === b.seed && a.level === b.level;
    this.patchDrill(drillId, (p) => {
      const streak = ok ? p.streak + 1 : 0;
      let review = p.review;
      if (opts.clearReview) review = review.filter((r) => !same(opts.clearReview!)(r));
      if (opts.addReview && !review.some(same(opts.addReview)))
        review = [...review, { ...opts.addReview }].slice(-REVIEW_LIMIT);
      return { ...p, streak, bestStreak: Math.max(p.bestStreak, streak), review };
    });
  }

  /** A finished round: counts it and keeps the best score. */
  recordPracticeRound(drillId: string, score: number, level: number, now = Date.now()) {
    this.patchDrill(drillId, (p) => ({
      ...p,
      rounds: p.rounds + 1,
      best: Math.max(p.best, score),
      last: score,
      level,
      lastPlayedAt: now,
    }));
  }

  /** Remember the level picked for a drill. */
  setPracticeLevel(drillId: string, level: number) {
    if (this.drill(drillId)?.level === level) return;
    this.patchDrill(drillId, (p) => ({ ...p, level }));
  }

  updateSettings(patch: Partial<Settings>) {
    this.commit({ ...this.data, settings: { ...this.data.settings, ...patch } });
  }

  exportCode(): string {
    return encodeExport(this.data);
  }

  importCode(code: string): boolean {
    const d = decodeImport(code);
    if (!d) return false;
    this.commit(d);
    return true;
  }

  /** Clear lesson and practice progress (keeps settings unless `settings` is true). */
  reset(settings = false) {
    const fresh = defaultPersisted();
    this.commit(settings ? fresh : { ...fresh, settings: this.data.settings });
  }
}

/** First lesson (chapter order) that is not complete, else null. */
export function nextLesson(content: ContentBundle, store: Store): string | null {
  for (const l of content.lessons) if (store.status(l.id) !== 'done') return l.id;
  return null;
}

export function overallProgress(
  content: ContentBundle,
  store: Store,
): { done: number; total: number } {
  const total = content.lessons.length;
  return { total, done: content.lessons.filter((l) => store.status(l.id) === 'done').length };
}

export const FINAL_EXAM_ID = 'final-exam';

/** Score (0..1) of the final exam, counting first attempts only (retries do not raise it), or null if the lesson has no quizzes. */
export function finalExamScore(content: ContentBundle, store: Store): number | null {
  const lesson = content.lessons.find((l) => l.id === FINAL_EXAM_ID);
  if (!lesson) return null;
  const qs = lesson.blocks.flatMap((b) => (b.kind === 'quiz' ? [b.quiz.id] : []));
  if (qs.length === 0) return null;
  const p = store.lesson(FINAL_EXAM_ID);
  const firstTry = (id: string) => {
    const q = p?.quizzes[id];
    return q ? (q.firstTry ?? (q.attempts === 1 && q.correct)) : false;
  };
  return qs.filter(firstTry).length / qs.length;
}

/** "Perfect Strategy" badge: final-exam score >= 80%. */
export function hasPerfectStrategyBadge(content: ContentBundle, store: Store): boolean {
  const s = finalExamScore(content, store);
  return s !== null && s >= 0.8;
}
