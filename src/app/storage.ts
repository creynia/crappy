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
  /** `firstTry`: the first attempt was correct (retries never count toward the exam badge) */
  quizzes: Record<string, { correct: boolean; attempts: number; firstTry?: boolean }>;
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

/** A drill item is regenerated from its seed and level (generation is deterministic). */
export interface PracticeItemRef {
  seed: number;
  level: number;
}

/** Review steps in rounds: a miss comes back next round, then 2, then 4 rounds later. */
export const REVIEW_GAPS = [1, 2, 4] as const;

/** A saved review item: due at the start of round `due` (0-based count of completed rounds). */
export interface ReviewItem extends PracticeItemRef {
  due: number;
  /** current step from REVIEW_GAPS */
  gap: number;
}

/** Per-drill practice progress (src/app/practice). */
export interface DrillProgress {
  /** completed 10-item rounds */
  rounds: number;
  /** best round score (first-try correct answers in one round) */
  best: number;
  /** score of the last completed round */
  last?: number;
  /** consecutive correct answers, carried across rounds */
  streak: number;
  bestStreak: number;
  /** last level played (1-based) */
  level: number;
  lastPlayedAt?: number;
  /** spaced review: items missed on the first try, oldest first; cleared when answered right in a later round */
  review: ReviewItem[];
}

export const STORAGE_VERSION = 2;

export interface PersistedV2 {
  version: 2;
  lessons: Record<string, LessonProgress>;
  settings: Settings;
  /** keyed by drill id */
  practice: Record<string, DrillProgress>;
  /** Challenge mode (I030): best score so far and sessions finished; absent until one is played */
  challenge?: ChallengeRecord;
}

/** Challenge mode (I030): best score so far (lower is better) and how many sessions were finished. */
export interface ChallengeRecord {
  played: number;
  best?: { score: number; band: string; at: number; seed: number };
}

/** The current persisted shape (kept as an alias so older imports keep working). */
export type Persisted = PersistedV2;
/** @deprecated use `Persisted`; v1 data is migrated to v2 on load. */
export type PersistedV1 = PersistedV2;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  animationSpeed: 'normal',
  reduceMotion: false,
  defaultBankroll: 500,
  rollsPerHour: 100,
  confirmSuckerBets: true,
};

export function defaultPersisted(): Persisted {
  return { version: 2, lessons: {}, settings: { ...DEFAULT_SETTINGS }, practice: {} };
}

export const REVIEW_LIMIT = 20;

export function emptyDrillProgress(): DrillProgress {
  return { rounds: 0, best: 0, streak: 0, bestStreak: 0, level: 1, review: [] };
}

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const safeEntries = (o: Record<string, unknown>) =>
  Object.entries(o).filter(([k]) => !UNSAFE_KEYS.has(k));

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

const count = (x: unknown): number => Math.max(0, Math.floor(num(x) ?? 0));

export function sanitizeDrillProgress(raw: unknown): DrillProgress {
  const o = isObj(raw) ? raw : {};
  const p = emptyDrillProgress();
  p.rounds = count(o.rounds);
  p.best = count(o.best);
  p.streak = count(o.streak);
  p.bestStreak = Math.max(count(o.bestStreak), p.streak);
  p.level = Math.max(1, Math.min(9, count(o.level) || 1));
  const last = num(o.last);
  if (last !== undefined) p.last = count(last);
  const at = num(o.lastPlayedAt);
  if (at !== undefined) p.lastPlayedAt = at;
  if (Array.isArray(o.review))
    for (const r of o.review as unknown[]) {
      if (!isObj(r)) continue;
      const seed = num(r.seed);
      const level = num(r.level);
      if (seed === undefined || level === undefined || !Number.isInteger(seed)) continue;
      if (p.review.length >= REVIEW_LIMIT) break;
      const gap = num(r.gap);
      p.review.push({
        seed: seed | 0,
        level: Math.max(1, Math.min(9, Math.floor(level))),
        due: count(r.due),
        gap: REVIEW_GAPS.includes(gap as 1) ? gap! : 1,
      });
    }
  return p;
}

/**
 * Migrations: each step takes the previous version's raw JSON and returns the next version's
 * raw JSON (sanitized afterwards). v1 → v2 adds `practice`.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  1: (raw) => ({ ...raw, version: 2, practice: {} }),
};

/** Brings any known older version up to the current one; null for unknown/newer versions. */
export function migrate(raw: unknown): Record<string, unknown> | null {
  if (!isObj(raw)) return null;
  let cur = raw;
  for (;;) {
    const v = cur.version;
    if (v === STORAGE_VERSION) return cur;
    const step = typeof v === 'number' ? MIGRATIONS[v] : undefined;
    if (!step) return null;
    cur = step(cur);
  }
}

/** Validates arbitrary parsed JSON (any known version) into the current shape; malformed parts fall back to defaults. */
export function sanitize(input: unknown): Persisted | null {
  const raw = migrate(input);
  if (!raw) return null;
  const lessons: Record<string, LessonProgress> = {};
  if (isObj(raw.lessons)) {
    for (const [id, v] of safeEntries(raw.lessons)) {
      if (!isObj(v)) continue;
      const p: LessonProgress = { quizzes: {}, scenes: {} };
      const s = num(v.startedAt);
      const c = num(v.completedAt);
      if (s !== undefined) p.startedAt = s;
      if (c !== undefined) p.completedAt = c;
      if (isObj(v.quizzes))
        for (const [qid, q] of safeEntries(v.quizzes))
          if (isObj(q))
            p.quizzes[qid] = {
              correct: q.correct === true,
              attempts: Math.max(0, Math.floor(num(q.attempts) ?? 0)),
              ...(typeof q.firstTry === 'boolean' ? { firstTry: q.firstTry } : {}),
            };
      if (isObj(v.scenes))
        for (const [sid, sc] of safeEntries(v.scenes))
          if (isObj(sc))
            p.scenes[sid] = {
              completed: sc.completed === true,
              step: Math.max(0, Math.floor(num(sc.step) ?? 0)),
            };
      lessons[id] = p;
    }
  }
  const out: PersistedV2 = {
    version: 2,
    lessons,
    settings: sanitizeSettings(raw.settings),
    practice: sanitizePractice(raw.practice),
  };
  const ch = sanitizeChallenge(raw.challenge);
  if (ch) out.challenge = ch;
  return out;
}

function sanitizeChallenge(raw: unknown): ChallengeRecord | null {
  if (!isObj(raw)) return null;
  const played = Math.max(0, Math.floor(num(raw.played) ?? 0));
  const rec: ChallengeRecord = { played };
  if (isObj(raw.best)) {
    const score = num(raw.best.score);
    const at = num(raw.best.at);
    const seed = num(raw.best.seed);
    if (score !== undefined && score >= 0 && typeof raw.best.band === 'string')
      rec.best = { score, band: raw.best.band, at: at ?? 0, seed: seed ?? 0 };
  }
  return rec;
}

function sanitizePractice(raw: unknown): Record<string, DrillProgress> {
  const practice: Record<string, DrillProgress> = {};
  if (isObj(raw)) for (const [id, v] of safeEntries(raw)) practice[id] = sanitizeDrillProgress(v);
  return practice;
}

/**
 * Practice progress is also kept under its own key. A tab still running the previous build
 * (data version 1) rewrites STORAGE_KEY without `practice`; on the next load that v1 data is
 * migrated and practice is restored from this key instead of being lost.
 */
export const PRACTICE_KEY = 'crappy:v1:practice';

/** Where unreadable saved data is copied before defaults are used (one per tag, first kept). */
export const backupKey = (tag: string) => `crappy:v1:backup-${tag}`;

export interface LoadResult {
  data: Persisted;
  /**
   * The saved data comes from a newer version of the app: use defaults in memory and never
   * write, so going back to the newer build finds its data intact.
   */
  readOnly: boolean;
}

function backup(storage: StorageLike, tag: string, text: string) {
  try {
    if (storage.getItem(backupKey(tag)) === null) storage.setItem(backupKey(tag), text);
  } catch {
    /* storage full or unavailable: nothing more we can do */
  }
}

/** Never throws. Unreadable data is backed up before defaults are used. */
export function loadWithStatus(storage: StorageLike): LoadResult {
  const fresh = (readOnly = false): LoadResult => ({ data: defaultPersisted(), readOnly });
  let text: string | null;
  try {
    text = storage.getItem(STORAGE_KEY);
  } catch {
    return fresh();
  }
  if (!text) return fresh();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    backup(storage, 'corrupt', text);
    return fresh();
  }
  const version = isObj(raw) ? raw.version : undefined;
  if (typeof version === 'number' && version > STORAGE_VERSION) return fresh(true);
  const data = sanitize(raw);
  if (!data) {
    backup(storage, typeof version === 'number' ? `v${version}` : 'unknown', text);
    return fresh();
  }
  if (version === 1) {
    try {
      const shadow = storage.getItem(PRACTICE_KEY);
      if (shadow) data.practice = sanitizePractice(JSON.parse(shadow));
    } catch {
      /* keep the empty practice record */
    }
  }
  return { data, readOnly: false };
}

/** Never throws; anything unreadable gives defaults (see loadWithStatus). */
export function load(storage: StorageLike): Persisted {
  return loadWithStatus(storage).data;
}

export function save(storage: StorageLike, data: Persisted): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    storage.setItem(PRACTICE_KEY, JSON.stringify(data.practice));
    return true;
  } catch {
    return false;
  }
}

// ---- export / import: a base64 code of the JSON (copy-pasteable) ----
// The 'crappy1:' prefix names the code format, not the data version; codes made by older
// versions (data version 1) still import and are migrated.

export function encodeExport(data: Persisted): string {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return 'crappy1:' + btoa(bin);
}

export function decodeImport(code: string): Persisted | null {
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
