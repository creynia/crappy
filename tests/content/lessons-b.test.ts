/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-call */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { BET_TYPE_IDS, validateScene } from '../../src/sim';

const root = join(__dirname, '..', '..', 'content');
const lessonsDir = join(root, 'lessons');
const files = readdirSync(lessonsDir)
  .filter((f) => /^(09|1[0-6])-.*\.md$/.test(f))
  .sort();

const KNOWN_STRATEGIES = new Set([
  'pass-max-odds',
  'dont-pass-max-lay',
  'pass-2x-odds',
  'three-point-molly',
  'place-6-8',
  'iron-cross',
  'across',
  'field-every-roll',
  'any-7-every-roll',
  'hardways-all',
  'no-bet',
  'my-layout',
  'martingale-pass',
  'dont-come-molly',
  'buy-4-10',
  'lay-4-10',
  'place-6-8-press',
  'inside-regress',
  'pass-hedge-any-craps',
]);
const PRESETS = new Set(['standard-vegas', 'field-3x-12', 'odds-10x', 'odds-100x', 'crapless']);

function split(src: string) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(src);
  if (!m) throw new Error('missing frontmatter');
  return { front: parse(m[1] ?? "") as Record<string, unknown>, body: m[2] ?? "" };
}
function blocks(body: string, kind: string): unknown[] {
  const re = new RegExp('```' + kind + '\\n([\\s\\S]*?)\\n```', 'g');
  return [...body.matchAll(re)].map((m) => parse(m[1] ?? ""));
}

const lessons = files.map((f) => {
  const { front, body } = split(readFileSync(join(lessonsDir, f), 'utf8'));
  return { file: f, front, body, scenes: blocks(body, 'scene') as any[], quizzes: blocks(body, 'quiz') };
});

describe('lessons 09-16', () => {
  it('has all eight lesson files', () => {
    expect(files.length).toBe(8);
  });

  it('has valid, unique frontmatter matching file names', () => {
    const ids = new Set<string>();
    for (const l of lessons) {
      const f = l.front;
      expect(l.file.replace(/^\d+-/, '').replace(/\.md$/, '')).toBe(f.id);
      for (const k of ['id', 'title', 'chapter', 'summary'])
        expect(typeof f[k] === 'string' && (f[k]).length > 0, `${l.file} ${k}`).toBe(true);
      expect(Number.isInteger(f.minutes) && (f.minutes as number) > 0).toBe(true);
      expect(ids.has(f.id as string)).toBe(false);
      ids.add(f.id as string);
    }
  });

  it('has valid scenes with unique ids', () => {
    const sceneIds = new Set<string>();
    for (const l of lessons) {
      expect(l.scenes.length, l.file).toBeGreaterThan(0);
      for (const s of l.scenes) {
        const r = validateScene(s);
        expect(r.ok ? [] : r.errors, `${l.file} ${s?.id}`).toEqual([]);
        expect(sceneIds.has(s.id)).toBe(false);
        sceneIds.add(s.id);
        if (typeof s.rules === 'string') expect(PRESETS.has(s.rules)).toBe(true);
        expect(Number.isInteger(s.bankroll)).toBe(true);
        const ar = s.autoRoll;
        if (ar) {
          for (const id of ar.strategies ?? []) expect(KNOWN_STRATEGIES.has(id), id).toBe(true);
          if (ar.defaultStrategy) {
            expect(KNOWN_STRATEGIES.has(ar.defaultStrategy.id)).toBe(true);
            expect(Number.isInteger(ar.defaultStrategy.unit)).toBe(true);
          }
        }
        for (const st of s.steps ?? []) {
          for (const d of st.forcedDice ?? [])
            expect(d.length === 2 && d.every((x: number) => x >= 1 && x <= 6)).toBe(true);
        }
        const stepIds = (s.steps ?? []).map((x: any) => x.id);
        expect(new Set(stepIds).size).toBe(stepIds.length);
      }
    }
  });

  it('has one quiz per lesson with valid answers', () => {
    const qids = new Set<string>();
    for (const l of lessons) {
      expect(l.quizzes.length, l.file).toBe(1);
      const quiz = l.quizzes[0] as any[];
      expect(Array.isArray(quiz) && quiz.length > 0).toBe(true);
      quiz.forEach((q, i) => {
        expect(typeof q.q).toBe('string');
        expect(Array.isArray(q.options) && q.options.length >= 2).toBe(true);
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length).toBe(true);
        expect(typeof q.explain).toBe('string');
        const id = q.id ?? `${l.front.id}-q${i + 1}`;
        expect(qids.has(id)).toBe(false);
        qids.add(id);
      });
    }
  });

  it('avoids obsolete wording', () => {
    for (const l of lessons) {
      expect(l.body, l.file).not.toMatch(/unlock|drag|\bsound\b/i);
    }
  });
});

describe('bets.json', () => {
  const bets = JSON.parse(readFileSync(join(root, 'bets.json'), 'utf8')) as any[];
  it('covers exactly the engine bet ids', () => {
    const ids = bets.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...BET_TYPE_IDS].sort());
  });
  it('has well-formed entries', () => {
    for (const b of bets) {
      for (const k of ['name', 'shortName', 'group', 'summary', 'howItWorks'])
        expect(typeof b[k] === 'string' && b[k].length > 0, `${b.id} ${k}`).toBe(true);
      if (b.tip !== undefined) expect(typeof b.tip).toBe('string');
    }
  });
  it('points at existing lessons', () => {
    const courseIds = new Set([
      'dice-and-combinations', 'table-tour', 'come-out-and-point', 'pass-line', 'expected-value',
      'odds-bet', 'come-bets', 'checkpoint-core', 'place-bets', 'buy-and-lay', 'dont-side',
      'field-and-big-6-8', 'sucker-bets', 'edge-per-roll', 'variance-and-bankroll',
      'myths-and-systems', 'etiquette', 'strategy-lowest-edge', 'strategy-practical',
      'strategy-fun-per-dollar', 'final-exam',
    ]);
    for (const b of bets) expect(courseIds.has(b.lessonId), b.id).toBe(true);
  });
});
