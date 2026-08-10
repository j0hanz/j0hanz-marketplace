import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const DATA = new URL('./site/src/data/marketplace.json', import.meta.url);

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
  optimizeDeps: {
    include: ['@mui/material', '@emotion/react', '@emotion/styled'],
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@mui/') || id.includes('/node_modules/@emotion/')) {
            return 'mui';
          }
        },
      },
    },
  },
});
