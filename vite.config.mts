import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
// Extension included: Vite's native config loader strips types rather than
// bundling, so it resolves the real file rather than guessing at one.
import { brand, ground, ink } from './site/src/theme/tokens.ts';

const DATA = new URL('./site/src/data/marketplace.json', import.meta.url);

// Written without the leading '#': the favicon's data URI needs it escaped as
// %23, the theme-color meta needs it bare, so each use site adds its own.
const paint = {
  '%GROUND_LIGHT%': ground.light.slice(1),
  '%GROUND_DARK%': ground.dark.slice(1),
  '%INK_LIGHT%': ink.light.slice(1),
  '%INK_DARK%': ink.dark.slice(1),
  '%BRAND_LIGHT%': brand.light.slice(1),
  '%BRAND_DARK%': brand.dark.slice(1),
};

const siteMeta = (): Plugin => ({
  name: 'site-meta',
  transformIndexHtml: (html) => {
    const { name, description, repo } = JSON.parse(readFileSync(DATA, 'utf8'));
    let out = html
      .replaceAll('%TITLE%', name)
      .replaceAll('%DESCRIPTION%', description)
      .replaceAll('%REPO%', repo);
    for (const [token, hex] of Object.entries(paint)) out = out.replaceAll(token, hex);
    return out;
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
