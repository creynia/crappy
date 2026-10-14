// Persistence: one localStorage key with an in-memory fallback (private windows, file:// quirks).

export const STORAGE_KEY = 'crappy:v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryStorage implements StorageLike {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

/** localStorage when it really works, else memory. Never throws. */
export function createStorage(): StorageLike {
  try {
    const ls = globalThis.localStorage;
    const probe = '__crappy_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return new MemoryStorage();
  }
}

export interface LessonProgress {
  startedAt?: number;
  completedAt?: number;
  quizzes: Record<string, { correct: boolean; attempts: number }>;
  scenes: Record<string, { completed: boolean; step: number }>;
}

export type ThemeSetting = 'system' | 'light' | 'dark';
export type SpeedSetting = 'normal' | 'fast' | 'instant';

export interface Settings {
  theme: ThemeSetting;
  animationSpeed: SpeedSetting;
  /** forces `instant` animations (OS reduced-motion is honoured on top of this) */
  reduceMotion: boolean;
  /** dollars */
  defaultBankroll: number;
  rollsPerHour: number;
  confirmSuckerBets: boolean;
}

export interface PersistedV1 {
  version: 1;
  lessons: Record<string, LessonProgress>;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  animationSpeed: 'normal',
  reduceMotion: false,
  defaultBankroll: 500,
  rollsPerHour: 100,
  confirmSuckerBets: true,
};

export function defaultPersisted(): PersistedV1 {
  return { version: 1, lessons: {}, settings: { ...DEFAULT_SETTINGS } };
}

const isObj = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined;
const oneOf = <T extends string>(x: unknown, opts: readonly T[], d: T): T =>
  typeof x === 'string' && (opts as readonly string[]).includes(x) ? (x as T) : d;

export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  const o = isObj(raw) ? raw : {};
  const bank = num(o.defaultBankroll);
  const rph = num(o.rollsPerHour);
  return {
    theme: oneOf(o.theme, ['system', 'light', 'dark'], d.theme),
    animationSpeed: oneOf(o.animationSpeed, ['normal', 'fast', 'instant'], d.animationSpeed),
    reduceMotion: typeof o.reduceMotion === 'boolean' ? o.reduceMotion : d.reduceMotion,
    defaultBankroll:
      bank !== undefined && bank >= 1 ? Math.min(Math.round(bank), 1_000_000) : d.defaultBankroll,
    rollsPerHour: rph !== undefined && rph >= 1 ? Math.min(Math.round(rph), 5000) : d.rollsPerHour,
    confirmSuckerBets:
      typeof o.confirmSuckerBets === 'boolean' ? o.confirmSuckerBets : d.confirmSuckerBets,
  };
}

/** Validates arbitrary parsed JSON into PersistedV1; malformed parts fall back to defaults. */
export function sanitize(raw: unknown): PersistedV1 | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  const lessons: Record<string, LessonProgress> = {};
  if (isObj(raw.lessons)) {
    for (const [id, v] of Object.entries(raw.lessons)) {
      if (!isObj(v)) continue;
      const p: LessonProgress = { quizzes: {}, scenes: {} };
      const s = num(v.startedAt);
      const c = num(v.completedAt);
      if (s !== undefined) p.startedAt = s;
      if (c !== undefined) p.completedAt = c;
      if (isObj(v.quizzes))
        for (const [qid, q] of Object.entries(v.quizzes))
          if (isObj(q))
            p.quizzes[qid] = {
              correct: q.correct === true,
              attempts: Math.max(0, Math.floor(num(q.attempts) ?? 0)),
            };
      if (isObj(v.scenes))
        for (const [sid, sc] of Object.entries(v.scenes))
          if (isObj(sc))
            p.scenes[sid] = {
              completed: sc.completed === true,
              step: Math.max(0, Math.floor(num(sc.step) ?? 0)),
            };
      lessons[id] = p;
    }
  }
  return { version: 1, lessons, settings: sanitizeSettings(raw.settings) };
}

/** Never throws; anything unreadable gives defaults. */
export function load(storage: StorageLike): PersistedV1 {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (text) return sanitize(JSON.parse(text)) ?? defaultPersisted();
  } catch {
    /* fall through */
  }
  return defaultPersisted();
}

export function save(storage: StorageLike, data: PersistedV1): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ---- export / import: a base64 code of the JSON (copy-pasteable) ----

export function encodeExport(data: PersistedV1): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'crappy1:' + btoa(bin);
}

export function decodeImport(code: string): PersistedV1 | null {
  try {
    const t = code.trim();
    if (!t.startsWith('crappy1:')) return null;
    const bin = atob(t.slice('crappy1:'.length));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return sanitize(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
