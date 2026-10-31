import type { Plugin } from 'vite';
import { buildStaticSite, spaHeadExtras } from './static-site';
import { buildContent } from '../src/content/load';

/**
 * Normal (non-single) build only: emits the static SEO pages, sitemap.xml, llms.txt and
 * llms-full.txt (see build/static-site.ts) and adds the canonical link and a <noscript>
 * block to the SPA shell. The service worker plugin leaves all of these out of its precache.
 */
export function staticSitePlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'crappy-static-site',
    apply: 'build',
    configResolved(c) {
      root = c.root;
    },
    transformIndexHtml(html) {
      const extras = spaHeadExtras(buildContent(root).lessons.length);
      return html
        .replace('</head>', `    ${extras.head}\n  </head>`)
        .replace('<div id="app"></div>', `<div id="app"></div>\n    ${extras.body}`);
    },
    generateBundle() {
      if (this.environment && this.environment.config.build.ssr) return;
      const { files } = buildStaticSite(root);
      for (const [fileName, source] of Object.entries(files))
        this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
