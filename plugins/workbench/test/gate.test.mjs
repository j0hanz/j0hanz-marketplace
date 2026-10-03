import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HOOK = fileURLToPath(new URL('../hooks/gate.mjs', import.meta.url));

// Spawn the gate hook with raw stdin. COPILOT_PLUGIN_ROOT is how the hook tells the hosts
// apart, so it is cleared unless `copilot` is set.
const spawnGate = (input, project, { hook = HOOK, copilot = false } = {}) =>
  spawnSync(process.execPath, [hook], {
    input,
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: project,
      COPILOT_PLUGIN_ROOT: copilot ? project : '',
    },
    encoding: 'utf8',
  });

// Spawn the gate hook with a Write tool payload and return stdout.
const gate = (filePath, project, hook) =>
  spawnGate(JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }), project, {
    hook,
  }).stdout;

const denial = (out) => JSON.parse(out).hookSpecificOutput;

const inProject = (fn) => {
  const project = mkdtempSync(join(tmpdir(), 'workbench-gate-'));
  try {
    fn(project);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
};

test('a write outside docs/plan/ entirely is denied', () => {
  const project = mkdtempSync(join(tmpdir(), 'workbench-gate-'));
  try {
    const filePath = join(project, 'payments.spec.md');
    const out = gate(filePath, project);
    const parsed = JSON.parse(out);
    assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(parsed.hookSpecificOutput.permissionDecisionReason, /docs\/plan\//);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test('a write correctly placed inside a dated effort directory is allowed', () => {
  const project = mkdtempSync(join(tmpdir(), 'workbench-gate-'));
  const effort = join(project, 'docs', 'plan', '2026-08-01-alpha');
  mkdirSync(effort, { recursive: true });
  try {
    const filePath = join(effort, 'alpha.plan.md');
    writeFileSync(filePath, '');
    const out = gate(filePath, project);
    assert.equal(out, '');
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test('a write under an effort tickets subdirectory is allowed', () => {
  const project = mkdtempSync(join(tmpdir(), 'workbench-gate-'));
  const tickets = join(project, 'docs', 'plan', '2026-08-01-alpha', 'tickets');
  mkdirSync(tickets, { recursive: true });
  try {
    const filePath = join(tickets, 'ticket-42.spec.md');
    writeFileSync(filePath, '');
    const out = gate(filePath, project);
    assert.equal(out, '');
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

// The handoff skill keeps its file in the OS temp dir, never in the repo. A gate that
// redirected it into docs/plan/ would be enforcing the opposite of the skill it polices.
test('a handoff file is not an artifact the gate places', () => {
  const project = mkdtempSync(join(tmpdir(), 'workbench-gate-'));
  try {
    assert.equal(gate(join(project, 'auth.handoff.md'), project), '');
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});

test('an artifact whose stem already has an effort is redirected into that effort', () =>
  inProject((project) => {
    const effort = join(project, 'docs', 'plan', '2026-01-01-auth');
    mkdirSync(effort, { recursive: true });
    writeFileSync(join(effort, 'auth.spec.md'), '');
    const out = denial(gate(join(project, 'auth.plan.md'), project));
    assert.equal(out.permissionDecision, 'deny');
    assert.match(out.permissionDecisionReason, /docs\/plan\/2026-01-01-auth\/auth\.plan\.md/);
  }));

test('a loose artifact directly under docs/plan/ is denied', () =>
  inProject((project) => {
    const out = denial(gate(join(project, 'docs', 'plan', 'x.plan.md'), project));
    assert.equal(out.permissionDecision, 'deny');
  }));

test('an artifact nested below an effort directory, outside tickets/, is denied', () =>
  inProject((project) => {
    const filePath = join(project, 'docs', 'plan', '2026-08-01-alpha', 'sub', 'alpha.plan.md');
    const out = denial(gate(filePath, project));
    assert.equal(out.permissionDecision, 'deny');
  }));

test('a write outside the project is not gated', () =>
  inProject((project) => {
    const elsewhere = mkdtempSync(join(tmpdir(), 'workbench-gate-elsewhere-'));
    try {
      assert.equal(gate(join(elsewhere, 'x.plan.md'), project), '');
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  }));

// Under Copilot a PreToolUse hook that exits non-zero or prints non-JSON denies the tool.
test('unreadable stdin under Copilot exits 0 with one JSON notice', () =>
  inProject((project) => {
    const r = spawnGate('{not json', project, { copilot: true });
    assert.equal(r.status, 0);
    const out = JSON.parse(r.stdout);
    assert.equal(out.permissionDecision, undefined);
    assert.match(out.additionalContext, /^workbench gate: check skipped/);
  }));

// A symlinked or junctioned plugin root makes process.argv[1] differ from the module's
// realpath. The gate must still run.
test('the gate runs when its path goes through a symlink or junction', () =>
  inProject((project) => {
    const link = join(project, 'linked-hooks');
    symlinkSync(dirname(HOOK), link, 'junction');
    try {
      const out = denial(gate(join(project, 'x.plan.md'), project, join(link, 'gate.mjs')));
      assert.equal(out.permissionDecision, 'deny');
    } finally {
      unlinkSync(link);
    }
  }));
