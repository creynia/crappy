import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  MemoryStorage,
  STORAGE_KEY,
  createStorage,
  decodeImport,
  REVIEW_LIMIT,
  defaultPersisted,
  emptyDrillProgress,
  encodeExport,
  load,
  migrate,
  sanitize,
  save,
  backupKey,
  loadWithStatus,
  PRACTICE_KEY,
} from '../../src/app/storage';
import { Store } from '../../src/app/store';

describe('storage', () => {
  it('returns defaults for empty, corrupt or wrong-version data', () => {
    const m = new MemoryStorage();
    expect(load(m)).toEqual(defaultPersisted());
    m.setItem(STORAGE_KEY, '{not json');
    expect(load(m)).toEqual(defaultPersisted());
    m.setItem(STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(load(m)).toEqual(defaultPersisted());
  });

  it('round-trips', () => {
    const m = new MemoryStorage();
    const d = defaultPersisted();
    d.lessons.a = {
      startedAt: 1,
      completedAt: 2,
      quizzes: { q: { correct: true, attempts: 2 } },
      scenes: { s: { completed: true, step: 3 } },
    };
    d.settings.theme = 'dark';
    expect(save(m, d)).toBe(true);
    expect(load(m)).toEqual(d);
  });

  it('sanitises malformed fields', () => {
    const d = sanitize({
      version: 1,
      lessons: {
        a: { startedAt: 'x', quizzes: { q: { correct: 'yes', attempts: -3 } }, scenes: 5 },
        b: 7,
      },
      settings: {
        theme: 'neon',
        animationSpeed: 'fast',
        defaultBankroll: -5,
        rollsPerHour: 'lots',
        confirmSuckerBets: false,
      },
    })!;
    expect(d.lessons.b).toBeUndefined();
    expect(d.lessons.a).toEqual({ quizzes: { q: { correct: false, attempts: 0 } }, scenes: {} });
    expect(d.settings).toEqual({
      ...DEFAULT_SETTINGS,
      animationSpeed: 'fast',
      confirmSuckerBets: false,
    });
  });

  it('ignores prototype-polluting keys', () => {
    const raw = JSON.parse(
      '{"version":1,"lessons":{"__proto__":{"quizzes":{}},"constructor":{"quizzes":{}},"ok":{"quizzes":{"__proto__":{"correct":true}}}}}',
    ) as unknown;
    const d = sanitize(raw)!;
    expect(Object.keys(d.lessons)).toEqual(['ok']);
    expect(Object.keys(d.lessons.ok!.quizzes)).toEqual([]);
  });

  it('save reports failure instead of throwing', () => {
    const bad = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {},
    };
    expect(save(bad, defaultPersisted())).toBe(false);
  });

  it('createStorage works and falls back to memory when localStorage throws', () => {
    expect(createStorage()).toBeTruthy();
    const orig = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('denied');
      },
    });
    try {
      const s = createStorage();
      s.setItem('k', 'v');
      expect(s.getItem('k')).toBe('v');
    } finally {
      if (orig) Object.defineProperty(globalThis, 'localStorage', orig);
    }
  });

  it('export/import codes round-trip and reject junk', () => {
    const d = defaultPersisted();
    d.lessons.x = { completedAt: 5, quizzes: {}, scenes: {} };
    expect(decodeImport(encodeExport(d))).toEqual(d);
    expect(decodeImport('garbage')).toBeNull();
    expect(decodeImport('crappy1:@@@')).toBeNull();
  });
});

describe('storage migration v1 -> v2 (practice)', () => {
  const v1 = {
    version: 1,
    lessons: { a: { completedAt: 5, quizzes: { q: { correct: true, attempts: 1 } }, scenes: {} } },
    settings: { theme: 'dark' },
  };

  it('migrates v1 data, keeping lessons and settings and adding empty practice', () => {
    const m = new MemoryStorage();
    m.setItem(STORAGE_KEY, JSON.stringify(v1));
    const d = load(m);
    expect(d.version).toBe(2);
    expect(d.practice).toEqual({});
    expect(d.lessons.a?.completedAt).toBe(5);
    expect(d.lessons.a?.quizzes.q).toEqual({ correct: true, attempts: 1 });
    expect(d.settings.theme).toBe('dark');
  });

  it('migrate() walks known versions and rejects unknown ones', () => {
    expect(migrate(v1)?.version).toBe(2);
    expect(migrate({ version: 2 })?.version).toBe(2);
    expect(migrate({ version: 3 })).toBeNull();
    expect(migrate({})).toBeNull();
    expect(migrate([])).toBeNull();
  });

  it('imports export codes made from v1 data', () => {
    const bytes = new TextEncoder().encode(JSON.stringify(v1));
    let bin = '';
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    const d = decodeImport('crappy1:' + btoa(bin));
    expect(d?.version).toBe(2);
    expect(d?.lessons.a?.completedAt).toBe(5);
  });

  it('round-trips and sanitises practice progress', () => {
    const d = defaultPersisted();
    d.practice['line-calls'] = {
      rounds: 2,
      best: 8,
      last: 6,
      streak: 3,
      bestStreak: 9,
      level: 2,
      lastPlayedAt: 100,
      review: [{ seed: -5, level: 1, due: 2, gap: 4 }],
    };
    const m = new MemoryStorage();
    save(m, d);
    expect(load(m)).toEqual(d);

    const bad = sanitize(
      JSON.parse(
        '{"version":2,"practice":{"__proto__":{},"x":{"rounds":-1,"best":"9","streak":4,"bestStreak":1,"level":99,"review":[{"seed":1.5,"level":1},{"seed":3,"level":0,"due":-2,"gap":3},"junk",{"seed":4}]},"y":7}}',
      ) as unknown,
    )!;
    expect(Object.keys(bad.practice)).toEqual(['x', 'y']);
    expect(bad.practice.x).toEqual({
      rounds: 0,
      best: 0,
      streak: 4,
      bestStreak: 4,
      level: 9,
      review: [{ seed: 3, level: 1, due: 0, gap: 1 }],
    });
    expect(bad.practice.y).toEqual(emptyDrillProgress());
  });

  it('caps the saved review list', () => {
    const review = Array.from({ length: REVIEW_LIMIT + 5 }, (_, i) => ({ seed: i, level: 1 }));
    const d = sanitize({ version: 2, practice: { x: { review } } })!;
    expect(d.practice.x?.review).toHaveLength(REVIEW_LIMIT);
  });
});

describe('storage: never lose data it cannot read', () => {
  it('backs up corrupt JSON before using defaults', () => {
    const m = new MemoryStorage();
    m.setItem(STORAGE_KEY, '{not json');
    const r = loadWithStatus(m);
    expect(r).toEqual({ data: defaultPersisted(), readOnly: false });
    expect(m.getItem(backupKey('corrupt'))).toBe('{not json');
  });

  it('backs up data with an unknown version', () => {
    const m = new MemoryStorage();
    m.setItem(STORAGE_KEY, '{"version":"x","lessons":{}}');
    expect(loadWithStatus(m).readOnly).toBe(false);
    expect(m.getItem(backupKey('unknown'))).toBe('{"version":"x","lessons":{}}');
    m.setItem(STORAGE_KEY, '{"version":0}');
    loadWithStatus(m);
    expect(m.getItem(backupKey('v0'))).toBe('{"version":0}');
  });

  it('keeps the first backup per tag', () => {
    const m = new MemoryStorage();
    m.setItem(STORAGE_KEY, 'first!');
    loadWithStatus(m);
    m.setItem(STORAGE_KEY, 'second!');
    loadWithStatus(m);
    expect(m.getItem(backupKey('corrupt'))).toBe('first!');
  });

  it('data from a newer version is left untouched: the store runs in memory only', () => {
    const m = new MemoryStorage();
    const v3 = JSON.stringify({ version: 3, lessons: { a: { completedAt: 1 } }, future: true });
    m.setItem(STORAGE_KEY, v3);
    expect(loadWithStatus(m).readOnly).toBe(true);
    const s = new Store(m);
    expect(s.readOnly).toBe(true);
    s.recordPracticeRound('d', 5, 1);
    s.updateSettings({ theme: 'dark' });
    s.flush();
    expect(m.getItem(STORAGE_KEY)).toBe(v3);
    expect(s.drill('d')?.best).toBe(5); // still works for this session
  });

  it('restores practice when an old (v1) tab rewrote the data without it', () => {
    const m = new MemoryStorage();
    const s = new Store(m);
    s.recordPracticeRound('line-calls', 8, 2);
    s.flush();
    // an old tab saves its in-memory v1 snapshot over the key
    m.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, lessons: { a: { completedAt: 9 } }, settings: {} }),
    );
    const d = load(m);
    expect(d.lessons.a?.completedAt).toBe(9);
    expect(d.practice['line-calls']?.best).toBe(8);
  });

  it('ignores the practice copy for current-version data', () => {
    const m = new MemoryStorage();
    m.setItem(STORAGE_KEY, JSON.stringify(defaultPersisted()));
    m.setItem(PRACTICE_KEY, JSON.stringify({ x: { best: 3 } }));
    expect(load(m).practice).toEqual({});
  });
});
