import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { text } from 'node:stream/consumers';

const FE_EXT = new Set([
  '.tsx',
  '.jsx',
  '.ts',
  '.js',
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

const FE_DEP =
  /(?:^|[/@_.-])(?:react|vue|svelte|astro|solidjs|solid|preact|next|nuxt|remix|gatsby|lit|stimulus|tailwind|tailwindcss|angular|vite|ember|alpine|hyperapp|inferno)(?=[/@_.-]|$)/i;

const FE_CONFIG = /^(?:vite|next|svelte|nuxt|astro|tailwind)\.config\.|^angular\.json$/;

const MAX_SHOWN = 20;

const git = (cwd, args) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 24 });
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

const dirtyFrontendFiles = (cwd) =>
  git(cwd, ['status', '--porcelain', '-z', '--no-renames', '-uall'])
    .split('\0')
    .filter(Boolean)
    .filter((entry) => entry[0] !== 'D' && entry[1] !== 'D')
    .map((entry) => entry.slice(3))
    .filter((name) => FE_EXT.has(extname(name).toLowerCase()));

const ledgerFile = (id) =>
  join(tmpdir(), `frontend-sweep-${String(id).replace(/[^\w-]/g, '_')}.txt`);

const ledgerKey = (root, file) => `${root}\t${file}`;

const alreadySaid = (ledger) => {
  try {
    return new Set(readFileSync(ledger, 'utf8').split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
};

const record = (ledger, keys) => {
  try {
    appendFileSync(ledger, keys.join('\n') + '\n');
  } catch {
    // fail open — never block a turn on a reflective hook
  }
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
  if (!root) return;
  const dirty = dirtyFrontendFiles(cwd).sort();
  if (dirty.length === 0) return;
  const ledger = ledgerFile(payload.session_id || process.ppid);
  const said = alreadySaid(ledger);
  const files = dirty.filter((f) => !said.has(ledgerKey(root, f)));
  if (files.length === 0) return;
  if (!isFrontendProject(root)) return;
  record(
    ledger,
    files.slice(0, MAX_SHOWN).map((f) => ledgerKey(root, f)),
  );
  const systemMessage = `frontend: ${files.length} changed FE file${files.length === 1 ? '' : 's'} — run frontend:guidelines\n${listing(files)}`;
  process.stdout.write(JSON.stringify({ systemMessage }));
};

try {
  await main();
} catch {
  // fail open — never block a turn on a reflective hook
}
process.exit(0);
