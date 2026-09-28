import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const hook = (name) => fileURLToPath(new URL(`../hooks/${name}`, import.meta.url));

// COPILOT_PLUGIN_ROOT is how the hooks tell the hosts apart; clear it for the Claude runs.
const run = (name, payload, copilot) =>
  spawnSync(process.execPath, [hook(name)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: payload.cwd,
      COPILOT_PLUGIN_ROOT: copilot ? tmpdir() : '',
    },
  });

const inProject = (fn) => {
  const cwd = mkdtempSync(join(tmpdir(), 'workbench-hooks-'));
  try {
    fn(cwd);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
};

test('gate: Claude Write of a misplaced artifact is denied through hookSpecificOutput', () =>
  inProject((cwd) => {
    const r = run('gate.mjs', {
      cwd,
      tool_name: 'Write',
      tool_input: { file_path: join(cwd, 'x.plan.md') },
    });
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    assert.equal(out.permissionDecision, 'deny');
    assert.match(out.permissionDecisionReason, /docs\/plan\//);
  }));

test('gate: Copilot create of a misplaced artifact is denied with flat fields', () =>
  inProject((cwd) => {
    const r = run(
      'gate.mjs',
      { cwd, tool_name: 'create', tool_input: { path: join(cwd, 'x.plan.md'), file_text: '#' } },
      true,
    );
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.hookSpecificOutput, undefined);
    assert.equal(out.permissionDecision, 'deny');
  }));

test('gate: Copilot edit is not a Write and passes', () =>
  inProject((cwd) => {
    const r = run(
      'gate.mjs',
      { cwd, tool_name: 'edit', tool_input: { path: join(cwd, 'x.plan.md'), new_str: '#' } },
      true,
    );
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  }));

test('brief: Copilot skill call by bare name gets the brief as flat additionalContext', () =>
  inProject((cwd) => {
    const r = run(
      'brief.mjs',
      { cwd, hook_event_name: 'PreToolUse', tool_name: 'skill', tool_input: { skill: 'tdd' } },
      true,
    );
    assert.equal(r.status, 0);
    assert.match(JSON.parse(r.stdout).additionalContext, /^workbench effort directory: none/);
  }));

test('brief: Claude skill call by bare name stays silent', () =>
  inProject((cwd) => {
    const r = run('brief.mjs', {
      cwd,
      hook_event_name: 'PreToolUse',
      tool_name: 'Skill',
      tool_input: { skill: 'tdd' },
    });
    assert.equal(r.stdout, '');
  }));

test('brief: Claude SessionStart keeps hookSpecificOutput', () =>
  inProject((cwd) => {
    const r = run('brief.mjs', { cwd, hook_event_name: 'SessionStart' });
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    assert.equal(out.hookEventName, 'SessionStart');
    assert.match(out.additionalContext, /^workbench effort directory/);
  }));
