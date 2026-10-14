import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileLesson, renderMarkdown } from './compile';
import type { BetCopy, Chapter, ContentBundle, GlossaryEntry, Lesson } from './types';
import type { BetTypeId } from '../sim/engine/types';

/** Raw (uncompiled) source files, exposed so content tests can check them directly. */
export interface ContentSources {
  chapters: Chapter[];
  glossary: GlossaryEntry[];
  bets: Record<string, BetCopy>;
  samplesActive: boolean;
  lessonFiles: { file: string; slug: string; source: string }[];
}

/**
 * Reads content/. Real files (chapters.json, glossary.json, bets.json, lessons/NN-id.md) are owned
 * by the lesson authors. When chapters.json / glossary.json / bets.json are missing, the
 * `_sample-*` placeholders are used instead, and `_sample-*.md` lessons are only part of the
 * bundle in that fallback mode (`samplesActive`). Tests can read them with `includeSamples`.
 */
export function readSources(root: string, includeSamples = false): ContentSources {
  const dir = join(root, 'content');
  const has = (name: string) => existsSync(join(dir, name));
  const json = <T>(name: string, fallbackName: string, fallback: T): T => {
    const f = has(name) ? name : has(fallbackName) ? fallbackName : null;
    return f ? (JSON.parse(readFileSync(join(dir, f), 'utf8')) as T) : fallback;
  };
  const samplesActive = !has('chapters.json');
  const lessonDir = join(dir, 'lessons');
  const files = existsSync(lessonDir)
    ? readdirSync(lessonDir)
        .filter((f) => f.endsWith('.md') && (!f.startsWith('_') || samplesActive || includeSamples))
        .sort()
    : [];
  return {
    chapters: json<Chapter[]>('chapters.json', '_sample-chapters.json', []),
    glossary: json<GlossaryEntry[]>('glossary.json', '_sample-glossary.json', []),
    bets: json<Record<string, BetCopy>>('bets.json', '_sample-bets.json', {}),
    samplesActive,
    lessonFiles: files.map((f) => ({
      file: f,
      slug: f.replace(/^(\d+-|_sample-)/, '').replace(/\.md$/, ''),
      source: readFileSync(join(lessonDir, f), 'utf8'),
    })),
  };
}

export function buildContent(root: string): ContentBundle {
  const src = readSources(root);
  const glossarySlugs = new Set(src.glossary.map((g) => g.slug));
  const glossaryTerms = new Map(src.glossary.map((g) => [g.term.toLowerCase(), g.slug] as const));
  const opts = { glossarySlugs, glossaryTerms };
  const compiled = new Map(
    src.lessonFiles.map((f) => {
      const l = compileLesson(f.source, `content/lessons/${f.file}`, opts);
      return [l.id, l] as const;
    }),
  );
  const lessons: Lesson[] = [];
  for (const ch of src.chapters)
    for (const id of ch.lessons) {
      const l = compiled.get(id);
      if (!l) throw new Error(`chapters.json: chapter ${ch.id} references missing lesson ${id}`);
      lessons.push({ ...l, chapterId: ch.id });
      compiled.delete(id);
    }
  if (compiled.size && !src.samplesActive)
    throw new Error(`lessons not listed in chapters.json: ${[...compiled.keys()].join(', ')}`);
  const glossary = src.glossary.map((g) => ({
    ...g,
    definition: renderMarkdown(g.definition, opts),
  }));
  const bets = Object.fromEntries(
    Object.entries(src.bets).map(([k, v]) => [
      k,
      { ...v, howItWorks: renderMarkdown(v.howItWorks, opts) },
    ]),
  ) as Record<BetTypeId, BetCopy>;
  return { chapters: src.chapters, lessons, glossary, bets };
}

