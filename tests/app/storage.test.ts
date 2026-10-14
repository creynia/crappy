import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  MemoryStorage,
  STORAGE_KEY,
  createStorage,
  decodeImport,
  defaultPersisted,
  encodeExport,
  load,
  sanitize,
  save,
} from '../../src/app/storage';

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
