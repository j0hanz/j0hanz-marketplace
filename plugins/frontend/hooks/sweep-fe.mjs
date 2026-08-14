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
    // A deleted path has nothing left to review. `--no-renames` splits a rename into its two
    // halves, so dropping the deleted one still leaves the new path listed.
    .filter((entry) => entry[0] !== 'D' && entry[1] !== 'D')
    .map((entry) => entry.slice(3))
    .filter((name) => FE_EXT.has(extname(name).toLowerCase()));

// One ledger per session, holding the paths already reported — so a file added later nags on its
// own rather than re-nagging every file alongside it.
const ledgerFile = (id) =>
  join(tmpdir(), `frontend-sweep-${String(id).replace(/[^\w-]/g, '_')}.txt`);

// Status paths are repo-relative, and the pid fallback below can hand two repos the same ledger,
// so the repo root is part of the key rather than part of the filename.
const ledgerKey = (root, file) => `${root}\t${file}`;

const alreadySaid = (ledger) => {
  try {
    return new Set(readFileSync(ledger, 'utf8').split('\n').filter(Boolean));
  } catch {
    return new Set();
  }
};

// ponytail: read-then-append, not a lock — two Stop hooks racing inside one session would both
// report. Stop is serialized per session, so this stays a read-then-append until it isn't.
const record = (ledger, keys) => {
  try {
    appendFileSync(ledger, keys.join('\n') + '\n');
  } catch {
    // The ledger is unwritable (unwritable tmpdir). These files nag again next turn — repeating
    // beats going silent.
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

  // Cheapest gate first: a turn that changed no FE file is the common one, and it costs a single
  // git probe to leave. Project detection reads package.json and walks the index, so it waits
  // until there is something to report.
  const dirty = [...new Set(dirtyFrontendFiles(cwd))].sort();
  if (dirty.length === 0) return;

  // No session id (a bare invocation) falls back to the caller's pid, so sessions never share a ledger.
  const ledger = ledgerFile(payload.session_id || process.ppid);
  const said = alreadySaid(ledger);
  const files = dirty.filter((f) => !said.has(ledgerKey(root, f)));
  if (files.length === 0) return;

  if (!isFrontendProject(root)) return;
  record(
    ledger,
    files.map((f) => ledgerKey(root, f)),
  );

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
