// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE, buildStaticSite, isStaticSiteFile, rewriteLinks } from '../../build/static-site';
import { buildContent } from '../../src/content/load';

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
    // One cookieless GoatCounter pixel for the page's own path.
    expect(count(html, /creynia\.goatcounter\.com\/count/g)).toBe(1);
    expect(html).toContain(
      `count?p=${encodeURIComponent(`/crappy/${file.replace(/index\.html$/, '')}`)}"`,
    );
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
    for (const f of ['learn/index.html', 'bets/field/index.html', 'glossary/index.html'])
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
