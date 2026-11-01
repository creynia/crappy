// Static, JS-free HTML pages for search engines and LLMs (plus sitemap.xml, llms.txt and
// llms-full.txt). The app itself uses hash routing, which crawlers ignore, so the normal build
// also writes real pages at /learn/, /learn/<id>/, /bets/, /bets/<id>/ and /glossary/, each with
// a link into the matching hash route. Text comes from the same compiled content bundle the
// app renders (src/content), and bet facts from the same helpers (src/app/bets.ts).
import { parse as parseYaml } from 'yaml';
import { buildContent, readSources } from '../src/content/load';
import type { ContentSources } from '../src/content/load';
import { parseQuizzes, segment, splitFrontMatter } from '../src/content/compile';
import type { BetCopy, Block, Chapter, ContentBundle, Lesson } from '../src/content/types';
import { TIER_LABEL } from '../src/content/types';
import { betLabel, betPayout, betRows, edgeFact, formatEdge, shortPayout } from '../src/app/bets';
import type { BetTypeId } from '../src/sim/engine';

export const ORIGIN = 'https://creynia.com';
export const APP = 'crappy';
export const GAME = 'Craps';
export const BASE = `${ORIGIN}/${APP}/`;
const THEME = '#0b3d2e';
const OG_IMAGE = `${ORIGIN}/assets/og/${APP}.jpg`;
/** GoatCounter page-view pixel (docs/analytics.md); same endpoint as src/app/analytics.ts. */
export const COUNT_URL = 'https://creynia.goatcounter.com/count';
const PERSON = {
  '@type': 'Person',
  '@id': `${ORIGIN}/#creynia`,
  name: 'creynia',
  url: `${ORIGIN}/`,
};
const WEBSITE_ID = `${ORIGIN}/#website`;
const COURSE_ID = `${BASE}learn/#course`;
const OTHER_APPS = [
  { app: 'baccaratton', game: 'Baccarat' },
  { app: 'holdumb', game: "Ultimate Texas Hold'em" },
  { app: 'spinner', game: 'Roulette strategy lab' },
];

/** Top-level dist entries owned by the static site; the service worker must not precache them. */
export const STATIC_DIRS = ['learn', 'bets', 'glossary'] as const;
export const STATIC_FILES = ['sitemap.xml', 'llms.txt', 'llms-full.txt'] as const;
export function isStaticSiteFile(distPath: string): boolean {
  const p = distPath.replace(/^\.?\//, '');
  return (
    (STATIC_FILES as readonly string[]).includes(p) ||
    STATIC_DIRS.some((d) => p === d || p.startsWith(d + '/'))
  );
}

export interface StaticPage {
  /** path below the app root with a trailing slash, e.g. `learn/pass-line/` */
  path: string;
  title: string;
  description: string;
  h1: string;
  html: string;
  /** readable markdown of the page, for llms-full.txt */
  markdown: string;
}

export interface StaticSite {
  pages: StaticPage[];
  /** every emitted file, keyed by dist-relative path */
  files: Record<string, string>;
}

// ---------------------------------------------------------------------------------- helpers

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const abs = (path: string) => BASE + path;
/** Relative prefix from a page at `path` back to the app root (`learn/x/` -> `../../`). */
const up = (path: string) => '../'.repeat(path.split('/').filter(Boolean).length);

/** Join a lead sentence and the longest filler that keeps the result within 160 chars. */
export function fitDescription(lead: string, fillers: string[]): string {
  const base = lead.trim();
  for (const f of fillers) {
    const s = `${base} ${f}`.trim();
    if (s.length <= 160) return s;
  }
  if (base.length <= 160) return base;
  return base.slice(0, 157).replace(/\s+\S*$/, '') + '...';
}

/** `[[term|label]]` -> label, for plain-text/markdown output. */
const unGloss = (md: string) =>
  md.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t: string, l?: string) => l ?? t.trim());

/** Rewrite the app's hash links (`#/learn/x`, `#/glossary?term=y`) for a static page. */
export function rewriteLinks(html: string, path: string): string {
  const root = up(path);
  return html.replace(/href="#(\/[^"]*)"/g, (_m, route: string) => {
    const [p = '', q = ''] = route.split('?');
    const segs = p.split('/').filter(Boolean);
    const term = new URLSearchParams(q).get('term');
    if (segs[0] === 'glossary' && segs.length === 1)
      return `href="${root}glossary/${term ? '#' + esc(term) : ''}"`;
    if ((segs[0] === 'learn' || segs[0] === 'bets') && segs.length <= 2)
      return `href="${root}${segs.join('/')}/"`;
    return `href="${root}#${route}"`;
  });
}

function jsonLd(graph: object[]): string {
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  return `<script type="application/ld+json">${json.replace(/</g, '\\u003c')}</script>`;
}

interface Crumb {
  name: string;
  path: string | null; // null = absolute landing URL
}
function crumbs(trail: Crumb[]) {
  const all: Crumb[] = [
    { name: 'Know the Odds', path: null },
    { name: `${GAME} (${APP})`, path: '' },
    ...trail,
  ];
  return {
    all,
    ld: {
      '@type': 'BreadcrumbList',
      itemListElement: all.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: c.path === null ? `${ORIGIN}/` : abs(c.path),
      })),
    },
  };
}

const minutesIso = (m: number) => `PT${Math.round(m)}M`;

// ---------------------------------------------------------------------------------- layout

const CSS = `
:root{color-scheme:dark;--bg:#0d1f19;--felt:${THEME};--surface:#143026;--surface-2:#1b3d31;--border:#2a5646;--text:#eef4f0;--muted:#9db8ac;--accent:#3ecf8e;--accent-ink:#04210f;--link:#7fe3b4;--gold:#d4af37}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-wrap:break-word}
a{color:var(--link)}
.wrap{max-width:72ch;margin:0 auto;padding:0 16px}
.top{background:var(--felt);border-bottom:3px solid var(--gold)}
.top .wrap{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-top:12px;padding-bottom:12px}
.top a{color:var(--text);text-decoration:none}
.brand{font-size:.85rem;color:var(--muted)!important;letter-spacing:.04em;text-transform:uppercase}
.app{font-weight:700;font-size:1.15rem}
.app small{font-weight:400;color:var(--muted);font-size:.85rem}
nav.crumbs{font-size:.85rem;color:var(--muted);margin:16px 0 0}
nav.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:4px}
nav.crumbs li+li::before{content:"/";margin:0 6px 0 2px;color:var(--border)}
nav.crumbs a{color:var(--muted)}
h1{font-size:clamp(1.6rem,5vw,2.2rem);line-height:1.2;margin:12px 0 8px}
h2{font-size:1.35rem;margin:1.8em 0 .5em;line-height:1.3}
h3{font-size:1.1rem;margin:1.4em 0 .4em}
.muted{color:var(--muted)}
.lead{font-size:1.1rem}
table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%;margin:1em 0;font-size:.95rem}
th,td{border:1px solid var(--border);padding:6px 10px;text-align:left;vertical-align:top}
th{background:var(--surface-2)}
td.num{text-align:right;white-space:nowrap}
code{background:var(--surface-2);padding:1px 5px;border-radius:4px;font-size:.92em}
pre{background:var(--surface);padding:12px;border-radius:8px;overflow-x:auto}
blockquote{margin:1em 0;padding:4px 16px;border-left:4px solid var(--border);color:var(--muted)}
.card,.tip,details.math,.quiz,.scene{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 16px;margin:1.2em 0}
.tip{border-left:4px solid var(--gold)}
.tag{display:block;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--gold);margin-bottom:2px}
.tip>*,.scene>*,.quiz>*,.cta-box>*{margin-top:.4em;margin-bottom:.4em}
.tip>:first-child,.scene>:first-child,.quiz>:first-child,details.math>:first-child{margin-top:0}
.tip>:last-child,.scene>:last-child,.quiz>:last-child,details.math>:last-child,.cta-box>:last-child{margin-bottom:0}
details summary{cursor:pointer;font-weight:600;color:var(--link)}
.quiz ol{padding-left:1.6em}
.scene h3{margin-top:.2em}
.cta{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:700;text-decoration:none;padding:12px 20px;border-radius:999px;margin:8px 8px 8px 0}
.cta.ghost{background:transparent;color:var(--link);border:2px solid var(--accent)}
.cta-box{margin:2em 0;padding:16px;border-radius:12px;background:var(--felt);border:1px solid var(--border)}
.cta-box p{margin:0 0 4px}
.prevnext{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin:1.5em 0;padding-top:1em;border-top:1px solid var(--border)}
.prevnext a{max-width:48%}
.prevnext .next{margin-left:auto;text-align:right}
ol.lessons{padding-left:1.4em}
ol.lessons li{margin:.6em 0}
ol.lessons .muted{display:block;font-size:.95rem}
dl.facts{display:grid;grid-template-columns:auto 1fr;gap:4px 16px;margin:1em 0}
dl.facts dt{color:var(--muted)}
dl.facts dd{margin:0;font-weight:600}
dl.gloss dt{font-weight:700;font-size:1.05rem;margin-top:1.2em;scroll-margin-top:16px}
dl.gloss dd{margin:.2em 0 0}
dl.gloss dd p{margin:.3em 0}
.badge{display:inline-block;font-size:.8rem;font-weight:700;padding:2px 10px;border-radius:999px;border:1px solid currentColor;white-space:nowrap}
.tier-free{color:#4cc9f0}.tier-good{color:#3ecf8e}.tier-fair{color:#f2c94c}.tier-poor{color:#f2994a}.tier-avoid{color:#eb5757}
footer{margin-top:3em;background:var(--surface);border-top:1px solid var(--border);font-size:.9rem;color:var(--muted)}
footer .wrap{padding-top:20px;padding-bottom:28px}
footer p{margin:.5em 0}
footer ul{list-style:none;padding:0;margin:.8em 0;display:flex;flex-wrap:wrap;gap:6px 16px}
`
  .trim()
  .replace(/\n/g, '');

interface Layout {
  path: string;
  title: string;
  description: string;
  ogType: 'website' | 'article';
  trail: Crumb[];
  ld: object[];
  body: string;
}

/** A JS-free, cookieless page-view count for a static page (path like 'learn/pass-line/'). */
export function countPixel(path: string): string {
  const p = encodeURIComponent(`/${APP}/${path}`);
  return `<img src="${COUNT_URL}?p=${p}" alt="" width="1" height="1" style="position:absolute;left:-9999px">`;
}

function page(o: Layout): string {
  const root = up(o.path);
  const url = abs(o.path);
  const { all, ld } = crumbs(o.trail);
  const crumbHtml = all
    .map((c, i) => {
      const href = c.path === null ? `${ORIGIN}/` : root + c.path;
      return i === all.length - 1
        ? `<li><span aria-current="page">${esc(c.name)}</span></li>`
        : `<li><a href="${href}">${esc(c.name)}</a></li>`;
    })
    .join('');
  const others = OTHER_APPS.map(
    (a) => `<li><a href="${ORIGIN}/${a.app}/">${esc(a.app)}: ${esc(a.game)}</a></li>`,
  ).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="${THEME}">
<link rel="icon" href="${root}icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}icons/apple-touch-icon.png">
<meta property="og:site_name" content="Know the Odds">
<meta property="og:type" content="${o.ogType}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.title)}">
<meta name="twitter:description" content="${esc(o.description)}">
<meta name="twitter:image" content="${OG_IMAGE}">
${jsonLd([...o.ld, ld])}
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="${ORIGIN}/">Know the Odds</a><a class="app" href="${root}">${APP} <small>${GAME}</small></a></div></header>
<div class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbHtml}</ol></nav>
<main>
${o.body}
</main>
</div>
<footer><div class="wrap">
<p><strong>For education only, with play money only.</strong> The house always has an edge, and no betting system changes that. These apps show how big the edge is, not how to beat it.</p>
<p>If gambling is hurting you or someone you know, call or text <strong>1-800-GAMBLER</strong> (US), or contact your national problem-gambling helpline.</p>
<ul><li><a href="${ORIGIN}/">Know the Odds: creynia's casino lab</a></li>${others}</ul>
</div></footer>
${countPixel(o.path)}
</body>
</html>
`;
}

const cta = (href: string, label: string, note: string, extra = '') =>
  `<div class="cta-box"><p>${note}</p><a class="cta" href="${href}">${esc(label)}</a>${extra}</div>`;

// ---------------------------------------------------------------------------------- lessons

function blockHtml(b: Block, lesson: Lesson, path: string): string {
  const root = up(path);
  switch (b.kind) {
    case 'html':
      return rewriteLinks(b.html, path);
    case 'tip':
      return `<aside class="tip"><strong class="tag">Tip</strong>${rewriteLinks(b.html, path)}</aside>`;
    case 'math':
      return `<details class="math"><summary>Show the math: ${esc(b.title)}</summary>${rewriteLinks(b.html, path)}</details>`;
    case 'scene':
      return `<section class="scene"><h3>${esc(b.scene.title ?? 'Try it')}</h3><p class="muted">Interactive practice table. <a href="${root}#/learn/${esc(lesson.id)}">Try this in the app</a> (free, play money).</p></section>`;
    case 'quiz': {
      const q = b.quiz;
      const letter = (i: number) => String.fromCharCode(65 + i);
      const right = q.choices[q.answer] ?? '';
      return `<section class="quiz"><strong class="tag">Quiz</strong><p>${esc(q.prompt)}</p><ol type="A">${q.choices
        .map((c) => `<li>${esc(c)}</li>`)
        .join(
          '',
        )}</ol><details><summary>Show answer</summary><p><strong>${letter(q.answer)}: ${esc(right)}.</strong> ${esc(q.explanation)}</p></details></section>`;
    }
  }
}

/** Lesson body as markdown for llms-full.txt (custom syntax turned into plain markdown). */
function lessonMarkdown(source: string, id: string): string {
  const { body } = splitFrontMatter(source);
  let quizN = 0;
  const out: string[] = [];
  for (const seg of segment(body)) {
    if (seg.t === 'md') out.push(unGloss(seg.text).trim());
    else if (seg.t === 'box') {
      const inner = unGloss(seg.text).trim();
      out.push(
        seg.kind === 'tip'
          ? inner
              .split('\n')
              .map((l, i) => `> ${i === 0 ? '**Tip:** ' : ''}${l}`)
              .join('\n')
          : `**Show the math: ${seg.title}**\n\n${inner}`,
      );
    } else if (seg.lang === 'scene') {
      const title = (parseYaml(seg.text) as { title?: string } | null)?.title ?? 'Try it';
      out.push(`*Interactive practice table in the app: ${title}.*`);
    } else {
      const qs = parseQuizzes(seg.text, id, quizN);
      quizN += qs.length;
      for (const q of qs)
        out.push(
          `**Quiz:** ${q.prompt}\n\n${q.choices.map((c, i) => `${String.fromCharCode(65 + i)}. ${c}`).join('\n')}\n\nAnswer: ${String.fromCharCode(65 + q.answer)}. ${q.explanation}`.trim(),
        );
    }
  }
  return out.filter(Boolean).join('\n\n');
}

function lessonTitle(t: string): string {
  const full = `${t} | Learn ${GAME} | ${APP}`;
  return full.length <= 60 ? full : `${t} | ${APP}`;
}

function educationalLevel(chapters: Chapter[], chapterId: string): string {
  return chapters.findIndex((c) => c.id === chapterId) < 2 ? 'Beginner' : 'Intermediate';
}

function lessonPages(content: ContentBundle, sources: Map<string, string>): StaticPage[] {
  const { lessons, chapters } = content;
  return lessons.map((l, i) => {
    const path = `learn/${l.id}/`;
    const root = up(path);
    const chapter = chapters.find((c) => c.id === l.chapterId);
    const prev = lessons[i - 1];
    const next = lessons[i + 1];
    const title = lessonTitle(l.title);
    const description = fitDescription(l.summary, [
      `A free ${l.minutes}-minute craps lesson with a play-money practice table.`,
      `Free ${l.minutes}-minute craps lesson.`,
      'Free craps lesson.',
    ]);
    const body = [
      `<article>`,
      `<h1>${esc(l.title)}</h1>`,
      `<p class="muted">${chapter ? `Chapter ${chapters.indexOf(chapter) + 1}: ${esc(chapter.title)} · ` : ''}Lesson ${i + 1} of ${lessons.length} · ${l.minutes} min read</p>`,
      `<p class="lead">${esc(l.summary)}</p>`,
      ...l.blocks.map((b) => blockHtml(b, l, path)),
      `</article>`,
      cta(
        `${root}#/learn/${esc(l.id)}`,
        `Open this lesson in ${APP}: free, play money`,
        'Play the practice scenes, answer the quizzes and track your progress in the app.',
      ),
      `<nav class="prevnext" aria-label="Lessons">`,
      prev ? `<a class="prev" href="../${esc(prev.id)}/">← ${esc(prev.title)}</a>` : '',
      next ? `<a class="next" href="../${esc(next.id)}/">${esc(next.title)} →</a>` : '',
      `</nav>`,
      `<p><a href="../">All ${lessons.length} craps lessons</a> · <a href="${root}glossary/">Glossary</a> · <a href="${root}bets/">Every bet and its house edge</a></p>`,
    ].join('\n');
    const ld = {
      '@type': ['Article', 'LearningResource'],
      '@id': abs(path) + '#lesson',
      url: abs(path),
      headline: l.title,
      name: l.title,
      description: l.summary,
      timeRequired: minutesIso(l.minutes),
      inLanguage: 'en',
      educationalLevel: educationalLevel(chapters, l.chapterId),
      learningResourceType: 'Lesson',
      isAccessibleForFree: true,
      position: i + 1,
      author: PERSON,
      publisher: PERSON,
      image: OG_IMAGE,
      isPartOf: { '@id': COURSE_ID },
    };
    return {
      path,
      title,
      description,
      h1: l.title,
      html: page({
        path,
        title,
        description,
        ogType: 'article',
        trail: [
          { name: 'Learn', path: 'learn/' },
          { name: l.title, path },
        ],
        ld: [ld],
        body,
      }),
      markdown: `${l.summary}\n\n${lessonMarkdown(sources.get(l.id) ?? '', l.id)}`,
    };
  });
}

function courseIndex(content: ContentBundle): StaticPage {
  const path = 'learn/';
  const { lessons, chapters } = content;
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const total = lessons.reduce((s, l) => s + l.minutes, 0);
  const h1 = `Learn ${GAME}: the free course`;
  const title = `Learn ${GAME} Free: ${lessons.length}-Lesson Course | ${APP}`;
  const description = fitDescription(
    `A free craps course in ${lessons.length} short lessons: dice odds, the Pass Line, free Odds, every bet's house edge, bankroll and perfect strategy.`,
    ['Play money only.'],
  );
  const intro = `Learn craps from zero to perfect strategy. ${lessons.length} short lessons in ${chapters.length} chapters (about ${Math.round(total / 60)} hours in all), with practice scenes and quizzes in the app.`;
  let n = 0;
  const chapterHtml = chapters
    .map((ch, ci) => {
      const ls = ch.lessons.map((id) => byId.get(id)).filter((l) => l !== undefined);
      return `<section><h2>Chapter ${ci + 1}: ${esc(ch.title)}</h2><p class="muted">${esc(ch.summary)}</p><ol class="lessons" start="${n + 1}">${ls
        .map((l) => {
          n++;
          return `<li><a href="${esc(l.id)}/"><strong>${esc(l.title)}</strong></a> <span class="muted">${esc(l.summary)} (${l.minutes} min)</span></li>`;
        })
        .join('')}</ol></section>`;
    })
    .join('\n');
  const body = [
    `<h1>${esc(h1)}</h1>`,
    `<p class="lead">${esc(intro)}</p>`,
    cta(
      '../#/learn',
      `Start the course in ${APP}: free, play money`,
      'Progress is saved on your device. Works offline once installed.',
    ),
    chapterHtml,
    `<p><a href="../glossary/">Craps glossary</a> · <a href="../bets/">Every craps bet and its house edge</a></p>`,
  ].join('\n');
  const ld = [
    {
      '@type': 'Course',
      '@id': COURSE_ID,
      name: `Learn ${GAME}`,
      description: intro,
      url: abs(path),
      inLanguage: 'en',
      isAccessibleForFree: true,
      provider: PERSON,
      author: PERSON,
      image: OG_IMAGE,
      offers: { '@type': 'Offer', price: 0, priceCurrency: 'USD', category: 'Free' },
      hasCourseInstance: {
        '@type': 'CourseInstance',
        courseMode: 'online',
        courseWorkload: minutesIso(total),
        url: BASE,
      },
      isPartOf: { '@id': WEBSITE_ID },
    },
    {
      '@type': 'ItemList',
      name: `Learn ${GAME}: lessons`,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      numberOfItems: lessons.length,
      itemListElement: lessons.map((l, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: abs(`learn/${l.id}/`),
        name: l.title,
      })),
    },
  ];
  const md = chapters
    .map(
      (ch, ci) =>
        `## Chapter ${ci + 1}: ${ch.title}\n\n${ch.summary}\n\n${ch.lessons
          .map((id) => byId.get(id))
          .filter((l) => l !== undefined)
          .map((l) => `- [${l.title}](${abs(`learn/${l.id}/`)}): ${l.summary} (${l.minutes} min)`)
          .join('\n')}`,
    )
    .join('\n\n');
  return {
    path,
    title,
    description,
    h1,
    html: page({
      path,
      title,
      description,
      ogType: 'website',
      trail: [{ name: 'Learn', path }],
      ld,
      body,
    }),
    markdown: `${intro}\n\n${md}`,
  };
}

// ---------------------------------------------------------------------------------- bets

const BETS_INTRO =
  'House edge is the average share of each bet the casino keeps. Standard Vegas rules, shown at a typical bet size.';

function betPages(content: ContentBundle, raw: ContentSources): StaticPage[] {
  const rows = betRows(content.bets);
  // Same default order as the app's Bets screen: lowest edge first.
  const order = (r: (typeof rows)[number]) => r.edge ?? 1;
  const sorted = [...rows].sort((a, b) => order(a) - order(b));
  const lessonTitleById = new Map(content.lessons.map((l) => [l.id, l.title]));

  const idxPath = 'bets/';
  const idxH1 = `Every ${GAME} bet and its house edge`;
  const idxTitle = `${GAME} Bets: Payouts & House Edge of All ${rows.length} | ${APP}`;
  const idxDesc = fitDescription(
    `All ${rows.length} craps bets compared: what each pays and its house edge under standard Vegas rules, from the free Odds bet to the sucker bets.`,
    ['Play money practice.'],
  );
  const table = `<table><thead><tr><th>Bet</th><th>Pays</th><th class="num">Edge</th><th>Verdict</th></tr></thead><tbody>${sorted
    .map(
      (r) =>
        `<tr><td><a href="${esc(r.id)}/">${esc(r.label)}</a></td><td>${esc(shortPayout(r.id, r.payout) ?? '--')}</td><td class="num">${formatEdge(r.edge)}</td><td><span class="badge tier-${r.tier}">${TIER_LABEL[r.tier]}</span></td></tr>`,
    )
    .join('')}</tbody></table>`;
  const index: StaticPage = {
    path: idxPath,
    title: idxTitle,
    description: idxDesc,
    h1: idxH1,
    html: page({
      path: idxPath,
      title: idxTitle,
      description: idxDesc,
      ogType: 'website',
      trail: [{ name: 'Bets', path: idxPath }],
      ld: [
        {
          '@type': 'ItemList',
          name: `${GAME} bets`,
          numberOfItems: sorted.length,
          itemListElement: sorted.map((r, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: abs(`bets/${r.id}/`),
            name: r.label,
          })),
        },
      ],
      body: [
        `<h1>${esc(idxH1)}</h1>`,
        `<p class="lead">${esc(BETS_INTRO)}</p>`,
        table,
        cta(
          '../#/bets',
          `Compare bets in ${APP}`,
          'Sort and filter every bet, then try any of them at the practice table.',
        ),
        `<p><a href="../learn/">The free craps course</a> · <a href="../glossary/">Glossary</a></p>`,
      ].join('\n'),
    }),
    markdown: `${BETS_INTRO}\n\n| Bet | Pays | House edge | Verdict |\n|---|---|---|---|\n${sorted
      .map(
        (r) =>
          `| [${r.label}](${abs(`bets/${r.id}/`)}) | ${shortPayout(r.id, r.payout) ?? '--'} | ${formatEdge(r.edge)} | ${TIER_LABEL[r.tier]} |`,
      )
      .join('\n')}`,
  };

  const src = raw.bets as Partial<Record<string, BetCopy>>;
  const details = sorted.map((r, i): StaticPage => {
    const id = r.id as BetTypeId;
    const path = `bets/${id}/`;
    const copy = content.bets[id];
    const label = betLabel(id, copy);
    const pays = betPayout(id) ?? '--';
    const edge = edgeFact(id);
    const named = /\bbet$/i.test(label) ? label : `${label} Bet`;
    const t1 = `${named} in ${GAME}: Payout & House Edge | ${APP}`;
    const title = t1.length <= 60 ? t1 : `${named}: Payout & House Edge | ${APP}`;
    const verdict = TIER_LABEL[r.tier];
    const description = fitDescription(copy ? copy.summary : `The ${label} bet in craps.`, [
      `Pays ${pays}; house edge ${edge} under standard Vegas rules (${verdict}). Try it free with play money.`,
      `Pays ${pays}; house edge ${edge} under standard Vegas rules (${verdict}).`,
      `Pays ${pays}; house edge ${edge} (${verdict}).`,
      `House edge ${edge} under standard Vegas rules (${verdict}). Try it free with play money.`,
      `House edge ${edge} (${verdict}).`,
      `House edge ${edge}.`,
    ]);
    const lessonId = copy?.lessonId;
    const prev = sorted[i - 1];
    const next = sorted[i + 1];
    const body = [
      `<h1>${esc(label)}</h1>`,
      `<p><span class="badge tier-${r.tier}">${TIER_LABEL[r.tier]}</span></p>`,
      `<dl class="facts"><dt>Pays</dt><dd>${esc(pays)}</dd><dt>House edge</dt><dd>${esc(edge)}</dd></dl>`,
      copy
        ? `<p class="lead">${esc(copy.summary)}</p>\n${rewriteLinks(copy.howItWorks, path)}${copy.tip ? `\n<aside class="tip"><strong class="tag">Tip</strong><p>${esc(copy.tip)}</p></aside>` : ''}`
        : '',
      `<p class="muted">${esc(BETS_INTRO)}</p>`,
      cta(
        `../../#/play?preset=${esc(id)}`,
        'Try it at the table: free, play money',
        `Place a ${esc(label)} bet in ${APP} and see its expected value before you roll.`,
        lessonId && lessonTitleById.has(lessonId)
          ? `<a class="cta ghost" href="../../learn/${esc(lessonId)}/">Lesson: ${esc(lessonTitleById.get(lessonId) ?? '')}</a>`
          : '',
      ),
      `<nav class="prevnext" aria-label="Bets">`,
      prev ? `<a class="prev" href="../${esc(prev.id)}/">← ${esc(prev.label)}</a>` : '',
      next ? `<a class="next" href="../${esc(next.id)}/">${esc(next.label)} →</a>` : '',
      `</nav>`,
      `<p><a href="../">All ${rows.length} craps bets</a> · <a href="../../learn/">The free craps course</a></p>`,
    ].join('\n');
    const howMd = unGloss(src[id]?.howItWorks ?? '');
    return {
      path,
      title,
      description,
      h1: label,
      html: page({
        path,
        title,
        description,
        ogType: 'article',
        trail: [
          { name: 'Bets', path: 'bets/' },
          { name: label, path },
        ],
        ld: [
          {
            '@type': 'WebPage',
            '@id': abs(path),
            url: abs(path),
            name: `${label} (${GAME} bet)`,
            description,
            inLanguage: 'en',
            author: PERSON,
            isPartOf: { '@id': WEBSITE_ID },
          },
        ],
        body,
      }),
      markdown: [
        `Pays: ${pays}. House edge: ${edge}. Verdict: ${TIER_LABEL[r.tier]}.`,
        copy?.summary ?? '',
        howMd,
        copy?.tip ? `Tip: ${copy.tip}` : '',
        lessonId ? `Lesson: ${abs(`learn/${lessonId}/`)}` : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
    };
  });
  return [index, ...details];
}

// ---------------------------------------------------------------------------------- glossary

function glossaryPage(content: ContentBundle, rawSrc: ContentSources): StaticPage {
  const path = 'glossary/';
  const entries = [...content.glossary].sort((a, b) => a.term.localeCompare(b.term));
  const bySlug = new Map(entries.map((g) => [g.slug, g]));
  const lessonTitleById = new Map(content.lessons.map((l) => [l.id, l.title]));
  const h1 = `${GAME} glossary`;
  const title = `${GAME} Glossary: ${entries.length} Terms in Plain English | ${APP}`;
  const description = fitDescription(
    `Craps terms explained in plain English: ${entries
      .slice(0, 4)
      .map((g) => g.term)
      .join(', ')} and ${entries.length - 4} more, each linked to the lesson that teaches it.`,
    [],
  );
  const raw = new Map(rawSrc.glossary.map((g) => [g.slug, g.definition]));
  const dl = entries
    .map((g) => {
      const extra = [
        g.lessonId && lessonTitleById.has(g.lessonId)
          ? `<p><a href="../learn/${esc(g.lessonId)}/">Learn more in the lesson: ${esc(lessonTitleById.get(g.lessonId) ?? '')}</a></p>`
          : '',
        g.see?.length
          ? `<p class="muted">See also: ${g.see.map((s) => `<a href="#${esc(s)}">${esc(bySlug.get(s)?.term ?? s)}</a>`).join(', ')}</p>`
          : '',
      ].join('');
      return `<dt id="${esc(g.slug)}">${esc(g.term)}</dt><dd>${rewriteLinks(g.definition, path)}${extra}</dd>`;
    })
    .join('\n');
  const ld = {
    '@type': 'DefinedTermSet',
    '@id': abs(path) + '#terms',
    name: `${GAME} glossary`,
    url: abs(path),
    inLanguage: 'en',
    hasDefinedTerm: entries.map((g) => ({
      '@type': 'DefinedTerm',
      '@id': `${abs(path)}#${g.slug}`,
      name: g.term,
      url: `${abs(path)}#${g.slug}`,
      description: unGloss(raw.get(g.slug) ?? '').replace(/[*_`]/g, ''),
      inDefinedTermSet: abs(path) + '#terms',
    })),
  };
  return {
    path,
    title,
    description,
    h1,
    html: page({
      path,
      title,
      description,
      ogType: 'website',
      trail: [{ name: 'Glossary', path }],
      ld: [ld],
      body: [
        `<h1>${esc(h1)}</h1>`,
        `<p class="lead">${entries.length} craps terms, from the crew at the table to the bets on the layout.</p>`,
        `<dl class="gloss">${dl}</dl>`,
        cta(
          '../#/glossary',
          `Open the glossary in ${APP}`,
          'Search the glossary and jump into any lesson in the app.',
        ),
        `<p><a href="../learn/">The free craps course</a> · <a href="../bets/">Every craps bet and its house edge</a></p>`,
      ].join('\n'),
    }),
    markdown: entries
      .map((g) => `**${g.term}** (${abs(path)}#${g.slug}): ${unGloss(raw.get(g.slug) ?? '')}`)
      .join('\n\n'),
  };
}

// ---------------------------------------------------------------------------------- site

export const SPA_TITLE = `Learn ${GAME} Free: Lessons, Odds & Practice Table | ${APP}`;

function sitemap(pages: StaticPage[]): string {
  const urls = [BASE, ...pages.map((p) => abs(p.path))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${esc(u)}</loc></url>`)
    .join('\n')}\n</urlset>\n`;
}

const SUMMARY = `${APP} is a free craps course and practice table in the browser: ${'{n}'} short lessons from the dice basics to perfect strategy, with an interactive table that shows the expected value of every bet before you make it. Play money only, works offline, part of Know the Odds, creynia's casino lab.`;

function llms(content: ContentBundle, pages: StaticPage[]): string {
  const find = (p: string) => pages.find((x) => x.path === p);
  const lines: string[] = [
    `# ${APP} — ${GAME}`,
    '',
    `> ${SUMMARY.replace('{n}', String(content.lessons.length))}`,
    '',
    'Every static page below mirrors what the app shows (same lesson text, same computed payouts and house edges under standard Vegas rules). For education only; the house always has an edge.',
    '',
    '## App',
    '',
    `- [${APP}: learn and practice ${GAME}](${BASE}): The interactive app (lessons with practice scenes and quizzes, a practice table, drills). Free, play money.`,
    '',
    '## Course',
    '',
    `- [Learn ${GAME}: course index](${abs('learn/')}): ${find('learn/')?.description ?? ''}`,
  ];
  for (const ch of content.chapters) {
    lines.push('', `## Lessons: ${ch.title}`, '');
    for (const id of ch.lessons) {
      const l = content.lessons.find((x) => x.id === id);
      if (l) lines.push(`- [${l.title}](${abs(`learn/${l.id}/`)}): ${l.summary}`);
    }
  }
  lines.push(
    '',
    '## Bets',
    '',
    `- [Every ${GAME} bet and its house edge](${abs('bets/')}): Payout and house edge of all bets, lowest edge first.`,
  );
  for (const p of pages.filter((x) => x.path.startsWith('bets/') && x.path !== 'bets/'))
    lines.push(`- [${p.h1}](${abs(p.path)}): ${p.description}`);
  lines.push(
    '',
    '## Reference',
    '',
    `- [${GAME} glossary](${abs('glossary/')}): ${content.glossary.length} craps terms in plain English.`,
    `- [Full text of every page](${abs('llms-full.txt')}): All lessons, bets and the glossary as markdown in one file.`,
    '',
    '## Optional',
    '',
    `- [Know the Odds](${ORIGIN}/): creynia's casino lab, the home of all four apps.`,
    ...OTHER_APPS.map((a) => `- [${a.app}](${ORIGIN}/${a.app}/): ${a.game}.`),
    '',
  );
  return lines.join('\n');
}

function llmsFull(content: ContentBundle, pages: StaticPage[]): string {
  const head = `# ${APP} — ${GAME}: full text\n\n> ${SUMMARY.replace('{n}', String(content.lessons.length))}\n\nSource: ${BASE} (each section below is one page; URL given under its heading).\n`;
  return (
    head +
    pages
      .map((p) => `\n---\n\n# ${p.h1}\n\nURL: ${abs(p.path)}\n\n${p.markdown.trim()}\n`)
      .join('') +
    `\n---\n\nFor education only, with play money only. The house always has an edge, and no betting system changes that. If gambling is hurting you or someone you know, call or text 1-800-GAMBLER (US), or contact your national problem-gambling helpline.\n`
  );
}

export function buildStaticSite(root: string): StaticSite {
  const content = buildContent(root);
  const raw = readSources(root);
  const sources = new Map(
    raw.lessonFiles.map((f) => [splitFrontMatter(f.source).data.id as string, f.source]),
  );
  const pages = [
    courseIndex(content),
    ...lessonPages(content, sources),
    ...betPages(content, raw),
    glossaryPage(content, raw),
  ];
  const files: Record<string, string> = {};
  for (const p of pages) files[`${p.path}index.html`] = p.html;
  files['sitemap.xml'] = sitemap(pages);
  files['llms.txt'] = llms(content, pages);
  files['llms-full.txt'] = llmsFull(content, pages);
  return { pages, files };
}

/** `<link rel="canonical">` and `<noscript>` for the SPA shell (normal build only: the
 * single-file build must not reference anything outside itself). */
export function spaHeadExtras(lessonCount: number): { head: string; body: string } {
  return {
    head: `<link rel="canonical" href="${BASE}" />`,
    body: `<noscript><div style="max-width:72ch;margin:0 auto;padding:16px;font:17px/1.6 system-ui,sans-serif;color:#eef4f0;background:#0d1f19"><h1>Learn ${GAME} free with ${APP}</h1><p>${APP} is a free craps course: ${lessonCount} short lessons from the dice basics to perfect strategy, plus a practice table that shows the expected value of every bet before you make it. Play money only. The interactive app needs JavaScript, but every lesson can be read without it.</p><p><a style="color:#7fe3b4" href="learn/">Read the craps course</a> · <a style="color:#7fe3b4" href="bets/">Every bet and its house edge</a> · <a style="color:#7fe3b4" href="glossary/">Craps glossary</a></p></div></noscript>`,
  };
}
