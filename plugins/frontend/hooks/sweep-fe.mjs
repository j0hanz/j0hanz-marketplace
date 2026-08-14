import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
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

// A dependency counts when a whole name part matches, so `vite` hits `vite-plugin-x` but not `vitest`.
const FE_DEP = new RegExp(
  `(?:^|[/@_.-])(?:${'react|reactdom|vue|svelte|astro|solidjs|solid|preact|next|nuxt|remix|gatsby|lit|stimulus|tailwind|tailwindcss|angular|vite|ember|alpine|hyperapp|inferno'})(?=[/@_.-]|$)`,
  'i',
);

const FE_CONFIG = /^(vite|next|svelte|nuxt|astro|tailwind)\.config\.|^angular\.json$/;

const MAX_SHOWN = 20;

// Every git probe here is advisory: a failure means "no signal", never an error.
const git = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 20 });
  } catch {
    return '';
  }
};

const hasFEDep = (root) => {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  } catch {
    return false;
  }
  return Object.keys({
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  }).some((d) => FE_DEP.test(d));
};

const hasFEConfig = (root) => {
  try {
    return readdirSync(root).some((f) => FE_CONFIG.test(f));
  } catch {
    return false;
  }
};

const hasFESource = (root) =>
  git(root, ['ls-files', '-z', '*.tsx', '*.jsx', '*.vue', '*.svelte', '*.astro']).length > 0;

const isFrontendProject = (root) => hasFEDep(root) || hasFEConfig(root) || hasFESource(root);

// `-uall` so a wholly untracked directory arrives as its files, not as `sub/`.
const dirtyFrontendFiles = (cwd) =>
  git(cwd, ['status', '--porcelain', '-z', '--no-renames', '-uall'])
    .split('\0')
    .filter(Boolean)
    .map((entry) => entry.slice(3))
    .filter((name) => FE_EXT.has(extname(name).toLowerCase()));

// The marker is the once-per-file-set gate; its name is the whole payload, so it stays empty.
// `wx` makes claiming it atomic.
const claim = (marker) => {
  try {
    writeFileSync(marker, '', { flag: 'wx' });
  } catch (err) {
    if (err.code === 'EEXIST') return false;
    // The gate itself is unavailable (unwritable tmpdir). Nag rather than go silent.
  }
  return true;
};

const listing = (files) =>
  files
    .slice(0, MAX_SHOWN)
    .map((f) => `  - ${f}`)
    .join('\n') + (files.length > MAX_SHOWN ? `\n  …and ${files.length - MAX_SHOWN} more` : '');

const main = async () => {
  const payload = JSON.parse((await text(process.stdin)) || '{}');
  if (payload.stop_hook_active) return;
  const cwd = payload.cwd || process.cwd();
  const root = git(cwd, ['rev-parse', '--show-toplevel']).trim();
  if (!root || !isFrontendProject(root)) return;

  const files = [...new Set(dirtyFrontendFiles(cwd))].sort();
  if (files.length === 0) return;

  // No session id (a bare invocation) falls back to the caller's pid, so sessions never share a gate.
  const key = createHash('sha1')
    .update(`${payload.session_id || process.ppid}\n${files.join('\n')}`)
    .digest('hex');
  if (!claim(join(tmpdir(), `frontend-sweep-${key}.txt`))) return;

  const systemMessage = [
    `frontend: ${files.length} changed FE file${files.length === 1 ? '' : 's'} — run frontend:guidelines`,
    listing(files),
  ].join('\n');
  process.stdout.write(JSON.stringify({ systemMessage }));
};

try {
  await main();
} catch {
  // fail open — never block a turn on a reflective hook
}
process.exit(0);
