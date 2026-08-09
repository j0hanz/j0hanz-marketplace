import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const DATA = new URL('./site/src/data/marketplace.json', import.meta.url);

// Title and description come from the same generated data as the page body, injected at
// build time so crawlers read them without running JS.
const siteMeta = (): Plugin => ({
  name: 'site-meta',
  transformIndexHtml: (html) => {
    const { name, description, repo } = JSON.parse(readFileSync(DATA, 'utf8'));
    return html
      .replaceAll('%TITLE%', name)
      .replaceAll('%DESCRIPTION%', description)
      .replaceAll('%REPO%', repo);
  },
});

export default defineConfig({
  root: 'site',
  base: '/',
  plugins: [react(), siteMeta()],
  build: { outDir: '../dist', emptyOutDir: true },
});
