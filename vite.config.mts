/// <reference types="node" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite';
import { brand, ground, ink, mono, paper, steel } from './site/src/theme/tokens.ts';
import type { Site } from './site/src/site.ts';

const DATA = new URL('./site/src/data/marketplace.json', import.meta.url);

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

const ORIGIN = process.env['VERCEL_PROJECT_PRODUCTION_URL']
  ? `https://${process.env['VERCEL_PROJECT_PRODUCTION_URL']}/`
  : '';

const THEME_SCRIPT_HASH = 'sha256-qtbieZlDsmW7yCtw/DDZy9Zdyb9cOgyCVPs9MC22EJs=';

const jsonLd = (site: Site) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: site.pageTitle,
    description: site.description,
    numberOfItems: site.plugins.length,
    itemListElement: site.plugins.map((plugin, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SoftwareApplication',
        name: plugin.displayName,
        description: plugin.summary,
        softwareVersion: plugin.version,
        url: plugin.homepage,
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        license: `${site.repoUrl}/blob/main/LICENSE`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    })),
  });

const siteMeta = (): Plugin => ({
  name: 'site-meta',
  transformIndexHtml(html, ctx) {
    const site: Site = JSON.parse(readFileSync(DATA, 'utf8'));
    let out = html
      .replaceAll('%PAGE_TITLE%', site.pageTitle)
      .replaceAll('%TITLE%', site.name)
      .replaceAll('%DESCRIPTION%', site.description)
      .replaceAll('%REPO%', site.repo);
    for (const [token, value] of Object.entries({ ...paint, '%MONO%': mono }))
      out = out.replaceAll(token, value);
    if (ctx.bundle) {
      const inline = out.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? '';
      const hash = `sha256-${createHash('sha256').update(inline).digest('base64')}`;
      if (hash !== THEME_SCRIPT_HASH) {
        throw new Error(
          `index.html's inline theme script changed. Set script-src in vercel.json and ` +
            `THEME_SCRIPT_HASH here to '${hash}', or the CSP will block it in production.`,
        );
      }
    }
    const tags: HtmlTagDescriptor[] = [
      {
        tag: 'script',
        attrs: { type: 'application/ld+json' },
        children: jsonLd(site),
        injectTo: 'body',
      },
    ];
    if (ORIGIN) {
      tags.push(
        { tag: 'link', attrs: { rel: 'canonical', href: ORIGIN }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: ORIGIN }, injectTo: 'head' },
      );
    }

    const font = Object.keys(ctx.bundle ?? {}).find((file) => file.includes('latin-wght'));
    if (font) {
      tags.push({
        tag: 'link',
        attrs: {
          rel: 'preload',
          as: 'font',
          type: 'font/woff2',
          href: `/${font}`,
          crossorigin: '',
        },
        injectTo: 'head',
      });
    }

    return { html: out, tags };
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
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@mui/') || id.includes('/node_modules/@emotion/')) {
            return 'mui';
          }
          return undefined;
        },
      },
    },
  },
});
