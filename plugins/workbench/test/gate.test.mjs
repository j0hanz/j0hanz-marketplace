import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HOOK = fileURLToPath(new URL('../hooks/gate.mjs', import.meta.url));

// Spawn the gate hook with a Write tool payload and return stdout.
const gate = (filePath, project) => {
  return spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: filePath },
    }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: project },
    encoding: 'utf8',
  }).stdout;
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
