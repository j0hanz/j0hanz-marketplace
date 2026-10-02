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
  assert.match(context, /no run, verify; next: the plan-hunt skill/);
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
  assert.match(context, /no verify; next: the verify-specs skill/);
});

test('a stem that never entered the chain is not routed into it', () => {
  assert.equal(brief(['hunt']), '');
});

// diagnose pins a cause that needs fixing, so its stem always owes a plan — unlike a hunt,
// which can find nothing and would then bill the brief forever.
test('a lone diagnose stem is routed to the plan it owes', () => {
  const context = JSON.parse(brief(['diagnose'])).hookSpecificOutput.additionalContext;
  assert.match(context, /no plan, run, verify; next: the write-plan skill/);
});

// The authoring skills hand a finished spec to spec-hunt and a finished plan to plan-hunt;
// the brief names the same route, or it names the one that skips review.
test('an unreviewed spec routes to spec-hunt, and the hunt is not listed as owed', () => {
  const context = JSON.parse(brief(['spec'])).hookSpecificOutput.additionalContext;
  assert.match(context, /spec — no plan, run, verify; next: the spec-hunt skill/);
});

test('a reviewed spec with no plan routes to write-plan', () => {
  const context = JSON.parse(brief(['spec', 'spec-hunt'])).hookSpecificOutput.additionalContext;
  assert.match(context, /no plan, run, verify; next: the write-plan skill/);
});

test('a reviewed plan with no run routes to run-plan', () => {
  const context = JSON.parse(brief(['spec', 'plan', 'plan-hunt'])).hookSpecificOutput
    .additionalContext;
  assert.match(context, /no run, verify; next: the run-plan skill/);
});

test('a chain that skipped its hunts is still complete once verify lands', () => {
  assert.equal(brief(['spec', 'plan', 'run', 'verify']), '');
});

test('an explicit invocation gets the state even with the chain complete', () => {
  const out = brief(['spec', 'plan', 'run', 'verify'], {
    hook_event_name: 'PreToolUse',
    tool_input: { skill: 'workbench:qc' },
  });
  assert.match(out, /docs\/plan\/2026-08-14-auth\//);
});

// The cold start is where a bench with no effort directory has the most to say and the
// unprompted gate says least — SessionStart pays that rent once, not per prompt.
test('a session start announces the convention even with no effort directory', () => {
  const project = mkdtempSync(join(tmpdir(), 'workbench-brief-'));
  try {
    const out = spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ hook_event_name: 'SessionStart' }),
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
      encoding: 'utf8',
    }).stdout;
    assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /none under docs\/plan\//);
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
});
