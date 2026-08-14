// fires:  Stop (turn end)
// reads:  stdin JSON { stop_hook_active, session_id, cwd };
//         git rev-parse --show-toplevel, git ls-files, git status --porcelain -z
// emits:  hookSpecificOutput.additionalContext (agent) + systemMessage (human):
//           list of dirty frontend files + reminder to run frontend:guidelines
// fails:  not a git repo / git missing / not a frontend project / no dirty FE files
//         / stop_hook_active -> exit 0 silent
// verify: node hooks/sweep-fe.mjs < fixture.json; echo $?

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { text } from 'node:stream/consumers';

// Extensions counted as frontend once the project is confirmed FE.
// .ts/.js/.mjs are ambiguous alone, but safe inside a known-frontend repo.
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

// Dep-name tokens that prove a frontend framework. Matched by tokenizing the
// dep name on /@/-/_, so "split2" (contains "lit") does not false-match "lit".
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

// Config basenames (root) that prove a frontend toolchain.
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
  // Tracked tier-1 FE files anywhere in the repo — presence proves FE work even
  // before package.json lists a framework.
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

// Returns dirty frontend file paths, or null when cwd is not a git repo / git missing.
const dirtyFrontendFiles = (cwd) => {
  let out;
  try {
    // --no-renames: a rename shows as delete + add (two clean "XY path" entries)
    // instead of the -z form "R  new\0old", where the second (old, no XY) would
    // hit slice(3) and produce a bogus path.
    out = execFileSync('git', ['status', '--porcelain', '-z', '--no-renames'], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 1 << 20,
    });
  } catch {
    return null;
  }
  const files = [];
  for (const entry of out.split('\0')) {
    if (!entry) continue;
    // porcelain -z entry: "XY path"; XY is 2 chars + 1 space.
    const name = entry.slice(3);
    const dot = name.lastIndexOf('.');
    if (dot < 0) continue;
    if (FE_EXT.has(name.slice(dot).toLowerCase())) files.push(name);
  }
  return files;
};

const main = async () => {
  const payload = JSON.parse((await text(process.stdin)) || '{}');
  if (payload.stop_hook_active) return; // continuation this hook caused — stop the loop
  const cwd = payload.cwd || process.cwd();
  const root = gitRoot(cwd);
  if (!root || !isFrontendProject(root)) return; // inert outside frontend repos
  const files = dirtyFrontendFiles(cwd);
  if (!files || files.length === 0) return;

  const sorted = [...new Set(files)].sort();
  // Re-warn only when the dirty FE set changes; stays quiet across Stops that
  // touch nothing new. Keyed on session + the exact file set.
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
  const context = [
    `Frontend files changed in this session (${sorted.length}):`,
    shown + more,
    `Run frontend:guidelines to check the mechanical floor (semantics, focus, states, motion) before shipping.`,
  ].join('\n');

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'Stop', additionalContext: context },
      systemMessage: `frontend: ${sorted.length} changed FE file${sorted.length === 1 ? '' : 's'} — run frontend:guidelines`,
    }),
  );
};

try {
  await main();
} catch {
  // fail open — never block a turn on a reflective hook
}
process.exit(0);
