// Submits every URL in a sitemap to IndexNow (Bing, Yandex, Seznam, ...), after a deploy.
// Usage: node scripts/indexnow.mjs [path/to/sitemap.xml] [--dry-run]
// Dependency-free on purpose: run from the Pages workflow with only Node available.
import { readFileSync } from 'node:fs';

const HOST = 'creynia.com';
const KEY = 'a02c23620b24433ba3470d53547479ec';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--')) ?? 'dist/sitemap.xml';

const xml = readFileSync(file, 'utf8');
const urlList = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)]
  .map((m) => m[1].replace(/&amp;/g, '&'))
  .filter((u) => new URL(u).host === HOST);
if (urlList.length === 0) {
  console.error(`indexnow: no ${HOST} URLs in ${file}`);
  process.exit(1);
}

const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };
if (dryRun) {
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});
console.log(`indexnow: submitted ${urlList.length} URLs, HTTP ${res.status} ${res.statusText}`);
if (!res.ok) {
  console.log(await res.text());
  process.exit(1);
}
