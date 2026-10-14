import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { validateScene } from '../../src/sim';

const dir = join(process.cwd(), 'content', 'lessons');
const files = readdirSync(dir)
  .filter((f) => /^(17|18|19|20|21)-.*\.md$/.test(f))
  .sort();

interface Parsed {
  front: Record<string, unknown>;
  body: string;
  scenes: unknown[];
  quizzes: Record<string, unknown>[];
}

function load(file: string): Parsed {
  const raw = readFileSync(join(dir, file), 'utf8');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`${file}: missing frontmatter`);
  const front = parse(m[1] ?? "") as Record<string, unknown>;
  const body = m[2] ?? "";
  const scenes: unknown[] = [];
  const quizzes: Record<string, unknown>[] = [];
  const re = /```(scene|quiz)\n([\s\S]*?)\n```/g;
  let b: RegExpExecArray | null;
  while ((b = re.exec(body))) {
    const data: unknown = parse(b[2] ?? "");
    if (b[1] === 'scene') scenes.push(data);
    else quizzes.push(...(data as Record<string, unknown>[]));
  }
  return { front, body, scenes, quizzes };
}

describe('lessons 17-21', () => {
  it('has all five files', () => {
    expect(files).toEqual([
      '17-etiquette.md',
      '18-strategy-lowest-edge.md',
      '19-strategy-practical.md',
      '20-strategy-fun-per-dollar.md',
      '21-final-exam.md',
    ]);
  });

  for (const file of files) {
    describe(file, () => {
      const p = load(file);

      it('has frontmatter', () => {
        for (const k of ['id', 'title', 'chapter', 'summary'])
          expect(typeof p.front[k]).toBe('string');
        expect(typeof p.front.minutes).toBe('number');
        expect(file.endsWith(`${String(p.front.id)}.md`)).toBe(true);
      });

      it('has balanced containers and no stale wording', () => {
        const opens = (p.body.match(/^:::(math|tip)/gm) ?? []).length;
        const closes = (p.body.match(/^:::$/gm) ?? []).length;
        expect(closes).toBe(opens);
        expect(p.body).not.toMatch(/unlock|challenge mode|call-bet/i);
      });

      it('has valid scenes', () => {
        const ids = new Set<string>();
        for (const s of p.scenes) {
          const r = validateScene(s);
          expect(r.ok ? [] : r.errors).toEqual([]);
          const id = (s as { id: string }).id;
          expect(ids.has(id)).toBe(false);
          ids.add(id);
          const steps = (s as { steps?: { id: string; text: string }[] }).steps ?? [];
          for (const st of steps) expect(st.text.length).toBeLessThan(220);
        }
      });

      it('has one quiz block with valid questions', () => {
        expect(p.quizzes.length).toBeGreaterThan(0);
        const ids = new Set<string>();
        p.quizzes.forEach((q, i) => {
          const id = typeof q.id === 'string' ? q.id : `${String(p.front.id)}-q${i + 1}`;
          expect(ids.has(id)).toBe(false);
          ids.add(id);
          const options = q.options as string[];
          expect(typeof q.q).toBe('string');
          expect(typeof q.explain).toBe('string');
          expect(options.length).toBeGreaterThanOrEqual(2);
          expect(Number.isInteger(q.answer)).toBe(true);
          expect(q.answer as number).toBeGreaterThanOrEqual(0);
          expect(q.answer as number).toBeLessThan(options.length);
        });
        expect((p.body.match(/```quiz/g) ?? []).length).toBe(1);
      });
    });
  }

  it('final exam has twelve questions', () => {
    expect(load('21-final-exam.md').quizzes).toHaveLength(12);
  });

  it('cheat sheet and $0.15 fix are present', () => {
    expect(load('20-strategy-fun-per-dollar.md').body).toContain('perfect-strategy cheat sheet');
    expect(load('19-strategy-practical.md').body).toContain('$0.15');
  });
});
