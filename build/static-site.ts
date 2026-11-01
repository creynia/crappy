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
import {
  betLabel,
  betPayout,
  betRows,
  edgeFact,
  formatEdge,
  sampleAmount,
  shortPayout,
} from '../src/app/bets';
import type { BetRow } from '../src/app/bets';
import { BET_TYPES, DEFAULT_RULES, formatPct, getBetType, pointsFor } from '../src/sim/engine';
import type { BetTypeId, Dice, PointNumber, TableRules } from '../src/sim/engine';
import {
  WAYS,
  add,
  betOutcomes,
  betEV,
  div,
  frac,
  mul,
  neg,
  pointWinProb,
  pTotal,
  sub,
  ONE,
  ZERO,
} from '../src/sim/math';
import type { BetCtx, Fraction } from '../src/sim/math';
import { ALL_DICE } from '../src/sim/math/dice';
import { HAND_ROLLS, betEdge } from '../src/sim/math/ev';
import { flatOddsLimits, oddsLimits, passMaxOddsEdge } from '../src/sim/ui/customRules';

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
export const STATIC_DIRS = [
  'learn',
  'bets',
  'glossary',
  'dice-probability',
  'best-and-worst-bets',
  'odds-bet-house-edge',
] as const;
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
nav.related{margin:2em 0 0;padding-top:.5em;border-top:1px solid var(--border)}
nav.related h2{margin-top:.6em}
nav.related ul{padding-left:1.2em}
nav.related li{margin:.3em 0}
caption{text-align:left;font-weight:600;padding:0 0 6px;color:var(--muted)}
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

/** Search-friendly <title>s for lessons that answer a common query (the h1 keeps the lesson title). */
export const LESSON_SEO_TITLES: Record<string, string> = {
  'come-out-and-point': 'How to Play Craps: Come-Out, Point and Seven-Out',
  'odds-bet': 'Craps Odds Bet Explained: The Bet With No House Edge',
  'dice-and-combinations': 'Craps Dice Combinations: Two Dice, 36 Outcomes',
};

function lessonTitle(t: string, id = ''): string {
  const seo = LESSON_SEO_TITLES[id];
  if (seo) return `${seo} | ${APP}`;
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
    const title = lessonTitle(l.title, l.id);
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
      `<p><a href="../">All ${lessons.length} craps lessons</a> · <a href="${root}glossary/">Glossary</a> · <a href="${root}bets/">Craps odds chart</a></p>`,
      relatedHtml(path, content),
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
  const h1 = `How to play ${GAME.toLowerCase()}: the free course`;
  const title = `How to Play ${GAME}: Free ${lessons.length}-Lesson Course | ${APP}`;
  const description = fitDescription(
    `How to play craps, free in ${lessons.length} short lessons: dice odds, the Pass Line, free Odds, every bet's house edge, bankroll and perfect strategy.`,
    ['Play money only.'],
  );
  const rules =
    'How to play craps in one paragraph: every round starts with a come-out roll. A 7 or 11 wins for the Pass Line and a 2, 3 or 12 loses; any other total becomes the point. The shooter then keeps rolling: the point again wins, a 7 first loses (the seven-out). Every other bet is a variation on that race against the 7.';
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
    `<p class="lead">${esc(rules)} <a href="come-out-and-point/">Lesson 3</a> walks through a full round.</p>`,
    `<p>${esc(intro)}</p>`,
    cta(
      '../#/learn',
      `Start the course in ${APP}: free, play money`,
      'Progress is saved on your device. Works offline once installed.',
    ),
    chapterHtml,
    `<h2>Quick reference</h2>`,
    `<ul><li><a href="../bets/">Craps odds chart: payout, true odds and house edge of every bet</a></li><li><a href="../best-and-worst-bets/">The best and worst bets in craps</a></li><li><a href="../odds-bet-house-edge/">The odds bet: house edge at 1x to 100x odds</a></li><li><a href="../dice-probability/">Craps dice probability: the odds of every total</a></li><li><a href="../glossary/">Craps glossary</a></li></ul>`,
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
    markdown: `${rules}\n\n${intro}\n\n${md}`,
  };
}

// ---------------------------------------------------------------------------------- bets

const BETS_INTRO =
  'House edge is the average share of each bet the casino keeps. Standard Vegas rules, shown at a typical bet size.';

function betPages(content: ContentBundle, raw: ContentSources): StaticPage[] {
  // Same default order as the app's Bets screen: lowest edge first.
  const sorted = sortedBetRows(content);
  const rows = sorted;
  const lessonTitleById = new Map(content.lessons.map((l) => [l.id, l.title]));

  const idxPath = 'bets/';
  const idxH1 = `${GAME} odds chart: payout, true odds and house edge of every bet`;
  const idxTitle = `${GAME} Odds Chart: Payouts & House Edge of Every Bet | ${APP}`;
  const priced = sorted.filter((r) => r.edge !== null);
  const groups = edgeGroups(priced.filter((r) => !isOddsBet(r.id) && r.tier !== 'free'));
  const top = priced[priced.length - 1];
  const idxDesc = fitDescription(
    `Craps odds chart for all ${rows.length} bets: what each pays, its true odds and house edge under standard Vegas rules, from the 0% Odds bet to ${top?.label ?? ''} at ${formatEdge(top?.edge ?? null)}.`,
    [],
  );
  const chances = new Map(sorted.map((r) => [r.id, betChances(r.id)]));
  const chartLead = `This craps odds chart lists all ${rows.length} bets, lowest house edge first. The Odds bets pay true odds and have ${formatEdge(priced[0]?.edge ?? null)} house edge; the best bets you can make on their own are ${andList(groups.slice(0, 2).map((x) => `${andList(x.labels)} (${x.edge})`))}; the costliest is ${top?.label ?? ''} at ${formatEdge(top?.edge ?? null)}.`;
  const chartHead = ['Bet', 'Pays', 'True odds', 'Chance to win', 'House edge', 'Verdict'];
  const chartRow = (r: BetRow, href: string) => {
    const c = chances.get(r.id);
    return [
      `<a href="${href}">${esc(r.label)}</a>`,
      esc(shortPayout(r.id, r.payout) ?? '--'),
      c?.trueOdds ?? '--',
      c ? pct(c.win, 2) : '--',
      formatEdge(r.edge),
      `<span class="badge tier-${r.tier}">${TIER_LABEL[r.tier]}</span>`,
    ];
  };
  const table = tableHtml(
    `${GAME} odds chart: all ${rows.length} bets under standard Vegas rules`,
    chartHead,
    sorted.map((r) => chartRow(r, `${esc(r.id)}/`)),
  );
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
        `<p class="lead">${esc(chartLead)}</p>`,
        `<p>${esc(BETS_INTRO)} True odds are the chances of losing against winning (pushes left out) and chance to win is per decision. Odds bets are shown on a point of 6, a hop on an easy hop. A dash means the bet has no single true-odds ratio (it pays in steps).</p>`,
        table,
        `<p>Ranked answers: <a href="../best-and-worst-bets/">the best and worst bets in craps</a> · <a href="../odds-bet-house-edge/">the odds bet at 1x to 100x</a> · <a href="../dice-probability/">dice probability</a></p>`,
        cta(
          '../#/bets',
          `Compare bets in ${APP}`,
          'Sort and filter every bet, then try any of them at the practice table.',
        ),
        `<p><a href="../learn/">The free craps course</a> · <a href="../glossary/">Glossary</a></p>`,
        relatedHtml(idxPath, content),
      ].join('\n'),
    }),
    markdown: `${chartLead}\n\n${BETS_INTRO}\n\n${mdTable(
      chartHead,
      sorted.map((r) => chartRow(r, abs(`bets/${r.id}/`)).map(plain)),
    )}`,
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
      `<p><a href="../">Craps odds chart: all ${rows.length} bets</a> · <a href="../../learn/">The free craps course</a></p>`,
      relatedHtml(path, content),
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
        `<p><a href="../learn/">The free craps course</a> · <a href="../bets/">Craps odds chart</a> · <a href="../dice-probability/">Dice probability</a></p>`,
      ].join('\n'),
    }),
    markdown: entries
      .map((g) => `**${g.term}** (${abs(path)}#${g.slug}): ${unGloss(raw.get(g.slug) ?? '')}`)
      .join('\n\n'),
  };
}

// ---------------------------------------------------------------------------------- math facts
// The question pages below take every number from the engine and math modules at build time.

const pct = (f: Fraction, digits = 2) => formatPct(f, digits);
const num = (f: Fraction) => Number(f.n) / Number(f.d);
const fracText = (f: Fraction) => (f.d === 1n ? String(f.n) : `${f.n}/${f.d}`);
const dollars = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
const ctxFor = (id: BetTypeId): BetCtx =>
  /odds/.test(id)
    ? { phase: 'point', point: 6, rules: DEFAULT_RULES }
    : { phase: 'come-out', point: null, rules: DEFAULT_RULES };
/** Hops are priced on an easy hop, like houseEdge in src/app/bets.ts. */
const EASY_HOP: Dice = [2, 4];

/** "5 to 1" from two probabilities (against : for), or null when the reduced ratio is unwieldy. */
export function oddsAgainst(lose: Fraction, win: Fraction): string | null {
  if (win.n === 0n) return null;
  const r = div(lose, win);
  if (r.n > 9999n || r.d > 9999n) return null;
  return `${r.n} to ${r.d}`;
}

export interface BetChances {
  win: Fraction;
  lose: Fraction;
  push: Fraction;
  /** chances of losing vs winning, pushes left out ("251 to 244"); null if not a short ratio */
  trueOdds: string | null;
  /** house edge spread over the rolls the bet takes to resolve */
  perRoll: number;
  expectedRolls: number;
}

/** Win/lose/push chances and edge per roll of one bet, in the situation houseEdge prices it. */
export function betChances(id: BetTypeId): BetChances | null {
  try {
    const ctx = ctxFor(id);
    const hop = id === 'hop' ? { hop: EASY_HOP } : {};
    let win = ZERO;
    let lose = ZERO;
    let push = ZERO;
    for (const o of betOutcomes({ type: id, amount: sampleAmount(id), point: null, ...hop }, ctx)) {
      if (o.net.n > 0n) win = add(win, o.probability);
      else if (o.net.n < 0n) lose = add(lose, o.probability);
      else push = add(push, o.probability);
    }
    const e = betEdge(id, sampleAmount(id), ctx, id === 'hop' ? EASY_HOP : undefined);
    return {
      win,
      lose,
      push,
      trueOdds: oddsAgainst(lose, win),
      perRoll: num(e.perRoll),
      expectedRolls: num(e.expectedRolls),
    };
  } catch {
    return null;
  }
}

/** Combined edge per dollar of a Don't Pass bet backed with full lay odds on every point. */
export function dontPassMaxOddsEdge(rules: TableRules, flat = 1000): Fraction {
  let ev = betEV(
    { type: 'dont-pass', amount: flat, point: null },
    { phase: 'come-out', point: null, rules },
  );
  let wagered = frac(flat);
  for (const p of pointsFor(rules)) {
    const lay = Math.floor(flat * rules.maxLayOdds[p]);
    const pr = frac(WAYS[p] ?? 0, 36);
    const oddsEv = betEV(
      { type: 'dont-pass-odds', amount: lay, point: p },
      { phase: 'point', point: p, rules },
    );
    ev = add(ev, mul(pr, oddsEv));
    wagered = add(wagered, mul(pr, frac(lay)));
  }
  return div(neg(ev), wagered);
}

export interface OddsRow {
  label: string;
  /** average odds bet per $1 of Pass, per decision: sum of P(point) x max multiple */
  oddsPerDollar: Fraction;
  pass: Fraction;
  dontPass: Fraction;
}

/** Pass + odds and Don't Pass + lay odds at the usual odds limits, standard rules otherwise. */
export function oddsRows(): OddsRow[] {
  const flat = 1000;
  const limits: [string, Pick<TableRules, 'maxOdds' | 'maxLayOdds'>][] = [
    ['No odds', flatOddsLimits(0)],
    ['1x', flatOddsLimits(1)],
    ['2x', flatOddsLimits(2)],
    ['3-4-5x', oddsLimits('3-4-5x')],
    ['5x', flatOddsLimits(5)],
    ['10x', flatOddsLimits(10)],
    ['20x', flatOddsLimits(20)],
    ['100x', flatOddsLimits(100)],
  ];
  return limits.map(([label, l]) => {
    const rules: TableRules = { ...DEFAULT_RULES, ...l };
    let per = ZERO;
    for (const p of pointsFor(rules))
      per = add(per, mul(frac(WAYS[p] ?? 0, 36), frac(rules.maxOdds[p])));
    return {
      label,
      oddsPerDollar: per,
      pass: passMaxOddsEdge(rules, flat),
      dontPass: dontPassMaxOddsEdge(rules, flat),
    };
  });
}

/** "A, B and C" */
const andList = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** Consecutive rows with the same displayed house edge, grouped. */
function edgeGroups(rows: BetRow[]): { edge: string; labels: string[] }[] {
  const out: { edge: string; labels: string[] }[] = [];
  for (const r of rows) {
    const e = formatEdge(r.edge);
    const last = out[out.length - 1];
    if (last && last.edge === e) last.labels.push(r.label);
    else out.push({ edge: e, labels: [r.label] });
  }
  return out;
}

const isOddsBet = (id: string) => /odds/.test(id);

/** All bets, lowest house edge first (the app's Bets screen default order). */
export function sortedBetRows(content: ContentBundle): BetRow[] {
  return [...betRows(content.bets)].sort((a, b) => (a.edge ?? 1) - (b.edge ?? 1));
}

const tableHtml = (caption: string, head: string[], rows: string[][], rowHeader = true) =>
  `<table><caption>${caption}</caption><thead><tr>${head
    .map((h) => `<th scope="col">${h}</th>`)
    .join('')}</tr></thead><tbody>${rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => (i === 0 && rowHeader ? `<th scope="row">${c}</th>` : `<td>${c}</td>`))
          .join('')}</tr>`,
    )
    .join('')}</tbody></table>`;

const mdTable = (head: string[], rows: string[][]) =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');

/** Strip tags for markdown cells. */
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

// ---------------------------------------------------------------------------------- related

export interface Link {
  path: string;
  text: string;
}

interface Topic {
  path: string;
  /** link text in Related blocks */
  text: string;
  lessons: string[];
  bets: (r: BetRow) => boolean;
}

const cat = (id: BetTypeId) => BET_TYPES[id].category;

export const TOPICS: Topic[] = [
  {
    path: 'bets/',
    text: 'Craps odds chart: payout, true odds and house edge of every bet',
    lessons: ['expected-value', 'place-bets', 'buy-and-lay', 'field-and-big-6-8'],
    bets: () => false,
  },
  {
    path: 'best-and-worst-bets/',
    text: 'The best and worst bets in craps, ranked',
    lessons: ['strategy-lowest-edge', 'sucker-bets', 'edge-per-roll', 'expected-value'],
    bets: (r) => r.tier === 'free' || r.tier === 'good' || r.tier === 'avoid',
  },
  {
    path: 'odds-bet-house-edge/',
    text: 'Craps odds bet: house edge at 1x to 100x odds',
    lessons: ['odds-bet', 'dont-side', 'come-bets', 'variance-and-bankroll'],
    bets: (r) => ['line', 'come', 'odds'].includes(cat(r.id)),
  },
  {
    path: 'dice-probability/',
    text: 'Craps dice probability: the odds of rolling every total',
    lessons: ['dice-and-combinations', 'come-out-and-point', 'myths-and-systems'],
    bets: (r) => ['hardway', 'prop'].includes(cat(r.id)),
  },
];

const betLinkText = (r: BetRow) =>
  `${/\bbet$/i.test(r.label) ? r.label : `${r.label} bet`}: payout and house edge`;

function collector(self: string, max = 5) {
  const out: Link[] = [];
  const push = (l: Link) => {
    if (out.length < max && l.path !== self && !out.some((o) => o.path === l.path)) out.push(l);
  };
  return { out, push };
}

/** 3-5 Related links for a static page, chosen deterministically from the content and bet data. */
export function relatedLinks(path: string, content: ContentBundle): Link[] {
  const rows = sortedBetRows(content);
  const lessonLink = (id: string): Link | null => {
    const l = content.lessons.find((x) => x.id === id);
    return l ? { path: `learn/${l.id}/`, text: l.title } : null;
  };
  const { out, push } = collector(path);
  const fill = () => {
    push({ path: 'learn/', text: `Learn ${GAME}: all ${content.lessons.length} lessons` });
    push({ path: 'bets/', text: TOPICS[0]!.text });
    push({ path: 'glossary/', text: `${GAME} glossary` });
  };
  const [section, id] = path.split('/');
  if (section === 'learn' && id) {
    for (const t of TOPICS.filter((x) => x.lessons.includes(id)).slice(0, 2)) push(t);
    for (const r of rows.filter((x) => content.bets[x.id]?.lessonId === id).slice(0, 2))
      push({ path: `bets/${r.id}/`, text: betLinkText(r) });
    const ch = content.chapters.find((c) => c.lessons.includes(id));
    for (const other of ch?.lessons ?? []) {
      const l = lessonLink(other);
      if (l) push(l);
    }
  } else if (section === 'bets' && id) {
    const me = rows.find((r) => r.id === id);
    const lid = content.bets[id as BetTypeId]?.lessonId;
    const l = lid ? lessonLink(lid) : null;
    if (l) push(l);
    if (me) {
      for (const t of TOPICS.filter((x) => x.path !== 'bets/' && x.bets(me)).slice(0, 2)) push(t);
      // nearest bets of the same kind, by house edge
      const i = rows.indexOf(me);
      const same = rows
        .map((r, j) => ({ r, d: Math.abs(j - i) }))
        .filter((x) => x.r !== me && cat(x.r.id) === cat(me.id))
        .sort((a, b) => a.d - b.d);
      for (const { r } of same) push({ path: `bets/${r.id}/`, text: betLinkText(r) });
    }
    push({ path: 'best-and-worst-bets/', text: TOPICS[1]!.text });
  } else {
    const t = TOPICS.find((x) => x.path === path);
    if (t) {
      for (const lid of t.lessons.slice(0, 3)) {
        const l = lessonLink(lid);
        if (l) push(l);
      }
      for (const o of TOPICS) push(o);
    }
  }
  if (out.length < 3) fill();
  return out;
}

function relatedHtml(path: string, content: ContentBundle): string {
  const root = up(path);
  const links = relatedLinks(path, content);
  return `<nav class="related" aria-labelledby="related-h"><h2 id="related-h">Related</h2><ul>${links
    .map((l) => `<li><a href="${root}${esc(l.path)}">${esc(l.text)}</a></li>`)
    .join('')}</ul></nav>`;
}

// ---------------------------------------------------------------------------------- question pages

interface TopicPage {
  path: string;
  title: string;
  description: string;
  h1: string;
  crumb: string;
  body: string;
  markdown: string;
}

function topicPage(t: TopicPage, content: ContentBundle): StaticPage {
  const ld = {
    '@type': ['Article', 'LearningResource'],
    '@id': abs(t.path) + '#article',
    url: abs(t.path),
    headline: t.h1,
    name: t.h1,
    description: t.description,
    inLanguage: 'en',
    educationalLevel: 'Beginner',
    learningResourceType: 'Reference',
    isAccessibleForFree: true,
    author: PERSON,
    publisher: PERSON,
    image: OG_IMAGE,
    isPartOf: { '@id': WEBSITE_ID },
  };
  return {
    path: t.path,
    title: t.title,
    description: t.description,
    h1: t.h1,
    html: page({
      path: t.path,
      title: t.title,
      description: t.description,
      ogType: 'article',
      trail: [{ name: t.crumb, path: t.path }],
      ld: [ld],
      body: `<article>\n<h1>${esc(t.h1)}</h1>\n${t.body}\n</article>\n${relatedHtml(t.path, content)}`,
    }),
    markdown: t.markdown,
  };
}

function dicePage(content: ContentBundle): StaticPage {
  const path = 'dice-probability/';
  const totals = WAYS.map((w, t) => ({ t, w })).filter((x) => x.w > 0);
  const most = totals.reduce((a, b) => (b.w > a.w ? b : a));
  const minW = Math.min(...totals.map((x) => x.w));
  const least = totals.filter((x) => x.w === minW);
  const pMost = pTotal(most.t);
  const pLeast = pTotal(least[0]!.t);
  const against = (p: Fraction) => oddsAgainst(sub(ONE, p), p) ?? '--';
  const lead = `With two dice there are ${ALL_DICE.length} equally likely combinations. The most likely total is ${most.t}: ${most.w} of the ${ALL_DICE.length} combinations, a probability of ${fracText(pMost)} (${pct(pMost)}), or odds of ${against(pMost)} against. The least likely totals are ${andList(least.map((x) => String(x.t)))}, with ${minW} combination each (${fracText(pLeast)}, ${pct(pLeast)}, ${against(pLeast)} against).`;

  const combos = (t: number) =>
    ALL_DICE.filter(([a, b]) => a + b === t)
      .map(([a, b]) => `${a}-${b}`)
      .join(', ');
  const totalHead = [
    'Total',
    'Combinations',
    'Ways (of 36)',
    'Probability',
    'Percent',
    'Odds against',
  ];
  const totalRows = totals.map((x) => {
    const p = pTotal(x.t);
    return [String(x.t), combos(x.t), String(x.w), fracText(p), pct(p), against(p)];
  });
  const faces = [...new Set(ALL_DICE.map(([a]) => a))];
  const gridHead = ['First die', ...faces.map((f) => `Second die ${f}`)];
  const gridRows = faces.map((a) => [String(a), ...faces.map((b) => String(a + b))]);

  const p7 = pTotal(7);
  const notSeven = sub(ONE, p7);
  const sevenRows = [1, 2, 3, 4, 5, 6, 10, 20].map((n) => {
    let miss = ONE;
    for (let i = 0; i < n; i++) miss = mul(miss, notSeven);
    return [String(n), pct(sub(ONE, miss), 1)];
  });
  const handRolls = num(HAND_ROLLS).toFixed(2);
  const sevenText = `A 7 has ${WAYS[7]} ways in ${ALL_DICE.length}, so it comes up ${fracText(p7)} of the time (${pct(p7)}), or ${against(p7)} against on any one roll. A shooter's hand, from the first come-out to the seven-out, lasts ${handRolls} rolls on average.`;

  const points = pointsFor(DEFAULT_RULES);
  const pointHead = [
    'Point',
    'Ways vs 7',
    'Chance to roll it before a 7',
    'True odds',
    'Odds bet pays',
  ];
  const pointRows = points.map((p) => {
    const w = pointWinProb(p as PointNumber);
    return [
      String(p),
      `${WAYS[p]} vs ${WAYS[7]}`,
      `${fracText(w)} (${pct(w)})`,
      against(w),
      getBetType('pass-odds').describePayout(DEFAULT_RULES, p as PointNumber),
    ];
  });
  const hardIds = (['hard-4', 'hard-6', 'hard-8', 'hard-10'] as BetTypeId[]).filter(
    (id) => id in BET_TYPES,
  );
  const hardHead = ['Bet', 'Chance to win', 'True odds', 'Pays', 'House edge'];
  const hardRows = hardIds.map((id) => {
    const c = betChances(id);
    return [
      `<a href="../bets/${id}/">${esc(betLabel(id))}</a>`,
      c ? `${fracText(c.win)} (${pct(c.win)})` : '--',
      c?.trueOdds ?? '--',
      esc(betPayout(id) ?? '--'),
      esc(edgeFact(id)),
    ];
  });

  const h1 = 'Craps dice probability: the odds of rolling every total';
  const body = [
    `<p class="lead">${esc(lead)}</p>`,
    `<p>Nearly every craps bet is a race between some number and the 7, so these few tables explain the whole game. Every figure on this page is computed from the 36 combinations by the same math module the ${APP} app uses.</p>`,
    `<h2>What are the odds of rolling each total with two dice?</h2>`,
    tableHtml('Probability of each total with two dice', totalHead, totalRows),
    `<h2>What are all 36 dice combinations?</h2>`,
    `<p>Each cell is the total of one combination. Count a total's cells to get its ways.</p>`,
    tableHtml('All 36 combinations of two dice and their totals', gridHead, gridRows),
    `<h2>What are the odds of rolling a 7?</h2>`,
    `<p>${esc(sevenText)}</p>`,
    tableHtml(
      'Chance of at least one 7 within a number of rolls',
      ['Rolls', 'Chance of at least one 7'],
      sevenRows,
    ),
    `<h2>What are the odds of making the point before a 7?</h2>`,
    `<p>Once a point is set, only the point and the 7 matter. The Odds bet pays exactly these true odds, which is why it has no house edge (<a href="../odds-bet-house-edge/">see the odds bet at 1x to 100x</a>).</p>`,
    tableHtml('Chance of rolling each point before a 7', pointHead, pointRows),
    `<h2>What are the odds of rolling a hard way?</h2>`,
    `<p>A hardway wins on the pair and loses on the easy way or a 7. It pays less than its true odds, and the difference is the house edge.</p>`,
    tableHtml('Hardway bets: chance, true odds and payout', hardHead, hardRows),
    cta(
      '../#/learn/dice-and-combinations',
      `Roll the dice in ${APP}: free, play money`,
      'Roll hundreds of times in the app and watch the totals settle into this shape.',
    ),
  ].join('\n');
  const markdown = [
    lead,
    '## What are the odds of rolling each total with two dice?',
    mdTable(totalHead, totalRows),
    '## What are the odds of rolling a 7?',
    sevenText,
    mdTable(['Rolls', 'Chance of at least one 7'], sevenRows),
    '## What are the odds of making the point before a 7?',
    mdTable(pointHead, pointRows),
    '## What are the odds of rolling a hard way?',
    mdTable(
      hardHead,
      hardRows.map((r) => r.map(plain)),
    ),
  ].join('\n\n');
  return topicPage(
    {
      path,
      title: `Craps Dice Probability: Odds of Rolling Each Total | ${APP}`,
      description: fitDescription(
        `Craps dice odds: all ${ALL_DICE.length} combinations of two dice, the probability of every total, the odds of rolling a 7, making each point and hitting a hardway.`,
        [],
      ),
      h1,
      crumb: 'Dice probability',
      body,
      markdown,
    },
    content,
  );
}

function bestWorstPage(content: ContentBundle): StaticPage {
  const path = 'best-and-worst-bets/';
  const rows = sortedBetRows(content).filter((r) => r.edge !== null);
  const free = rows.filter((r) => r.tier === 'free');
  const standalone = edgeGroups(rows.filter((r) => !isOddsBet(r.id) && r.tier !== 'free'));
  // highest edge first; ties keep the chart's order
  const desc = [...rows].sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  const worst = edgeGroups(desc);
  const g = (x: { edge: string; labels: string[] }) => `${andList(x.labels)} (${x.edge})`;
  const best2 = standalone.slice(0, 2);
  const worst2 = worst.slice(0, 2);
  const lead = `The best bets in craps are the ${andList(free.map((r) => r.label))} bets: they pay true odds, so their house edge is ${formatEdge(free[0]?.edge ?? 0)}, but you can only make them behind a line or Come bet. The best bets you can make on their own are ${andList(best2.map(g))}. The worst are ${andList(worst2.map(g))}.`;
  const chances = new Map(rows.map((r) => [r.id, betChances(r.id)]));
  const head = ['Bet', 'Pays', 'House edge', 'Edge per roll', 'Verdict'];
  const row = (r: BetRow) => [
    `<a href="../bets/${esc(r.id)}/">${esc(r.label)}</a>`,
    esc(shortPayout(r.id, r.payout) ?? '--'),
    formatEdge(r.edge),
    formatEdge(chances.get(r.id)?.perRoll ?? null),
    `<span class="badge tier-${r.tier}">${TIER_LABEL[r.tier]}</span>`,
  ];
  const best = rows.filter((r) => r.tier === 'free' || r.tier === 'good');
  const avoid = desc.filter((r) => r.tier === 'avoid');
  const middle = rows.length - best.length - avoid.length;
  const pass = rows.find((r) => r.id === 'pass-line');
  const any7 = rows.find((r) => r.id === 'any-7');
  const passC = chances.get('pass-line');
  const perRollText =
    pass && any7 && passC
      ? `A Pass Line bet takes ${passC.expectedRolls.toFixed(2)} rolls on average to win or lose, so its ${formatEdge(pass.edge)} edge works out to ${formatEdge(passC.perRoll)} a roll. A one-roll bet such as ${any7.label} pays its full ${formatEdge(any7.edge)} on every roll.`
      : '';
  const h1 = 'The best and worst bets in craps, ranked by house edge';
  const body = [
    `<p class="lead">${esc(lead)}</p>`,
    `<p>House edge is the share of each bet the casino keeps on average, under standard Vegas rules (3-4-5x odds, 5% commission on Buy and Lay wins). No bet here has a positive expectation for the player: the best you can do is lose slowly.</p>`,
    `<h2>Which craps bets have the lowest house edge?</h2>`,
    tableHtml(
      `The ${best.length} best craps bets (${TIER_LABEL.free} and ${TIER_LABEL.good})`,
      head,
      best.map(row),
    ),
    `<h2>Which craps bets should you avoid?</h2>`,
    `<p>These ${avoid.length} bets keep 9% or more of every dollar, highest edge first. Most of them sit in the middle of the table.</p>`,
    tableHtml(`The ${avoid.length} worst craps bets (${TIER_LABEL.avoid})`, head, avoid.map(row)),
    `<p>The other ${middle} bets sit in between; the <a href="../bets/">craps odds chart</a> lists all ${rows.length}.</p>`,
    `<h2>Should you compare bets per bet or per roll?</h2>`,
    `<p>Edge per bet is the cost of one decision; edge per roll is the cost of time at the table. ${esc(perRollText)} That is why a cheap-looking one-roll bet can cost far more per hour.</p>`,
    cta(
      '../#/bets',
      `Compare every bet in ${APP}`,
      'Sort and filter the bets, then try any of them at the practice table with play money.',
    ),
  ].join('\n');
  const markdown = [
    lead,
    '## Which craps bets have the lowest house edge?',
    mdTable(
      head,
      best.map((r) => row(r).map(plain)),
    ),
    '## Which craps bets should you avoid?',
    mdTable(
      head,
      avoid.map((r) => row(r).map(plain)),
    ),
    '## Should you compare bets per bet or per roll?',
    perRollText,
  ].join('\n\n');
  return topicPage(
    {
      path,
      title: `Best and Worst Bets in Craps, Ranked by House Edge | ${APP}`,
      description: fitDescription(
        `The best bets in craps are the 0% Odds bets, then ${andList(best2.map((x) => x.labels[0] ?? ''))}. The worst: ${worst2[0]?.labels[0] ?? ''} at ${worst2[0]?.edge ?? ''}.`,
        ['Ranked from the math.', ''],
      ),
      h1,
      crumb: 'Best and worst bets',
      body,
      markdown,
    },
    content,
  );
}

function oddsPage(content: ContentBundle): StaticPage {
  const path = 'odds-bet-house-edge/';
  const rows = oddsRows();
  const by = (l: string) => rows.find((r) => r.label === l)!;
  const none = by('No odds');
  const r345 = by('3-4-5x');
  const pays = getBetType('pass-odds')
    .describePayout(DEFAULT_RULES, null)
    .replace(/(\d+)\/(\d+)/g, '$1 and $2');
  const points = pointsFor(DEFAULT_RULES) as PointNumber[];
  const oddsEvs = points.map((p) =>
    betEV(
      { type: 'pass-odds', amount: 1000, point: p },
      { phase: 'point', point: p, rules: DEFAULT_RULES },
    ),
  );
  const oddsEdge = oddsEvs.every((e) => e.n === 0n) ? '0%' : '--';
  const lead = `The Odds bet itself has a house edge of ${oddsEdge}: it pays the true odds of the point (${pays}). Backing a Pass Line bet with full 3-4-5x odds lowers the house edge on all the money you bet from ${pct(none.pass)} to ${pct(r345.pass)}; at 10x odds it is ${pct(by('10x').pass)} and at 100x ${pct(by('100x').pass)}. Don't Pass with full lay odds drops from ${pct(none.dontPass)} to ${pct(r345.dontPass)} at a 3-4-5x table.`;
  const flat = 1000;
  const head = [
    'Odds taken',
    'Average odds bet per $10 Pass',
    'Pass + odds',
    "Don't Pass + lay odds",
  ];
  const tRows = rows.map((r) => [
    r.label,
    r.label === 'No odds' ? '$0' : dollars(num(r.oddsPerDollar) * flat),
    pct(r.pass, 3),
    pct(r.dontPass, 3),
  ]);
  const maxHead = [
    'Point',
    'Max odds on a $10 Pass',
    'Odds pays',
    'Odds win',
    'Chance to make the point',
  ];
  const wins = new Set<number>();
  const maxRows = points.map((p) => {
    const m = DEFAULT_RULES.maxOdds[p] * flat;
    const w = pointWinProb(p);
    const win = num(mul(frac(m), div(sub(ONE, w), w)));
    wins.add(Math.round(win / flat));
    return [
      String(p),
      `${dollars(m)} (${DEFAULT_RULES.maxOdds[p]}x)`,
      getBetType('pass-odds').describePayout(DEFAULT_RULES, p),
      dollars(win),
      pct(w),
    ];
  });
  const sameWin = wins.size === 1 ? [...wins][0] : null;
  const passEv = neg(
    betEV(
      { type: 'pass-line', amount: flat, point: null },
      { phase: 'come-out', point: null, rules: DEFAULT_RULES },
    ),
  );
  const lossText = `No. Your expected loss is still ${dollars(num(passEv))} per $10 Pass decision (${pct(none.pass)} of the flat bet), however much odds you take, because the odds bet itself costs nothing. Odds lower the edge per dollar bet, not the dollars you expect to lose, and they make your swings much bigger. That is why the lowest-edge way to play is a small flat bet with as much odds as your bankroll is comfortable with.`;
  const h1 = 'Craps odds bet explained: the house edge at 1x to 100x odds';
  const body = [
    `<p class="lead">${esc(lead)}</p>`,
    `<p>Once a point is set you may add an Odds bet behind your Pass or Come bet (or lay odds behind Don't Pass or Don't Come). It wins and loses with the flat bet, but at true odds. Every figure below is computed exactly by the ${APP} math module, for a $10 flat bet with the full odds on every point.</p>`,
    `<h2>What is the house edge with 1x, 2x, 3-4-5x, 5x, 10x, 20x or 100x odds?</h2>`,
    tableHtml('Combined house edge of a line bet backed with full odds', head, tRows),
    `<p class="muted">Don't Pass lay limits: 6x at a 3-4-5x table; at a flat Nx table, enough to win N times the flat bet.</p>`,
    `<h2>What does 3-4-5x odds mean?</h2>`,
    `<p>At a 3-4-5x table you may take 3 times your flat bet in odds on 4 and 10, 4 times on 5 and 9 and 5 times on 6 and 8.${sameWin ? ` The limits are set so a winning odds bet pays ${sameWin} times the flat bet on every point.` : ''}</p>`,
    tableHtml('3-4-5x odds on a $10 Pass Line bet', maxHead, maxRows),
    `<h2>Does taking odds lower your expected loss?</h2>`,
    `<p>${esc(lossText)}</p>`,
    cta(
      '../#/learn/odds-bet',
      `Take odds at the table in ${APP}: free, play money`,
      'The app shows the edge of every bet before you place it, odds included.',
    ),
  ].join('\n');
  const markdown = [
    lead,
    '## What is the house edge with 1x, 2x, 3-4-5x, 5x, 10x, 20x or 100x odds?',
    mdTable(head, tRows),
    '## What does 3-4-5x odds mean?',
    mdTable(maxHead, maxRows),
    '## Does taking odds lower your expected loss?',
    lossText,
  ].join('\n\n');
  return topicPage(
    {
      path,
      title: `Craps Odds Bet: House Edge at 1x to 100x Odds | ${APP}`,
      description: fitDescription(
        `The craps Odds bet has ${oddsEdge} house edge. Pass + 3-4-5x odds: ${pct(r345.pass)} on all money bet; 10x: ${pct(by('10x').pass)}; 100x: ${pct(by('100x').pass)}. Exact table for 1x to 100x.`,
        [],
      ),
      h1,
      crumb: 'Odds bet house edge',
      body,
      markdown,
    },
    content,
  );
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
    `- [${GAME} odds chart](${abs('bets/')}): Payout, true odds, chance to win and house edge of all bets, lowest edge first.`,
  );
  for (const p of pages.filter((x) => x.path.startsWith('bets/') && x.path !== 'bets/'))
    lines.push(`- [${p.h1}](${abs(p.path)}): ${p.description}`);
  lines.push('', '## Odds and probability', '');
  for (const t of TOPICS.filter((x) => x.path !== 'bets/')) {
    const p = find(t.path);
    if (p) lines.push(`- [${p.h1}](${abs(p.path)}): ${p.description}`);
  }
  lines.push(
    '',
    '## Reference',
    '',
    `- [${GAME} glossary](${abs('glossary/')}): ${content.glossary.length} craps terms in plain English.`,
    `- [Full text of every page](${abs('llms-full.txt')}): All lessons, bets, the odds and probability pages and the glossary as markdown in one file.`,
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
    bestWorstPage(content),
    oddsPage(content),
    dicePage(content),
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
