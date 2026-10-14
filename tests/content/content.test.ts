import { describe, expect, it } from 'vitest';
import { buildContent, readSources } from '../../src/content/load';
import { compileLesson } from '../../src/content/compile';
import { BET_TYPE_IDS, isBetTypeId } from '../../src/sim/engine';
import { TIERS } from '../../src/content/types';

const root = process.cwd();
// includeSamples: _sample-* lessons are always validated, even when real content exists.
const src = readSources(root, true);
const glossarySlugs = new Set(src.glossary.map((g) => g.slug));
const glossaryTerms = new Map(src.glossary.map((g) => [g.term.toLowerCase(), g.slug] as const));
const opts = { glossarySlugs, glossaryTerms };
const compiled = src.lessonFiles.map((f) => ({
  f,
  lesson: compileLesson(f.source, `content/lessons/${f.file}`, opts),
}));

const lessonIdSet = new Set(compiled.map((c) => c.lesson.id));

describe('content: lessons', () => {
  it('has lesson files', () => {
    expect(compiled.length).toBeGreaterThan(0);
  });

  it('lesson ids are unique and match the file slug', () => {
    const ids = compiled.map((c) => c.lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { f, lesson } of compiled) {
      if (f.file.startsWith('_')) continue;
      expect(lesson.id, f.file).toBe(f.slug);
    }
  });

  it('every lesson has title, summary, minutes and at least one block', () => {
    for (const { lesson } of compiled) {
      expect(lesson.title.length).toBeGreaterThan(0);
      expect(lesson.summary.length).toBeGreaterThan(0);
      expect(lesson.minutes).toBeGreaterThan(0);
      expect(lesson.blocks.length).toBeGreaterThan(0);
    }
  });

  it('scene blocks pass validateScene (done in compile), ids unique per lesson, bet ids valid', () => {
    for (const { lesson } of compiled) {
      const seen = new Set<string>();
      for (const b of lesson.blocks) {
        if (b.kind !== 'scene') continue;
        expect(seen.has(b.scene.id), `${lesson.id}: duplicate scene ${b.scene.id}`).toBe(false);
        seen.add(b.scene.id);
        const ids = [
          ...(Array.isArray(b.scene.allowedBets) ? b.scene.allowedBets : []),
          ...(b.scene.highlightedBets ?? []),
          ...(b.scene.bets ?? []).map((x) => x.type),
        ];
        for (const id of ids) expect(isBetTypeId(id), `${lesson.id}: bad bet id ${id}`).toBe(true);
      }
    }
  });

  it('quizzes: >=2 distinct choices, answer in range, unique ids, explanation present', () => {
    for (const { lesson } of compiled) {
      const seen = new Set<string>();
      for (const b of lesson.blocks) {
        if (b.kind !== 'quiz') continue;
        const q = b.quiz;
        expect(seen.has(q.id), `${lesson.id}: duplicate quiz id ${q.id}`).toBe(false);
        seen.add(q.id);
        expect(q.prompt.length).toBeGreaterThan(0);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, `${q.id} answer`).toBe(true);
        expect(q.explanation.length, `${q.id} explain`).toBeGreaterThan(0);
      }
    }
  });

  it('math blocks have a title and a body', () => {
    for (const { lesson } of compiled)
      for (const b of lesson.blocks)
        if (b.kind === 'math') {
          expect(b.title.trim()).not.toBe('');
          expect(b.html.trim()).not.toBe('');
        }
  });
});

describe('content: chapters, glossary, bets', () => {
  it('chapters reference existing lessons, each lesson in exactly one chapter', () => {
    const ids = new Set(compiled.map((c) => c.lesson.id));
    const seen = new Map<string, string>();
    for (const ch of src.chapters) {
      expect(ch.title.length).toBeGreaterThan(0);
      for (const id of ch.lessons) {
        expect(ids.has(id), `chapter ${ch.id} -> ${id}`).toBe(true);
        expect(seen.has(id), `${id} in two chapters`).toBe(false);
        seen.set(id, ch.id);
      }
    }
    if (!src.samplesActive)
      for (const { f, lesson } of compiled)
        if (!f.file.startsWith('_')) expect(seen.has(lesson.id), `${lesson.id} not in a chapter`).toBe(true);
  });

  it('glossary slugs are unique and `see` references resolve', () => {
    expect(glossarySlugs.size).toBe(src.glossary.length);
    for (const g of src.glossary) {
      expect(g.term && g.slug && g.definition).toBeTruthy();
      if (g.lessonId) expect(lessonIdSet.has(g.lessonId), `${g.slug} lessonId`).toBe(true);
      for (const s of g.see ?? []) expect(glossarySlugs.has(s), `${g.slug} see ${s}`).toBe(true);
    }
  });

  it('bets.json covers every bet id exactly, with valid tiers and lesson ids', () => {
    expect(Object.keys(src.bets).sort()).toEqual([...BET_TYPE_IDS].sort());
    const lessonIds = new Set(compiled.map((c) => c.lesson.id));
    for (const [id, b] of Object.entries(src.bets)) {
      if (b.verdict) expect(TIERS, id).toContain(b.verdict);
      expect(b.summary.length, id).toBeGreaterThan(0);
      if (b.lessonId) expect(lessonIds.has(b.lessonId), `${id} lessonId`).toBe(true);
    }
  });
});

describe('content: bundle', () => {
  it('builds the production bundle', () => {
    const b = buildContent(root);
    expect(b.lessons.length).toBeGreaterThan(0);
    for (const l of b.lessons) expect(b.chapters.map((c) => c.id)).toContain(l.chapterId);
    expect(Object.keys(b.bets)).toHaveLength(BET_TYPE_IDS.length);
  });
});
