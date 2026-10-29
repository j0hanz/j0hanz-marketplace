import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  allow,
  context,
  deny,
  drainAdvisory,
  parkAdvisory,
  pass,
  sessionId,
  stopContext,
  toolInput,
  toolName,
  workspace,
} from '../hooks/client.mjs';

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

test('client: all plugins with JS hooks carry byte-identical hooks/client.mjs and no client.cjs', () => {
  const pluginsRoot = fileURLToPath(new URL('../..', import.meta.url));
  const canonical = readFileSync(hook('client.mjs'), 'utf8');
  let count = 0;
  for (const entry of readdirSync(pluginsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const hooksDir = join(pluginsRoot, entry.name, 'hooks');
    assert.equal(existsSync(join(hooksDir, 'client.cjs')), false, `${entry.name}/hooks/client.cjs`);
    const clientMjs = join(hooksDir, 'client.mjs');
    if (existsSync(clientMjs)) {
      count++;
      assert.equal(readFileSync(clientMjs, 'utf8'), canonical, `${entry.name}/hooks/client.mjs`);
    }
  }
  assert.equal(count, 5);
});

test('client: envelope accessors and answers normalize Claude, Copilot, and Antigravity shapes', () => {
  assert.equal(toolName({ tool_name: 'Write' }), 'Write');
  assert.equal(toolName({ toolName: 'create' }), 'Write');
  assert.equal(toolName({ toolCall: { name: 'write_file' } }), 'Write');
  assert.equal(toolName({ toolCall: { name: 'run_command' } }), 'Bash');

  assert.deepEqual(
    toolInput({
      toolCall: { args: { Path: 'a.md', Content: 'body', CommandLine: 'git status' } },
    }),
    {
      filePath: 'a.md',
      written: 'body',
      replacement: undefined,
      command: 'git status',
      skill: undefined,
    },
  );
  assert.equal(workspace({ workspacePaths: ['/tmp/ws'] }), '/tmp/ws');
  assert.equal(sessionId({ conversationId: 'conv-1' }, 'fallback'), 'conv-1');
  assert.equal(sessionId({}, 'fallback'), 'fallback');

  const prevCopilot = process.env.COPILOT_PLUGIN_ROOT;
  try {
    delete process.env.COPILOT_PLUGIN_ROOT;
    assert.equal(allow(), '');
    assert.equal(pass(), '');
    assert.equal(context('SessionStart', 'hello', { rawSessionStart: true }), 'hello');
    assert.equal(
      JSON.parse(stopContext('Stop', 'note')).hookSpecificOutput.additionalContext,
      'note',
    );
    assert.equal(JSON.parse(deny('no')).hookSpecificOutput.permissionDecision, 'deny');

    process.env.COPILOT_PLUGIN_ROOT = '/tmp/copilot';
    assert.equal(
      JSON.parse(context('SessionStart', 'hello', { rawSessionStart: true })).additionalContext,
      'hello',
    );
    assert.deepEqual(JSON.parse(stopContext('Stop', 'note')), {
      decision: 'block',
      reason: 'note',
    });
    assert.equal(
      JSON.parse(parkAdvisory('test-key', { session_id: 's1' }, 'adv')).additionalContext,
      'adv',
    );
    assert.equal(drainAdvisory('test-key', { session_id: 's1' }), '{}');
  } finally {
    if (prevCopilot === undefined) delete process.env.COPILOT_PLUGIN_ROOT;
    else process.env.COPILOT_PLUGIN_ROOT = prevCopilot;
  }
});
