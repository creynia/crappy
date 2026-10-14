import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { validateScene } from '../../src/sim';

const root = join(__dirname, '..', '..', 'content');
const lessonDir = join(root, 'lessons');
const files = readdirSync(lessonDir)
  .filter((f) => /^0[1-8]-.*\.md$/.test(f))
  .sort();

function split(src: string) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(src);
  if (!m) throw new Error('missing frontmatter');
  return { fm: parse(m[1] as string) as Record<string, unknown>, body: m[2] as string };
}
function blocks(body: string, kind: string): unknown[] {
  const re = new RegExp('```' + kind + '\\n([\\s\\S]*?)\\n```', 'g');
  return [...body.matchAll(re)].map((m): unknown => parse(m[1] as string) as unknown);
}

const chapters = JSON.parse(readFileSync(join(root, 'chapters.json'), 'utf8')) as {
  id: string;
  lessons: string[];
}[];
const glossary = JSON.parse(readFileSync(join(root, 'glossary.json'), 'utf8')) as {
  term: string;
  definition: string;
  seeAlso?: string;
}[];
const allIds = chapters.flatMap((c) => c.lessons);

describe('lessons 1-8', () => {
  it('has all eight files', () => expect(files).toHaveLength(8));
  const sceneIds = new Set<string>();
  const quizIds = new Set<string>();
  for (const f of files) {
    describe(f, () => {
      const { fm, body } = split(readFileSync(join(lessonDir, f), 'utf8'));
      it('frontmatter', () => {
        expect(f.endsWith(`${String(fm.id)}.md`)).toBe(true);
        for (const k of ['id', 'title', 'chapter', 'summary'])
          expect(typeof fm[k]).toBe('string');
        expect(typeof fm.minutes).toBe('number');
        expect(chapters.find((c) => c.id === fm.chapter)?.lessons).toContain(fm.id);
      });
      it('has balanced containers and no stale wording', () => {
        expect((body.match(/^:::(math|tip)/gm) ?? []).length).toBe(
          (body.match(/^:::$/gm) ?? []).length,
        );
        expect(body).not.toMatch(/unlock|drag/i);
      });
      it('scenes validate', () => {
        for (const s of blocks(body, 'scene')) {
          const r = validateScene(s);
          expect(r.ok ? [] : r.errors).toEqual([]);
          const id = (s as { id: string }).id;
          expect(sceneIds.has(id)).toBe(false);
          sceneIds.add(id);
        }
      });
      it('has exactly one quiz with valid answers', () => {
        const q = blocks(body, 'quiz');
        expect(q).toHaveLength(1);
        const items = q[0] as { id?: string; q: string; options: string[]; answer: number; explain: string }[];
        items.forEach((it, i) => {
          expect(it.options.length).toBeGreaterThanOrEqual(2);
          expect(Number.isInteger(it.answer)).toBe(true);
          expect(it.answer).toBeGreaterThanOrEqual(0);
          expect(it.answer).toBeLessThan(it.options.length);
          expect(it.q && it.explain).toBeTruthy();
          const id = it.id ?? `${String(fm.id)}-q${i + 1}`;
          expect(quizIds.has(id)).toBe(false);
          quizIds.add(id);
        });
      });
    });
  }
});

describe('chapters and glossary', () => {
  it('lists 21 unique lessons in 6 chapters', () => {
    expect(chapters).toHaveLength(6);
    expect(allIds).toHaveLength(21);
    expect(new Set(allIds).size).toBe(21);
  });
  it('glossary entries are well formed', () => {
    expect(glossary.length).toBeGreaterThanOrEqual(40);
    expect(new Set(glossary.map((g) => g.term.toLowerCase())).size).toBe(glossary.length);
    for (const g of glossary) {
      expect(g.definition.length).toBeGreaterThan(10);
      if (g.seeAlso) expect(allIds).toContain(g.seeAlso);
    }
  });
});
