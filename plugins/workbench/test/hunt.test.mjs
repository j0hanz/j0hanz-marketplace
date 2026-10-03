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
    assert.match(r.stderr, /not a git repository — hunt\.mjs needs git/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a clean tree on the default branch exits 2 and asks for a scope', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    const r = hunt(repo);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /clean tree on the default branch \(main\) — nothing resolves/);
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

test('a new untracked directory is read file by file', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    write(repo, 'src/feature/x.mjs', 'export const xray = 1;\n');
    write(repo, 'src/feature/y.mjs', 'export const yankee = 1;\n');
    const r = hunt(repo);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /uncommitted changes in the working tree — 2 files/);
    assert.match(r.stdout, /## Changed\n\nsrc\/feature\/[xy]\.mjs[^\n]*\nsrc\/feature\/[xy]\.mjs/);
  }));

test('untracked build output collapses to one skipped directory line', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    write(repo, 'src/b.mjs', 'export const bravo = 1;\n');
    write(repo, 'node_modules/pkg/index.js', 'module.exports = 1;\n');
    write(repo, 'node_modules/pkg/lib/util.js', 'module.exports = 2;\n');
    const r = hunt(repo);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /1 file in scope was skipped[^\n]*\n {4}node_modules\/\n/);
    assert.doesNotMatch(r.stdout, /node_modules\/pkg/);
  }));

test('a staged rename is audited under its new path only', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    git(repo, 'mv', 'src/a.mjs', 'src/renamed.mjs');
    const r = hunt(repo);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /## Changed\n\nsrc\/renamed\.mjs/);
    assert.doesNotMatch(r.stdout, /src\/a\.mjs/);
  }));

test('a tracked file under bin/ is audited, not skipped as build output', () =>
  inRepo({ 'bin/cli.mjs': 'export const run = 1;\n' }, (repo) => {
    write(repo, 'bin/cli.mjs', 'export const run = 2;\n');
    const r = hunt(repo);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /## Changed\n\nbin\/cli\.mjs/);
    assert.equal(hunt(repo, 'bin/cli.mjs').stdout.includes('skipped'), false);
  }));

test('--since scopes to this branch since the fork and drops deleted files', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    git(repo, 'checkout', '-q', '-b', 'feature');
    write(repo, 'src/b.mjs', 'export const bravo = 1;\n');
    git(repo, 'rm', '-q', 'src/a.mjs');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'feature');
    git(repo, 'checkout', '-q', 'main');
    write(repo, 'src/c.mjs', 'export const charlie = 1;\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'main moves on');
    git(repo, 'checkout', '-q', 'feature');
    const r = hunt(repo, '--since', 'main');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /changed since main — 1 file/);
    assert.match(r.stdout, /## Changed\n\nsrc\/b\.mjs/);
    assert.doesNotMatch(r.stdout, /src\/c\.mjs|could not be read/);
  }));

test('a branch scope drops files the branch deleted', () =>
  inRepo(
    { 'src/a.mjs': 'export const alpha = 1;\n', 'src/z.mjs': 'export const zulu = 1;\n' },
    (repo) => {
      git(repo, 'checkout', '-q', '-b', 'feature');
      git(repo, 'rm', '-q', 'src/z.mjs');
      write(repo, 'src/a.mjs', 'export const alpha = 2;\n');
      git(repo, 'add', '-A');
      git(repo, 'commit', '-q', '-m', 'feature');
      const r = hunt(repo);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /branch feature against main/);
      assert.doesNotMatch(r.stdout, /src\/z\.mjs|could not be read/);
    },
  ));

test('a --since value starting with a dash exits 2 and writes nothing', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (repo) => {
    const r = hunt(repo, '--since=--output=leak');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no such ref: --output=leak/);
    assert.equal(git(repo, 'status', '--porcelain'), '');
  }));

test('a repository with no commits exits 2 and asks, without a stack trace', () => {
  const repo = realpathSync(mkdtempSync(join(tmpdir(), 'workbench-hunt-empty-')));
  try {
    git(repo, 'init', '-q', '-b', 'main');
    const r = hunt(repo);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /no commits yet — nothing resolves on its own/);
    assert.doesNotMatch(r.stderr, /\n\s+at /);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('a clone with no local default branch audits against the remote one', () =>
  inRepo({ 'src/a.mjs': 'export const alpha = 1;\n' }, (origin) => {
    git(origin, 'checkout', '-q', '-b', 'feature');
    write(origin, 'src/b.mjs', 'export const bravo = 1;\n');
    git(origin, 'add', '-A');
    git(origin, 'commit', '-q', '-m', 'feature');
    git(origin, 'checkout', '-q', 'main');
    const clone = realpathSync(mkdtempSync(join(tmpdir(), 'workbench-hunt-clone-')));
    try {
      git(clone, 'clone', '-q', '-b', 'feature', origin, '.');
      const r = hunt(clone);
      assert.equal(r.status, 0);
      assert.match(r.stdout, /branch feature against origin\/main/);
      assert.match(r.stdout, /## Changed\n\nsrc\/b\.mjs/);
    } finally {
      rmSync(clone, { recursive: true, force: true });
    }
  }));

test('a symbol with callers in more than COMMON_WORD_FILES files is dropped and disclosed', () => {
  const files = { 'src/orders.ts': CHANGED_TS };
  for (let i = 0; i < 16; i += 1) files[`src/use${i}.ts`] = 'fetchOrders();\n';
  inRepo(files, (repo) => {
    const r = hunt(repo, 'src/orders.ts');
    assert.match(r.stdout, /Every symbol with callers was dropped as a common word/);
    assert.match(r.stdout, /1 symbol hit more than 15 files and was dropped as too common/);
  });
});

test('symbols past PROBE_LIMIT are disclosed as never scanned', () => {
  const body = Array.from({ length: 41 }, (_, i) => `export const symbol${i} = ${i};`).join('\n');
  inRepo({ 'src/many.mjs': `${body}\n` }, (repo) => {
    const r = hunt(repo, 'src/many.mjs');
    assert.match(r.stdout, /1 shorter symbol fell past the 40-symbol probe limit/);
  });
});

test('a changed set over ONE_PASS_FILES says to hunt the riskiest subset first', () => {
  const files = {};
  for (let i = 0; i < 41; i += 1) files[`src/f${i}.mjs`] = `export const file${i} = ${i};\n`;
  inRepo(files, (repo) => {
    const r = hunt(repo, 'src');
    assert.match(r.stdout, /Over one pass\. Hunt the highest-risk subset first/);
  });
});
