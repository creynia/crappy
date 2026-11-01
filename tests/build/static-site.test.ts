// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BASE,
  STATIC_DIRS,
  TOPICS,
  betChances,
  buildStaticSite,
  dontPassMaxOddsEdge,
  isStaticSiteFile,
  oddsRows,
  relatedLinks,
  rewriteLinks,
} from '../../build/static-site';
import { betRows, edgeFact, formatEdge } from '../../src/app/bets';
import { buildContent } from '../../src/content/load';
import { DEFAULT_RULES, formatPct } from '../../src/sim/engine';
import { pTotal } from '../../src/sim/math';
import { passMaxOddsEdge } from '../../src/sim/ui/customRules';

const root = process.cwd();
const site = buildStaticSite(root);
const content = buildContent(root);
const htmlFiles = Object.entries(site.files).filter(([f]) => f.endsWith('.html'));

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const attr = (html: string, re: RegExp) => re.exec(html)?.[1] ?? '';
const sitemapUrls = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

describe('static SEO pages', () => {
  it('has a page for every shipped lesson, every bet, the indexes and the glossary', () => {
    for (const l of content.lessons) expect(site.files[`learn/${l.id}/index.html`]).toBeDefined();
    for (const id of Object.keys(content.bets))
      expect(site.files[`bets/${id}/index.html`]).toBeDefined();
    for (const p of ['learn/', 'bets/', 'glossary/'])
      expect(site.files[`${p}index.html`]).toBeDefined();
    expect(Object.keys(site.files).some((f) => f.includes('sample'))).toBe(false);
  });

  it.each(htmlFiles)('%s has one h1, a title, a description and a canonical', (file, html) => {
    expect(count(html, /<h1[\s>]/g)).toBe(1);
    expect(count(html, /<title>[^<]+<\/title>/g)).toBe(1);
    expect(attr(html, /<title>([^<]+)<\/title>/).length).toBeLessThanOrEqual(70);
    const desc = attr(html, /<meta name="description" content="([^"]*)"/)
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    expect(desc.length).toBeGreaterThanOrEqual(60);
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(count(html, /<link rel="canonical"/g)).toBe(1);
    expect(attr(html, /<link rel="canonical" href="([^"]+)"/)).toBe(
      BASE + file.replace(/index\.html$/, ''),
    );
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(
      'property="og:image" content="https://creynia.com/assets/og/crappy.jpg"',
    );
    expect(html).toContain('1-800-GAMBLER');
    // JS-free and fully rendered: no scripts besides JSON-LD, no leftover lesson syntax.
    expect(count(html, /<script/g)).toBe(1);
    expect(html).not.toMatch(/:::|```|\[\[|href="#\//);
    expect(html).not.toContain('creynia.github.io');
    const ld = JSON.parse(attr(html, /<script type="application\/ld\+json">(.*?)<\/script>/s)) as {
      '@graph': { '@type': string | string[] }[];
    };
    expect(ld['@graph'].some((n) => n['@type'] === 'BreadcrumbList')).toBe(true);
  });

  it('links lesson pages into the app with relative hash links', () => {
    const html = site.files['learn/pass-line/index.html'] ?? '';
    expect(html).toContain('href="../../#/learn/pass-line"');
  });

  it('sitemap lists exactly the SPA root and the emitted pages', () => {
    const pages = htmlFiles.map(([f]) => BASE + f.replace(/index\.html$/, '')).sort();
    expect(sitemapUrls(site.files['sitemap.xml'] ?? '').sort()).toEqual([BASE, ...pages].sort());
  });

  it('llms.txt follows the llmstxt.org shape and links every lesson', () => {
    const txt = site.files['llms.txt'] ?? '';
    expect(txt.startsWith('# crappy — Craps\n\n> ')).toBe(true);
    for (const l of content.lessons) expect(txt).toContain(`${BASE}learn/${l.id}/`);
    const full = site.files['llms-full.txt'] ?? '';
    for (const l of content.lessons) expect(full).toContain(`# ${l.title}`);
    expect(full).not.toMatch(/:::|```(scene|quiz)|\[\[/);
  });

  it('rewrites app hash links for static pages', () => {
    const p = 'learn/x/';
    expect(rewriteLinks('<a href="#/glossary?term=puck">', p)).toBe(
      '<a href="../../glossary/#puck">',
    );
    expect(rewriteLinks('<a href="#/learn/odds-bet">', p)).toBe('<a href="../../learn/odds-bet/">');
    expect(rewriteLinks('<a href="#/bets/field">', p)).toBe('<a href="../../bets/field/">');
    expect(rewriteLinks('<a href="#/play?preset=field">', p)).toBe(
      '<a href="../../#/play?preset=field">',
    );
  });

  it('classifies static files for the service worker', () => {
    for (const f of [
      'learn/index.html',
      'bets/field/index.html',
      'glossary/index.html',
      'dice-probability/index.html',
    ])
      expect(isStaticSiteFile(f)).toBe(true);
    for (const f of ['sitemap.xml', 'llms.txt', './llms-full.txt'])
      expect(isStaticSiteFile(f)).toBe(true);
    for (const f of ['index.html', 'assets/index-abc.js', 'icon.svg', 'learning.txt'])
      expect(isStaticSiteFile(f)).toBe(false);
  });

  it('the SPA shell head states the real lesson count', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(html).toContain(`${content.lessons.length} short lessons`);
    expect(html).toContain('"@type": "WebApplication"');
  });
});

const QUESTION_PAGES = ['best-and-worst-bets/', 'odds-bet-house-edge/', 'dice-probability/'];
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
const pageText = (path: string) => text(site.files[`${path}index.html`] ?? '');

describe('question pages (wave 2)', () => {
  it('are emitted, in the sitemap, in llms.txt and served from the network by the SW', () => {
    const map = site.files['sitemap.xml'] ?? '';
    const llms = site.files['llms.txt'] ?? '';
    for (const p of QUESTION_PAGES) {
      expect(site.files[`${p}index.html`]).toBeDefined();
      expect(map).toContain(`<loc>${BASE}${p}</loc>`);
      expect(llms).toMatch(new RegExp(`\\(${BASE}${p}\\): .{40,}`));
      expect(site.files['llms-full.txt']).toContain(`URL: ${BASE}${p}`);
      expect(STATIC_DIRS).toContain(p.slice(0, -1));
      expect(isStaticSiteFile(`${p}index.html`)).toBe(true);
    }
  });

  it('are linked from the course index and the odds chart', () => {
    for (const from of ['learn/', 'bets/'])
      for (const p of QUESTION_PAGES)
        expect(site.files[`${from}index.html`]).toContain(`href="../${p}"`);
  });

  it('use real tables with captions and scoped headers', () => {
    for (const p of [...QUESTION_PAGES, 'bets/']) {
      const html = site.files[`${p}index.html`] ?? '';
      const tables = html.match(/<table>[\s\S]*?<\/table>/g) ?? [];
      expect(tables.length).toBeGreaterThan(0);
      for (const t of tables) {
        expect(t).toMatch(/^<table><caption>[^<]+<\/caption>/);
        expect(t).not.toMatch(/<th(?! scope="(col|row)")[ >]/);
      }
      expect(html).not.toContain('FAQPage');
    }
  });

  it('odds chart shows each bet with its engine house edge and true odds', () => {
    const t = pageText('bets/');
    expect(t).toContain('Craps odds chart');
    for (const r of betRows(content.bets)) expect(t).toContain(`${r.label} `);
    expect(t).toContain('Pass Line 1 to 1 251 to 244 49.29% 1.41%');
    expect(t).toContain("Don't Pass 1 to 1 976 to 949 47.93% 1.36%");
    expect(t).toContain('Any Seven 4 to 1 5 to 1 16.67% 16.67%');
    expect(betChances('place-6')?.trueOdds).toBe('6 to 5');
  });

  it('odds bet page pins the combined edges to the math module', () => {
    const rows = oddsRows();
    const by = (l: string) => rows.find((r) => r.label === l)!;
    expect(formatPct(by('No odds').pass, 3)).toBe('1.414%');
    expect(formatPct(by('3-4-5x').pass, 3)).toBe('0.374%');
    expect(formatPct(by('3-4-5x').dontPass, 3)).toBe('0.273%');
    expect(formatPct(by('10x').pass, 3)).toBe('0.184%');
    expect(formatPct(by('100x').pass, 3)).toBe('0.021%');
    expect(by('3-4-5x').pass).toEqual(passMaxOddsEdge(DEFAULT_RULES));
    expect(by('3-4-5x').dontPass).toEqual(dontPassMaxOddsEdge(DEFAULT_RULES));
    const t = pageText('odds-bet-house-edge/');
    expect(t).toMatch(/^.*Craps odds bet explained.*The Odds bet itself has a house edge of 0%/);
    for (const r of rows) expect(t).toContain(`${r.label} `);
    expect(t).toContain('from 1.41% to 0.37%');
    expect(t).toContain('$0.14 per $10 Pass decision');
  });

  it('dice page answers with the math module figures first', () => {
    const t = pageText('dice-probability/');
    const p7 = formatPct(pTotal(7), 2);
    expect(p7).toBe('16.67%');
    expect(t).toContain(
      `The most likely total is 7: 6 of the 36 combinations, a probability of 1/6 (${p7}), or odds of 5 to 1 against.`,
    );
    expect(t).toContain('6 1-5, 2-4, 3-3, 4-2, 5-1 5 5/36 13.89% 31 to 5');
    expect(t).toContain(`Hard 4 1/9 (11.11%) 8 to 1 7 to 1 ${edgeFact('hard-4')}`);
  });

  it('best/worst page ranks from the bet data', () => {
    const rows = [...betRows(content.bets)].sort((a, b) => (a.edge ?? 1) - (b.edge ?? 1));
    const worst = rows[rows.length - 1]!;
    const t = pageText('best-and-worst-bets/');
    expect(t).toContain('The best bets in craps are the Pass Odds');
    expect(t).toContain(`The worst are ${worst.label} (${formatEdge(worst.edge)})`);
    for (const r of rows.filter((x) => x.tier === 'avoid')) expect(t).toContain(`${r.label} `);
  });
});

describe('Related blocks', () => {
  const pages = site.pages.filter((p) => !['learn/', 'glossary/'].includes(p.path));
  it.each(pages.map((p) => [p.path, p] as const))(
    '%s has 3-5 related links to real pages',
    (path, p) => {
      const nav = /<nav class="related"[^>]*>([\s\S]*?)<\/nav>/.exec(p.html)?.[1] ?? '';
      const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? '');
      expect(hrefs.length).toBeGreaterThanOrEqual(3);
      expect(hrefs.length).toBeLessThanOrEqual(5);
      expect(new Set(hrefs).size).toBe(hrefs.length);
      const root = '../'.repeat(path.split('/').filter(Boolean).length);
      for (const h of hrefs) {
        expect(h.startsWith(root)).toBe(true);
        const target = h.slice(root.length);
        expect(target).not.toBe(path);
        expect(site.files[`${target}index.html`]).toBeDefined();
      }
    },
  );

  it('is deterministic and uses the data', () => {
    expect(relatedLinks('learn/odds-bet/', content)).toEqual(
      relatedLinks('learn/odds-bet/', content),
    );
    expect(relatedLinks('learn/odds-bet/', content).map((l) => l.path)).toContain(
      'odds-bet-house-edge/',
    );
    expect(relatedLinks('bets/pass-line/', content)[0]?.path).toBe('learn/pass-line/');
    expect(relatedLinks('bets/hard-6/', content).map((l) => l.path)).toContain('dice-probability/');
    for (const t of TOPICS) expect(relatedLinks(t.path, content).length).toBeGreaterThanOrEqual(3);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Runs against a real build when one exists (CI runs build:all before tests).
describe.skipIf(!existsSync('dist/sw.js'))('dist (normal build)', () => {
  const files = existsSync('dist') ? walk('dist').map((f) => relative('dist', f)) : [];
  const read = (f: string) => readFileSync(join('dist', f), 'utf8');

  it('service worker precaches none of the static pages or SEO files', () => {
    const precache = JSON.parse(
      /const urls = (\[[^\]]*\])/.exec(read('sw.js'))?.[1] ?? '[]',
    ) as string[];
    expect(precache).toContain('./index.html');
    expect(precache.filter((u) => isStaticSiteFile(u))).toEqual([]);
    // and only the shell URL may fall back to the cached shell when offline
    expect(read('sw.js')).toMatch(/req\.mode === 'navigate' && isShellPath\(url\.pathname\)/);
  });

  it('sitemap URLs equal the emitted pages', () => {
    const pages = files
      .filter((f) => isStaticSiteFile(f) && f.endsWith('index.html'))
      .map((f) => BASE + f.replace(/index\.html$/, ''));
    expect(sitemapUrls(read('sitemap.xml')).sort()).toEqual([BASE, ...pages].sort());
  });

  it('SPA shell has a canonical link and a noscript block with static links', () => {
    const html = read('index.html');
    expect(html).toContain(`<link rel="canonical" href="${BASE}"`);
    expect(html).toMatch(/<noscript>[\s\S]*href="learn\/"[\s\S]*<\/noscript>/);
  });
});
