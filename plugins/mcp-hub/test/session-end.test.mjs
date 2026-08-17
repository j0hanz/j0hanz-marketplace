import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// The hook is CommonJS. Under this repo's `type: module` it will not run in
// place, so the net copies the source into a CJS fixture and runs it there —
// the same CJS context it gets in production. Mirrors test/post-tool-use.test.mjs.
const HOOKS_DIR = fileURLToPath(new URL('../hooks/', import.meta.url));
const SRC = join(HOOKS_DIR, 'session-end.cjs');

const safeId = (s) => String(s).replace(/[^A-Za-z0-9_-]/g, '_');
const storePath = (sid) => join(tmpdir(), 'mcp-hub-drift-' + safeId(sid) + '.json');

const makeHook = () => {
  const root = mkdtempSync(join(tmpdir(), 'mcphub-end-'));
  mkdirSync(join(root, 'hooks'), { recursive: true });
  copyFileSync(SRC, join(root, 'hooks', 'session-end.cjs'));
  return root;
};

const run = (hookRoot, pl) => {
  const r = spawnSync(process.execPath, [join(hookRoot, 'hooks', 'session-end.cjs')], {
    encoding: 'utf8',
    input: pl == null ? '' : typeof pl === 'string' ? pl : JSON.stringify(pl),
  });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
};

const clean = (hookRoot, sid) => {
  rmSync(hookRoot, { recursive: true, force: true });
  if (sid) rmSync(storePath(sid), { force: true });
};

test('SessionEnd: removes the session dedupe store if present, exit 0, no stdout', () => {
  const hook = makeHook();
  const sid = 'end-clean';
  const sp = storePath(sid);
  writeFileSync(sp, JSON.stringify(['R5|src/a.ts']));
  try {
    assert.ok(existsSync(sp));
    const { stdout, status } = run(hook, {
      session_id: sid,
      hook_event_name: 'SessionEnd',
      reason: 'end',
    });
    assert.equal(status, 0);
    assert.equal(stdout, '');
    assert.equal(existsSync(sp), false);
  } finally {
    clean(hook, sid);
  }
});

test('SessionEnd: missing store exits 0 (nothing to clean)', () => {
  const hook = makeHook();
  const sid = 'end-missing';
  try {
    const { stdout, status } = run(hook, { session_id: sid, hook_event_name: 'SessionEnd' });
    assert.equal(status, 0);
    assert.equal(stdout, '');
    assert.equal(existsSync(storePath(sid)), false);
  } finally {
    clean(hook, sid);
  }
});

test('SessionEnd: empty stdin exits 0 (fail open)', () => {
  const hook = makeHook();
  try {
    const { stdout, status } = run(hook, '');
    assert.equal(status, 0);
    assert.equal(stdout, '');
  } finally {
    clean(hook);
  }
});

test('SessionEnd: no session_id exits 0 (fail open, no unlink)', () => {
  const hook = makeHook();
  try {
    const { stdout, status } = run(hook, { hook_event_name: 'SessionEnd', reason: 'end' });
    assert.equal(status, 0);
    assert.equal(stdout, '');
  } finally {
    clean(hook);
  }
});
