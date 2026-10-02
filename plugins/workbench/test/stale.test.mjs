import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('../hooks/stale.mjs', import.meta.url));
const OLD = new Date('2020-01-01T00:00:00Z');

let n = 0;
const sessionId = () => `stale-test-${process.pid}-${Date.now()}-${n++}`;
const marker = (id) => join(tmpdir(), `workbench-stale-${id}.txt`);

// A loaded plugin copy under a cache path, dated 2020, and a project whose plugins/<name>/
// holds a file written now. `cached: false` puts the loaded copy outside any cache path.
const fixture = ({ cached = true } = {}) => {
  const base = mkdtempSync(join(tmpdir(), 'workbench-stale-'));
  const pluginRoot = join(base, cached ? 'installed-plugins' : 'dev', 'wb');
  mkdirSync(join(pluginRoot, '.claude-plugin'), { recursive: true });
  const manifest = join(pluginRoot, '.claude-plugin', 'plugin.json');
  writeFileSync(manifest, JSON.stringify({ name: 'wb', version: '0.1.0' }));
  utimesSync(manifest, OLD, OLD);
  const project = join(base, 'project');
  mkdirSync(join(project, 'plugins', 'wb'), { recursive: true });
  writeFileSync(join(project, 'plugins', 'wb', 'SKILL.md'), '# newer\n');
  return { base, pluginRoot, project };
};

const run = ({ pluginRoot, project }, payload, copilot = false) => {
  // Unset, not blank: the hook falls back with `??`, which an empty string would defeat.
  const env = { ...process.env, CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_PROJECT_DIR: project };
  if (copilot) env.COPILOT_PLUGIN_ROOT = pluginRoot;
  else delete env.COPILOT_PLUGIN_ROOT;
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: 'Stop', ...payload }),
    encoding: 'utf8',
    env,
  });
};
const withFixture = (opts, fn) => {
  const f = fixture(opts);
  const id = sessionId();
  try {
    fn(f, id);
  } finally {
    rmSync(f.base, { recursive: true, force: true });
    rmSync(marker(id), { force: true });
  }
};

test('a newer working-tree copy is reported once per session as a systemMessage', () =>
  withFixture({}, (f, id) => {
    const first = run(f, { session_id: id });
    assert.equal(first.status, 0);
    const out = JSON.parse(first.stdout);
    assert.match(
      out.systemMessage,
      /^plugins\/wb\/ in this working tree is newer than the loaded copy\./,
    );
    assert.match(out.systemMessage, /version 0\.1\.0/);
    assert.ok(existsSync(marker(id)));
    const second = run(f, { session_id: id });
    assert.equal(second.stdout, '');
  }));

test('stop_hook_active short-circuits before any comparison', () =>
  withFixture({}, (f, id) => {
    const r = run(f, { session_id: id, stop_hook_active: true });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    assert.ok(!existsSync(marker(id)));
  }));

test('a plugin root outside a cache path is not a loaded copy and stays silent', () =>
  withFixture({ cached: false }, (f, id) => {
    const r = run(f, { session_id: id });
    assert.equal(r.stdout, '');
    assert.ok(!existsSync(marker(id)));
  }));

test('under Copilot the note rides stderr with exit 2', () =>
  withFixture({}, (f, id) => {
    const r = run(f, { session_id: id }, true);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /newer than the loaded copy/);
  }));

test('a loaded copy at least as new as the source stays silent', () =>
  withFixture({}, (f, id) => {
    const now = new Date();
    utimesSync(join(f.pluginRoot, '.claude-plugin', 'plugin.json'), now, now);
    utimesSync(join(f.project, 'plugins', 'wb', 'SKILL.md'), OLD, OLD);
    const r = run(f, { session_id: id });
    assert.equal(r.stdout, '');
  }));
