import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileLesson, renderMarkdown } from './compile';
import type { BetCopy, Chapter, ContentBundle, GlossaryEntry, Lesson } from './types';
import type { BetTypeId } from '../sim/engine/types';

interface RawGlossary {
  term: string;
  slug?: string;
  definition: string;
  see?: string[];
  seeAlso?: string;
  lessonId?: string;
}

export const slugify = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Source entries may omit `slug` (derived from the term) and use `seeAlso: lessonId`. */
export function normalizeGlossary(g: RawGlossary): GlossaryEntry {
  const { seeAlso, slug, lessonId, ...rest } = g;
  const lid = lessonId ?? seeAlso;
  return { ...rest, slug: slug ?? slugify(g.term), ...(lid ? { lessonId: lid } : {}) };
}

/** bets.json may be a record keyed by bet id, or an array of `{ id, ...copy }` entries. */
export function normalizeBets(raw: unknown): Record<string, BetCopy> {
  if (!Array.isArray(raw)) return raw as Record<string, BetCopy>;
  const out: Record<string, BetCopy> = {};
  for (const e of raw as ({ id: string } & BetCopy)[]) {
    const { id, ...copy } = e;
    out[id] = copy;
  }
  return out;
}

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
    glossary: json<RawGlossary[]>('glossary.json', '_sample-glossary.json', []).map(normalizeGlossary),
    bets: normalizeBets(json<unknown>('bets.json', '_sample-bets.json', {})),
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

