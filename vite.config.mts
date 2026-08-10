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
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Split the heavy, rarely-changing vendors into their own cacheable chunks so
    // app-code changes don't invalidate them. gsap/Flip is excluded here — it's
    // split off via a dynamic import in motion.ts (loadFlip) and stays its own
    // async chunk loaded on demand.
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@emotion/') || id.includes('@mui/')) return 'mui';
          if (id.includes('@gsap/react') || (id.includes('/gsap/') && !id.includes('Flip'))) {
            return 'gsap';
          }
        },
      },
    },
  },
});
