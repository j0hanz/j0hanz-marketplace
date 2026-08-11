import { readFileSync } from 'node:fs';
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
// Extension included: Vite's native config loader strips types rather than
// bundling, so it resolves the real file rather than guessing at one.
import { brand, ground, ink, paper, steel } from './site/src/theme/tokens.ts';

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
  '%PAPER_LIGHT%': paper.light.slice(1),
  '%PAPER_DARK%': paper.dark.slice(1),
  '%STEEL_LIGHT%': steel.light.slice(1),
  '%STEEL_DARK%': steel.dark.slice(1),
};

const logger = {
  logEvent(file: string | null, event: { kind: string; detail?: unknown }) {
    if (event.kind !== 'CompileError' && event.kind !== 'PipelineError') return;
    throw new Error(`React Compiler bailed on ${file}: ${String(event.detail)}`);
  },
};

const siteMeta = (): Plugin => ({
  name: 'site-meta',
  transformIndexHtml(html, ctx) {
    const { name, description, repo } = JSON.parse(readFileSync(DATA, 'utf8'));
    let out = html
      .replaceAll('%TITLE%', name)
      .replaceAll('%DESCRIPTION%', description)
      .replaceAll('%REPO%', repo);
    for (const [token, hex] of Object.entries(paint)) out = out.replaceAll(token, hex);
    const font = Object.keys(ctx.bundle ?? {}).find((file) => file.includes('latin-wght'));
    if (!font) return out;
    return {
      html: out,
      tags: [
        {
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'font',
            type: 'font/woff2',
            href: `/${font}`,
            crossorigin: '',
          },
          injectTo: 'head-prepend' as const,
        },
      ],
    };
  },
});

export default defineConfig({
  root: 'site',
  base: '/',
  plugins: [react(), babel({ presets: [reactCompilerPreset({ logger })] }), siteMeta()],
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
