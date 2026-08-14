import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('../hooks/sweep-fe.mjs', import.meta.url));

const markers = () => new Set(readdirSync(tmpdir()).filter((f) => f.startsWith('frontend-sweep-')));

// The hook gates on a marker named after a hash it owns, so the only safe cleanup is by difference.
const before = markers();
test.after(() => {
  for (const f of markers()) if (!before.has(f)) rmSync(join(tmpdir(), f), { force: true });
});

// A repo with the given files, dirty and untracked, so `git status --porcelain` reports them.
const repo = (files) => {
  const dir = mkdtempSync(join(tmpdir(), 'fe-sweep-test-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), body);
  }
  return dir;
};

// stderr is ignored: a probe that fails is normal here, and its noise would read as a failing run.
const runRaw = (cwd, input) =>
  execFileSync('node', [HOOK], { cwd, input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });

const run = (cwd, session_id) => runRaw(cwd, JSON.stringify({ cwd, session_id }));

const session = (name) => `fe-sweep-test-${process.pid}-${name}`;

test('a frontend repo with dirty FE files is reported once per file set', () => {
  const dir = repo({
    'package.json': '{"dependencies":{"react":"19.0.0"}}',
    'App.tsx': 'export const App = () => null;\n',
    'app.css': 'a{}\n',
    'notes.md': '# no\n',
  });
  try {
    // Four dirty files, two of them frontend: .md and .json are not FE extensions.
    const first = JSON.parse(run(dir, session('once')));
    assert.match(first.systemMessage, /^frontend: 2 changed FE files — run frontend:guidelines$/m);
    assert.match(first.systemMessage, /\n {2}- App\.tsx\n/);
    assert.match(first.systemMessage, /\n {2}- app\.css$/);
    assert.doesNotMatch(first.systemMessage, /notes\.md/);
    assert.doesNotMatch(first.systemMessage, /package\.json/);

    assert.equal(run(dir, session('once')), '', 'same file set in same session stays silent');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a repo with no frontend signal is silent even with dirty FE files', () => {
  const dir = repo({ 'app.css': 'a{}\n' });
  try {
    assert.equal(run(dir, session('backend')), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a frontend repo with no dirty FE files is silent', () => {
  const dir = repo({ 'package.json': '{"devDependencies":{"vite":"8.0.0"}}' });
  try {
    assert.equal(run(dir, session('clean')), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a dependency matches on whole name parts only', () => {
  const css = 'a{}\n';
  const dep = (name) =>
    repo({ 'package.json': `{"devDependencies":{"${name}":"1"}}`, 'a.css': css });
  const scoped = dep('@vitejs/plugin-react');
  const prefix = dep('vitest');
  try {
    assert.match(JSON.parse(run(scoped, session('scoped'))).systemMessage, /1 changed FE file/);
    assert.equal(run(prefix, session('prefix')), '', 'vitest is not vite');
  } finally {
    rmSync(scoped, { recursive: true, force: true });
    rmSync(prefix, { recursive: true, force: true });
  }
});

test('FE files inside a wholly untracked directory are listed one by one', () => {
  const dir = repo({
    'package.json': '{"dependencies":{"react":"19.0.0"}}',
    'src/ui/Card.tsx': 'x\n',
    'src/ui/card.css': 'a{}\n',
    'src/ui/notes.md': '# no\n',
  });
  try {
    const out = JSON.parse(run(dir, session('untracked-dir')));
    assert.match(out.systemMessage, /2 changed FE files/);
    assert.match(out.systemMessage, /- src\/ui\/Card\.tsx/);
    assert.match(out.systemMessage, /- src\/ui\/card\.css/);
    assert.doesNotMatch(out.systemMessage, /- src\/ui\/$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a nested framework config alone marks the project frontend', () => {
  const dir = repo({ 'tailwind.config.js': 'export default {};\n', 'a.scss': 'a{}\n' });
  try {
    const out = JSON.parse(run(dir, session('config')));
    assert.match(out.systemMessage, /2 changed FE files/);
    assert.match(out.systemMessage, /- tailwind\.config\.js/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the listing caps at 20 files and names the remainder', () => {
  const files = { 'package.json': '{"dependencies":{"vue":"3.0.0"}}' };
  for (let i = 0; i < 23; i++) files[`c${String(i).padStart(2, '0')}.css`] = 'a{}\n';
  const dir = repo(files);
  try {
    const out = JSON.parse(run(dir, session('cap')));
    assert.match(out.systemMessage, /23 changed FE files/);
    assert.equal(out.systemMessage.match(/\n {2}- /g).length, 20);
    assert.match(out.systemMessage, /\n {2}…and 3 more$/);
    assert.match(out.systemMessage, /- c00\.css/);
    assert.doesNotMatch(out.systemMessage, /- c20\.css/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('one dirty FE file is singular', () => {
  const dir = repo({ 'package.json': '{"dependencies":{"svelte":"5.0.0"}}', 'a.svelte': '<p/>\n' });
  try {
    const out = JSON.parse(run(dir, session('one')));
    assert.match(out.systemMessage, /1 changed FE file —/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a re-entrant stop is silent', () => {
  const dir = repo({ 'package.json': '{"dependencies":{"react":"19.0.0"}}', 'a.tsx': 'x\n' });
  try {
    const payload = { cwd: dir, session_id: session('reentrant'), stop_hook_active: true };
    assert.equal(runRaw(dir, JSON.stringify(payload)), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a non-repo cwd and a broken payload both fail open', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fe-sweep-test-norepo-'));
  try {
    assert.equal(run(dir, session('norepo')), '');
    assert.equal(runRaw(dir, 'not json'), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
