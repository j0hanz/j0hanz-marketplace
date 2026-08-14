import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HOOK = fileURLToPath(new URL('../hooks/brief.mjs', import.meta.url));

// Build a project whose one effort holds exactly the given artifact stages, then run the
// hook against it as the given event.
const brief = (stages, payload = { hook_event_name: 'UserPromptSubmit' }) => {
  const project = mkdtempSync(join(tmpdir(), 'workbench-brief-'));
  const effort = join(project, 'docs', 'plan', '2026-08-14-auth');
  mkdirSync(effort, { recursive: true });
  for (const stage of stages) writeFileSync(join(effort, `auth.${stage}.md`), '');
  try {
    return spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify(payload),
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
      encoding: 'utf8',
    }).stdout;
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
};

test('an unfinished chain names the skill that produces the next stage', () => {
  const context = JSON.parse(brief(['spec', 'plan'])).hookSpecificOutput.additionalContext;
  assert.match(context, /no run, verify; next `\/workbench:run-plan`/);
});

test('an unprompted brief stays silent once the chain is complete', () => {
  assert.equal(brief(['spec', 'plan', 'run', 'verify']), '');
});

// A fix routes diagnose straight to plan, so its stem never carries a spec. Routing back to
// the bypassed stage would also leave the chain permanently unfinished — the brief would
// then bill every prompt forever.
test('a stage the route skipped is behind the frontier, not pending', () => {
  const context = JSON.parse(brief(['diagnose', 'plan', 'run'])).hookSpecificOutput
    .additionalContext;
  assert.match(context, /no verify; next `\/workbench:verify-specs`/);
});

test('a stem that never entered the chain is not routed into it', () => {
  assert.equal(brief(['hunt']), '');
});

test('an explicit invocation gets the state even with the chain complete', () => {
  const out = brief(['spec', 'plan', 'run', 'verify'], {
    hook_event_name: 'PreToolUse',
    tool_input: { skill: 'workbench:qc' },
  });
  assert.match(out, /docs\/plan\/2026-08-14-auth\//);
});
