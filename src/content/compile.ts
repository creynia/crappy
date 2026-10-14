import { Marked, marked } from 'marked';
import { parse as parseYaml } from 'yaml';
import { validateScene } from '../sim/scene';
import type { Block, Lesson, Quiz } from './types';

export interface CompileOptions {
  /** known glossary slugs, for `[[term]]` links; omit to skip link checking */
  glossarySlugs?: ReadonlySet<string>;
  /** glossary term (lowercase) → slug, for `[[term]]` */
  glossaryTerms?: ReadonlyMap<string, string>;
  /** subtract from every heading depth (min result 2), so lesson headings sit under the page h1 */
  headingShift?: number;
}

const shifted = new Map<number, Marked>();
function markedFor(shift: number): Marked | typeof marked {
  if (!shift) return marked;
  let m = shifted.get(shift);
  if (!m) {
    m = new Marked({
      renderer: {
        heading({ tokens, depth }) {
          const d = Math.min(6, Math.max(2, depth - shift));
          return `<h${d}>${this.parser.parseInline(tokens)}</h${d}>\n`;
        },
      },
    });
    shifted.set(shift, m);
  }
  return m;
}

/** Shallowest markdown heading depth outside code fences (7 if none). */
export function minHeadingDepth(body: string): number {
  let min = 7;
  let fence = '';
  for (const line of body.split(/\r?\n/)) {
    const f = /^(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!fence) fence = f[1]![0]!;
      else if (f[1]![0] === fence) fence = '';
      continue;
    }
    if (fence) continue;
    const h = /^(#{1,6})\s/.exec(line);
    if (h) min = Math.min(min, h[1]!.length);
  }
  return min;
}

export type CompiledLesson = Omit<Lesson, 'chapterId'>;

const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontMatter(source: string): { data: Record<string, unknown>; body: string } {
  const m = FM.exec(source);
  if (!m) return { data: {}, body: source };
  const data: unknown = parseYaml(m[1] ?? '');
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    throw new Error('front matter must be a YAML mapping');
  return { data: data as Record<string, unknown>, body: source.slice(m[0].length) };
}

/** Render markdown to HTML, resolving `[[term]]` / `[[term|label]]` glossary links. */
export function renderMarkdown(md: string, opts: CompileOptions = {}): string {
  const withLinks = md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, term: string, label?: string) => {
    const key = term.trim().toLowerCase();
    const slug = opts.glossaryTerms?.get(key) ?? (opts.glossarySlugs?.has(key) ? key : undefined);
    if (!slug) {
      if (opts.glossarySlugs || opts.glossaryTerms) throw new Error(`unknown glossary term [[${term}]]`);
      return label ?? term;
    }
    return `<a class="gloss" href="#/glossary?term=${encodeURIComponent(slug)}">${label ?? term.trim()}</a>`;
  });
  return (markedFor(opts.headingShift ?? 0).parse(withLinks, { async: false })).trim();
}

function str(v: unknown, what: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${what} must be a non-empty string`);
  return v;
}

export function parseQuizzes(yamlText: string, lessonId: string, startIndex: number): Quiz[] {
  const raw: unknown = parseYaml(yamlText);
  const list: unknown[] = Array.isArray(raw) ? raw : [raw];
  return list.map((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error('quiz entry must be a mapping');
    const o = item as Record<string, unknown>;
    const n = startIndex + i + 1;
    const options = o.options ?? o.choices;
    if (!Array.isArray(options) || !options.every((x) => typeof x === 'string'))
      throw new Error(`quiz ${n}: options must be a list of strings`);
    return {
      id: typeof o.id === 'string' && o.id ? o.id : `${lessonId}-q${n}`,
      prompt: str(o.q ?? o.prompt, `quiz ${n}: q`),
      choices: options,
      answer: o.answer as number,
      explanation: typeof (o.explain ?? o.explanation) === 'string' ? String(o.explain ?? o.explanation) : '',
    };
  });
}

type Seg =
  | { t: 'md'; text: string }
  | { t: 'fence'; lang: 'scene' | 'quiz'; text: string }
  | { t: 'box'; kind: 'math' | 'tip'; title: string; text: string };

/** Split a lesson body into markdown / scene / quiz / math / tip segments. */
function segment(body: string): Seg[] {
  const lines = body.split(/\r?\n/);
  const segs: Seg[] = [];
  let md: string[] = [];
  const flush = () => {
    if (md.join('').trim()) segs.push({ t: 'md', text: md.join('\n') });
    md = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const fence = /^(`{3,})\s*([\w-]*)\s*$/.exec(line);
    if (fence) {
      const [, ticks = '```', lang = ''] = fence;
      const end = findFenceEnd(lines, i + 1, ticks);
      if (lang === 'scene' || lang === 'quiz') {
        flush();
        segs.push({ t: 'fence', lang, text: lines.slice(i + 1, end).join('\n') });
      } else if (lang === 'math' || lang === 'callout') {
        throw new Error(`unknown directive \`\`\`${lang} (use :::${lang === 'math' ? 'math Title' : 'tip'})`);
      } else md.push(...lines.slice(i, end + 1));
      i = end + 1;
      continue;
    }
    const box = /^:::\s*(math|tip)\b\s*(.*)$/.exec(line);
    if (box) {
      flush();
      const kind = box[1] as 'math' | 'tip';
      const inner: string[] = [];
      i++;
      let closed = false;
      while (i < lines.length) {
        const l = lines[i] ?? '';
        const f = /^(`{3,})/.exec(l);
        if (f) {
          const end = findFenceEnd(lines, i + 1, f[1] ?? '```');
          inner.push(...lines.slice(i, end + 1));
          i = end + 1;
          continue;
        }
        if (/^:::\s*$/.test(l)) {
          closed = true;
          i++;
          break;
        }
        inner.push(l);
        i++;
      }
      if (!closed) throw new Error(`unclosed :::${kind} container`);
      segs.push({ t: 'box', kind, title: (box[2] ?? '').trim(), text: inner.join('\n') });
      continue;
    }
    if (/^:::/.test(line)) throw new Error(`unknown or stray container: ${line}`);
    md.push(line);
    i++;
  }
  flush();
  return segs;
}

function findFenceEnd(lines: string[], from: number, ticks: string): number {
  for (let j = from; j < lines.length; j++) {
    if ((lines[j] ?? '').trim() === ticks) return j;
  }
  throw new Error(`unclosed code fence (${ticks})`);
}

/** Pure: lesson source → Lesson (minus chapterId). Throws with a clear message on any error. */
export function compileLesson(source: string, file: string, opts: CompileOptions = {}): CompiledLesson {
  try {
    const { data, body } = splitFrontMatter(source);
    const id = str(data.id, 'front matter id');
    const min = minHeadingDepth(body);
    opts = { ...opts, headingShift: min <= 6 ? Math.max(0, min - 2) : 0 };
    const blocks: Block[] = [];
    let quizCount = 0;
    for (const seg of segment(body)) {
      if (seg.t === 'md') blocks.push({ kind: 'html', html: renderMarkdown(seg.text, opts) });
      else if (seg.t === 'box') {
        const html = renderMarkdown(seg.text, opts);
        if (seg.kind === 'tip') blocks.push({ kind: 'tip', html });
        else {
          if (!seg.title) throw new Error(':::math needs a title (":::math Title")');
          blocks.push({ kind: 'math', title: seg.title, html });
        }
      } else if (seg.lang === 'scene') {
        const res = validateScene(parseYaml(seg.text));
        if (!res.ok) throw new Error(`invalid scene: ${res.errors.join('; ')}`);
        blocks.push({ kind: 'scene', scene: res.scene });
      } else {
        const quizzes = parseQuizzes(seg.text, id, quizCount);
        quizCount += quizzes.length;
        for (const quiz of quizzes) blocks.push({ kind: 'quiz', quiz });
      }
    }
    const minutes = data.minutes;
    if (typeof minutes !== 'number' || !(minutes > 0)) throw new Error('front matter minutes must be a positive number');
    return {
      id,
      title: str(data.title, 'front matter title'),
      summary: str(data.summary, 'front matter summary'),
      minutes,
      blocks,
    };
  } catch (e) {
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
  }
}
