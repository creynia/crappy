// TODO(WP4): also fail if the HTML contains external src=/href= references.
// WP0 minimal version: rename dist-single/index.html -> dist-single/crappy.html.
import { renameSync, existsSync } from 'node:fs';

if (existsSync('dist-single/index.html')) {
  renameSync('dist-single/index.html', 'dist-single/crappy.html');
}
if (!existsSync('dist-single/crappy.html')) {
  console.error('finalize-single: dist-single/crappy.html missing');
  process.exit(1);
}
console.log('finalize-single: dist-single/crappy.html');
