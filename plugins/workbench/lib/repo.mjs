// What every brief-emitting script in this plugin needs to read a repo: the
// directories none of them walk, the walker, git, and the counter that keeps a
// sentence grammatical. One copy, because two copies had already drifted — the
// skip list gained three entries on one side and the git comment survived only
// on the other.

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIP_DIR = new Set([
  '.git',
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '.venv',
  'venv',
  '__pycache__',
  'coverage',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.gradle',
  '.terraform',
  'out',
  'bin',
  'obj',
]);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// stderr piped, not inherited: resolving the default branch probes refs that are
// expected to be missing, and those fatals are not the user's problem.
// trimEnd, never trim: `status --porcelain` leads with a status column whose
// first char is a space for an unstaged edit, and stripping it shifts every path
// left by one. Trailing newline is all any caller here needs gone.
// quotePath=false on every call: by default git octal-escapes any path outside
// ASCII — `"st\303\244der.ts"` — and stripping the quotes leaves a name that does
// not open, so the file drops out of the audit for having a non-English filename.
const git = (...args) =>
  execFileSync('git', ['-c', 'core.quotePath=false', ...args], {
    encoding: 'utf8',
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();

// A named directory under the repo root can be walked twice — once to resolve
// scope, once for a caller scan — and one unreadable directory warning twice
// reads as two problems.
const warned = new Set();

// `keep` decides which files land in the result; `limit` stops the walk, and the
// caller discloses that it hit one. Both callers pass exactly one of the two.
function walk(dir, { keep = () => true, limit = Infinity } = {}) {
  const out = [];
  const visit = (from) => {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = readdirSync(from, { withFileTypes: true });
    } catch {
      // One directory the process cannot open would otherwise throw from under
      // the whole-repo scan, and a brief prints in one go at the end — a crash
      // here costs every section. Loud on stderr, out of the brief on stdout.
      if (!warned.has(from)) console.error(`unreadable directory, not scanned: ${from}`);
      warned.add(from);
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIR.has(entry.name)) visit(join(from, entry.name));
      } else {
        const path = relative(process.cwd(), join(from, entry.name)).split(sep).join('/');
        if (keep(path)) out.push(path);
      }
      if (out.length >= limit) break;
    }
  };
  visit(dir);
  return out;
}

export { git, plural, SKIP_DIR, walk };
