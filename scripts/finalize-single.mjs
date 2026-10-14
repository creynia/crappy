// Renames dist-single/index.html -> dist-single/crappy.html and fails the build if the
// result references anything external (src=/href= other than data:, #fragment, or an
// absolute https:// link, which is only allowed as a plain anchor in lesson prose).
import { existsSync, readFileSync, renameSync } from 'node:fs';

const dir = 'dist-single';
if (existsSync(`${dir}/index.html`)) renameSync(`${dir}/index.html`, `${dir}/crappy.html`);
if (!existsSync(`${dir}/crappy.html`)) {
  console.error('finalize-single: dist-single/crappy.html missing');
  process.exit(1);
}

const html = readFileSync(`${dir}/crappy.html`, 'utf8');
const bad = [];
// Literal attributes in the HTML shell only (inline script/style bodies are skipped).
const shell = html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => m.slice(0, m.indexOf('>') + 1))
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
for (const m of shell.matchAll(/<([a-z0-9]+)\b[^>]*?\s(src|href)\s*=\s*("([^"]*)"|'([^']*)')/gi)) {
  const tag = m[1].toLowerCase();
  const val = (m[4] ?? m[5] ?? '').trim();
  if (val.startsWith('data:') || val.startsWith('#')) continue;
  if (tag === 'a' && /^https:\/\//.test(val)) continue;
  bad.push(`<${tag} ${m[2]}="${val.slice(0, 80)}">`);
}
if (/\brel\s*=\s*["']?(manifest|apple-touch-icon|stylesheet|modulepreload)/i.test(shell)) {
  bad.push('manifest/apple-touch-icon/stylesheet/modulepreload link');
}
if (/\bnavigator\.serviceWorker\.register\b/.test(html)) bad.push('service worker registration');

if (bad.length) {
  console.error('finalize-single: external references found:\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log('finalize-single: dist-single/crappy.html (no external references)');
