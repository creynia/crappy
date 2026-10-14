import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { contentPlugin } from './build/vite-plugin-content';
import { swPlugin } from './build/vite-plugin-sw';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    define: {
      __SINGLE_FILE__: JSON.stringify(single),
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [preact(), contentPlugin(), ...(single ? [viteSingleFile()] : [swPlugin()])],
    publicDir: single ? false : 'public',
    build: { outDir: single ? 'dist-single' : 'dist', target: 'es2022' },
  };
});
