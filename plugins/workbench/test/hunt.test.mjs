import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HUNT = fileURLToPath(new URL('../skills/bug-hunt/hunt.mjs', import.meta.url));

// A committed repo with identity set, so `git commit` works on a machine with no config.
const git = (cwd, ...args) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const write = (repo, rel, text) => {
  const path = join(repo, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

const hunt = (cwd, ...args) =>
  spawnSync(process.execPath, [HUNT, ...args], { cwd, encoding: 'utf8' });

// Build a repo whose first commit holds `files`, run `fn` inside it, remove it. realpathSync
// because the script chdirs to `git rev-parse --show-toplevel`, which is the resolved path,
// and a symlinked temp dir (macOS /var → /private/var) would make relative paths climb.
const inRepo = (files, fn) => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'workbench-hunt-')));
  try {
    git(repo, 'init', '-q', '-b', 'main');
    for (const [rel, text] of Object.entries(files)) write(repo, rel, text);
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'init');
    fn(repo);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
};

test('outside a git repository the script exits 1 and says so', () => {
  const dir = mkdtempSync(join(tmpdir(), 'workbench-hunt-nogit-'));
  try {
    const r = hunt(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /not a git repository/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a clean tree on the default branch exits 2 and asks for a scope', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    const r = hunt(repo);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /clean tree on the default branch/);
  }));

test('named paths and --since together exit 2 rather than picking one', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    const r = hunt(repo, 'src', '--since', 'HEAD~1');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /name paths or pass --since, not both/);
  }));

test('a path that does not exist exits 2 naming it', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    const r = hunt(repo, 'nope');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no such path: nope/);
  }));

test('uncommitted changes are the scope when nothing is named', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    write(repo, 'src/a.mjs', 'export const alpha = 2;\n');
    const r = hunt(repo);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /## Scope\n\nuncommitted changes in the working tree — 1 file/);
    assert.match(r.stdout, /## Changed\n\nsrc\/a\.mjs/);
  }));

test('a feature branch is audited against the default branch', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    git(repo, 'checkout', '-q', '-b', 'feature');
    write(repo, 'src/b.mjs', 'export const bravo = 2;\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'feature');
    const r = hunt(repo);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /branch feature against main/);
    assert.match(r.stdout, /src\/b\.mjs/);
    assert.doesNotMatch(r.stdout, /## Changed[\s\S]*src\/a\.mjs/);
  }));

test('a named non-code file is reported as skipped, not silently dropped', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n', 'README.md': '# x\n' }, (repo) => {
    const r = hunt(repo, 'README.md', 'src');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /named on the command line \(README\.md, src\)/);
    assert.match(r.stdout, /skipped — not a code extension[\s\S]*README\.md/);
  }));

const CHANGED_TS = [
  'export function fetchOrders(id: string) {',
  '  try {',
  '    return load(id);',
  '  } catch {}',
  '  // TODO: retry',
  '  return (null as any);',
  '}',
  '',
].join('\n');

test('tells are tagged at their line and read as places to look', () =>
  inRepo({ 'src/orders.ts': CHANGED_TS, 'src/other.ts': 'export const x = 1;\n' }, (repo) => {
    const r = hunt(repo, 'src/orders.ts');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /## Tells\n\n\d+ places? to look\. Each is a question, not a finding\./);
    assert.match(r.stdout, /src\/orders\.ts:4\s+SWALLOWED/);
    assert.match(r.stdout, /src\/orders\.ts:5\s+MARKER/);
    assert.match(r.stdout, /src\/orders\.ts:6\s+ESCAPE/);
  }));

test('a caller outside the changed set lands in the blast radius', () =>
  inRepo(
    {
      'src/orders.ts': CHANGED_TS,
      'src/checkout.ts': "import { fetchOrders } from './orders';\nfetchOrders('1');\n",
    },
    (repo) => {
      const r = hunt(repo, 'src/orders.ts');
      assert.equal(r.status, 0);
      assert.match(r.stdout, /## Blast radius\n\nRead enough of each caller/);
      assert.match(r.stdout, /fetchOrders {2}\(src\/orders\.ts\)\n {4}src\/checkout\.ts/);
    },
  ));

test('a changed set with no callers says so instead of printing an empty list', () =>
  inRepo({ 'src/orders.ts': CHANGED_TS }, (repo) => {
    const r = hunt(repo, 'src/orders.ts');
    assert.match(r.stdout, /1 exported symbol probed\. No callers outside the changed set\./);
  }));

test('a caller in another language family is a coincidence, not a caller', () =>
  inRepo({ 'src/orders.ts': CHANGED_TS, 'tools/fetchOrders.py': 'fetchOrders = 1\n' }, (repo) => {
    const r = hunt(repo, 'src/orders.ts');
    assert.doesNotMatch(r.stdout, /tools\/fetchOrders\.py/);
  }));

// The fixture value is a placeholder, never a real-looking key. Line 3 is reached only by
// MARKER, and its value belongs to the SECRET match that starts on line 2.
const SECRET_MJS = [
  'export const cfg = {',
  '  password:',
  '    "FAKE_FAKE_FAKE_5678", // TODO',
  '};',
  'export const password = "FAKE_FAKE_FAKE_1234"; // TODO rotate',
  '',
].join('\n');

test('a credential value never reaches the brief, on any tell that shows its line', () =>
  inRepo({ 'src/config.mjs': SECRET_MJS }, (repo) => {
    const r = hunt(repo, 'src/config.mjs');
    assert.equal(r.status, 0);
    assert.doesNotMatch(r.stdout, /FAKE_FAKE_FAKE/);
    assert.match(r.stdout, /src\/config\.mjs:2\s+SECRET\s+password:/);
    assert.match(r.stdout, /src\/config\.mjs:3\s+MARKER\s+"<redacted>", \/\/ TODO/);
    assert.match(r.stdout, /src\/config\.mjs:5\s+SECRET\s+export const password = "<redacted>";/);
    assert.match(r.stdout, /src\/config\.mjs:5\s+MARKER\s+export const password = "<redacted>";/);
  }));
