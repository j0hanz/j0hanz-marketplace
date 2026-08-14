import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';

const FE_EXT = new Set([
  '.tsx',
  '.jsx',
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.astro',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.styl',
  '.pcss',
]);

const FE_TOKEN = new Set([
  'react',
  'reactdom',
  'vue',
  'svelte',
  'astro',
  'solidjs',
  'solid',
  'preact',
  'next',
  'nuxt',
  'remix',
  'gatsby',
  'lit',
  'stimulus',
  'tailwind',
  'tailwindcss',
  'angular',
  'vite',
  'ember',
  'alpine',
  'hyperapp',
  'inferno',
]);

const FE_CONFIG = /^(vite|next|svelte|nuxt|astro|tailwind)\.config\.|^angular\.json$/;

const slug = (v) => String(v ?? 'x').replace(/[^\w-]/g, '_');

const gitRoot = (cwd) => {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 1 << 16,
    }).trim();
  } catch {
    return null;
  }
};

const hasFEDep = (root) => {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  } catch {
    return false;
  }
  const deps = Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  });
  return deps.some((d) => {
    const tokens = d.split(/[\/@_.-]+/).filter(Boolean);
    return tokens.some((t) => FE_TOKEN.has(t.toLowerCase()));
  });
};

const isFrontendProject = (root) => {
  if (!root) return false;
  if (hasFEDep(root)) return true;
  try {
    if (readdirSync(root).some((f) => FE_CONFIG.test(f))) return true;
  } catch {}
  try {
    const out = execFileSync(
      'git',
      ['ls-files', '-z', '*.tsx', '*.jsx', '*.vue', '*.svelte', '*.astro'],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 1 << 20,
      },
    );
    if (out.length > 0) return true;
  } catch {}
  return false;
};

const dirtyFrontendFiles = (cwd) => {
  let out;
  try {
    out = execFileSync('git', ['status', '--porcelain', '-z', '--no-renames'], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 1 << 20,
    });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of out.split('\0')) {
    if (!entry) continue;
    const name = entry.slice(3);
    const dot = name.lastIndexOf('.');
    if (dot < 0) continue;
    if (FE_EXT.has(name.slice(dot).toLowerCase())) files.push(name);
  }
  return files;
};

const main = async () => {
  const payload = JSON.parse((await text(process.stdin)) || '{}');
  if (payload.stop_hook_active) return;
  const cwd = payload.cwd || process.cwd();
  const root = gitRoot(cwd);
  if (!root || !isFrontendProject(root)) return;
  const files = dirtyFrontendFiles(cwd);
  if (files.length === 0) return;

  const sorted = [...new Set(files)].sort();
  const key = createHash('sha1')
    .update(slug(payload.session_id) + '\n' + sorted.join('\n'))
    .digest('hex');
  const marker = join(tmpdir(), `frontend-sweep-${key}.txt`);
  if (existsSync(marker)) return;
  try {
    writeFileSync(marker, sorted.join('\n'));
  } catch {}
  const shown = sorted
    .slice(0, 20)
    .map((f) => `  - ${f}`)
    .join('\n');
  const more = sorted.length > 20 ? `\n  …and ${sorted.length - 20} more` : '';
  const systemMessage = [
    `frontend: ${sorted.length} changed FE file${sorted.length === 1 ? '' : 's'} — run frontend:guidelines`,
    shown + more,
  ].join('\n');

  process.stdout.write(JSON.stringify({ systemMessage }));
};

try {
  await main();
} catch {
  // fail open — never block a turn on a reflective hook
}
process.exit(0);
