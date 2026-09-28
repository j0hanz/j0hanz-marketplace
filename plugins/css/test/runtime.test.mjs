import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { stateFile } from '../hooks/changed.mjs';

const HOOK = fileURLToPath(new URL('../hooks/runtime.mjs', import.meta.url));
const BAD = 'a { transition: all 1s; }\n';

// COPILOT_PLUGIN_ROOT is how the hook tells the hosts apart; clear it for the Claude runs.
const run = (mode, payload, copilot) =>
  spawnSync(process.execPath, [HOOK, mode], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, COPILOT_PLUGIN_ROOT: copilot ? tmpdir() : '' },
  });

const withSheet = (name, fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'css-runtime-'));
  const session_id = `css-runtime-${process.pid}-${name}`;
  try {
    fn(join(dir, 'a.css'), session_id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    for (const kind of ['said']) rmSync(stateFile(kind, { session_id }), { force: true });
  }
};

test('Claude: a Write carrying a block rule is denied through hookSpecificOutput', () =>
  withSheet('claude', (file_path, session_id) => {
    const r = run('pre', {
      session_id,
      tool_name: 'Write',
      tool_input: { file_path, content: BAD },
    });
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    assert.equal(out.permissionDecision, 'deny');
    assert.match(out.permissionDecisionReason, /transition: all/);
  }));

for (const [tool_name, input] of [
  ['create', { file_text: BAD }],
  ['edit', { old_str: 'a {}', new_str: BAD }],
  ['Write', { file_text: BAD }],
]) {
  test(`Copilot: a ${tool_name} carrying a block rule is denied with flat fields`, () =>
    withSheet(`copilot-${tool_name}`, (path, session_id) => {
      const r = run('pre', { session_id, tool_name, tool_input: { path, ...input } }, true);
      assert.equal(r.status, 0);
      const out = JSON.parse(r.stdout);
      assert.equal(out.hookSpecificOutput, undefined);
      assert.equal(out.permissionDecision, 'deny');
      assert.match(out.permissionDecisionReason, /transition: all/);
    }));
}

test('Copilot: a clean create stays silent and exits 0', () =>
  withSheet('copilot-clean', (path, session_id) => {
    const r = run(
      'pre',
      { session_id, tool_name: 'create', tool_input: { path, file_text: 'a { color: red; }\n' } },
      true,
    );
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  }));
