import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('../hooks/set-style.mjs', import.meta.url));

// Every run gets its own home and config dir, so the user's real settings are never touched.
// An empty CLAUDE_CONFIG_DIR reads as unset.
const run = (args, { home, config, cwd }) =>
  spawnSync('node', [HOOK, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, CLAUDE_CONFIG_DIR: config ?? '' },
  });

const withDirs = (n, body) => {
  const dirs = Array.from({ length: n }, () => mkdtempSync(join(tmpdir(), 'set-style-')));
  try {
    return body(...dirs);
  } finally {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  }
};

const style = (file) => JSON.parse(readFileSync(file, 'utf8')).outputStyle;

test('self-test passes', () => {
  const r = spawnSync('node', [HOOK, '--self-test'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('writes under CLAUDE_CONFIG_DIR when it is set', () =>
  withDirs(2, (home, config) => {
    const r = run(['concise'], { home, config, cwd: home });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(style(join(config, 'settings.json')), 'output-styles:concise');
    assert.equal(existsSync(join(home, '.claude', 'settings.json')), false);
  }));

test('writes under home when CLAUDE_CONFIG_DIR is unset', () =>
  withDirs(1, (home) => {
    const r = run(['tldr'], { home, cwd: home });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(style(join(home, '.claude', 'settings.json')), 'output-styles:tldr');
  }));

test('no override warning for the global file itself', () =>
  withDirs(2, (base, other) => {
    const config = join(base, '.claude');
    mkdirSync(config);
    writeFileSync(join(config, 'settings.json'), '{"outputStyle":"x"}');
    const r = run(['concise'], { home: other, config, cwd: base });
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.stdout + r.stderr, /warning:/);
  }));

test('a symlinked settings file stays a symlink', (t) =>
  withDirs(3, (home, config, dotfiles) => {
    const target = join(dotfiles, 'settings.json');
    writeFileSync(target, '{"keep":1}');
    try {
      symlinkSync(target, join(config, 'settings.json'), 'file');
    } catch {
      t.skip('no symlink privilege');
      return;
    }
    const r = run(['concise'], { home, config, cwd: home });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(lstatSync(join(config, 'settings.json')).isSymbolicLink());
    assert.deepEqual(JSON.parse(readFileSync(target, 'utf8')), {
      keep: 1,
      outputStyle: 'output-styles:concise',
    });
  }));
