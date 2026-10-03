import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const HOOK = fileURLToPath(new URL('../hooks/brief.mjs', import.meta.url));

// Build a project whose docs/plan/ holds the given tree, then run the hook against it as the
// given event. A key ending in '/' is a directory; a string value is a file's body; a number
// is an empty file with that mtime, in seconds since the epoch.
const run = (tree, payload = { hook_event_name: 'UserPromptSubmit' }) => {
  const project = mkdtempSync(join(tmpdir(), 'workbench-brief-'));
  try {
    for (const [path, value] of Object.entries(tree)) {
      const full = join(project, 'docs', 'plan', path);
      if (path.endsWith('/')) {
        mkdirSync(full, { recursive: true });
        continue;
      }
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, typeof value === 'string' ? value : '');
      if (typeof value === 'number') utimesSync(full, value, value);
    }
    return spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify(payload),
      env: { ...process.env, CLAUDE_PROJECT_DIR: project },
      encoding: 'utf8',
    }).stdout;
  } finally {
    rmSync(project, { recursive: true, force: true });
  }
};

// One effort holding exactly the given artifact stages. A stage is a kind, or [kind, body].
const brief = (stages, payload) =>
  run(
    Object.fromEntries(
      stages.map((stage) => {
        const [kind, body = ''] = [stage].flat();
        return [`2026-08-14-auth/auth.${kind}.md`, body];
      }),
    ),
    payload,
  );

const COMPLETE = {
  '2026-08-14-auth/auth.spec.md': '',
  '2026-08-14-auth/auth.plan.md': '',
  '2026-08-14-auth/auth.run.md': '',
  '2026-08-14-auth/auth.verify.md': '',
};
const START = { hook_event_name: 'SessionStart' };

test('an unfinished chain names the skill that produces the next stage', () => {
  const context = JSON.parse(brief(['spec', 'plan'])).hookSpecificOutput.additionalContext;
  assert.match(
    context,
    /no run, verify; next: the plan-hunt skill \(or run-plan, where write-plan skipped the hunt for a plan of at most two steps\)/,
  );
});

test('an unprompted brief stays silent once the chain is complete', () => {
  assert.equal(brief(['spec', 'plan', 'run', 'verify']), '');
});

// A fix routes diagnose straight to plan, so its stem never carries a spec — and with no spec
// there is nothing for verify-specs to check. Routing it there would also leave the chain
// permanently unfinished, and the brief would bill every prompt forever.
test('a fix chain with no spec is complete once run lands', () => {
  assert.equal(brief(['diagnose', 'plan', 'run']), '');
});

test('a stem that never entered the chain is not routed into it', () => {
  assert.equal(brief(['hunt']), '');
});

// diagnose pins a cause that needs fixing, so its stem always owes a plan — unlike a hunt,
// which can find nothing and would then bill the brief forever.
test('a lone diagnose stem is routed to the plan it owes', () => {
  const context = JSON.parse(brief(['diagnose'])).hookSpecificOutput.additionalContext;
  assert.match(context, /no plan, run; next: the write-plan skill/);
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

// plan-hunt forbids handing run-plan a plan with confirmed-dead steps; the brief must not
// name that route either. CRLF line endings are what a Windows editor writes.
test('a plan-hunt that found dead steps routes back to write-plan, then a re-hunt', () => {
  const out = brief(['spec', 'plan', ['plan-hunt', 'Status: dead steps\r\n\r\nstep 2 ...\r\n']]);
  assert.match(
    out,
    /no run, verify; next: the write-plan skill to fix what plan-hunt found, then the plan-hunt skill again/,
  );
});

test('a spec-hunt that found gaps routes back to write-specs, then a re-hunt', () => {
  const out = brief(['spec', ['spec-hunt', 'Status: gaps\n']]);
  assert.match(
    out,
    /no plan, run, verify; next: the write-specs skill to fix what spec-hunt found, then the spec-hunt skill again/,
  );
});

// A re-hunt appends a dated section; its status line, the last one, is the live verdict.
test('a re-hunt that came back clean routes to run-plan', () => {
  const report = 'Status: dead steps\n\n## 2026-08-15\n\nStatus: clean\n';
  const out = brief(['spec', 'plan', ['plan-hunt', report]]);
  assert.match(out, /no run, verify; next: the run-plan skill/);
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
  const out = run({}, START);
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /none under docs\/plan\//);
});

test('the live effort is the one with the newest artifact, not the latest date', () => {
  const out = run(
    { '2026-01-01-old/old.plan.md': 1_900_000_000, '2026-09-01-new/new.plan.md': 1_000_000_000 },
    START,
  );
  assert.match(out, /effort directory: docs\/plan\/2026-01-01-old\//);
  assert.match(out, /other efforts: 2026-09-01-new/);
});

test('an mtime tie goes to the later-dated effort', () => {
  const out = run(
    { '2026-01-01-old/old.plan.md': 1_500_000_000, '2026-09-01-new/new.plan.md': 1_500_000_000 },
    START,
  );
  assert.match(out, /effort directory: docs\/plan\/2026-09-01-new\//);
});

test('a ticket edit counts toward an effort being live', () => {
  const out = run(
    {
      '2026-01-01-a/a.plan.md': 1_000_000_000,
      '2026-01-01-a/tickets/t1.md': 1_900_000_000,
      '2026-02-01-b/b.plan.md': 1_500_000_000,
    },
    START,
  );
  assert.match(out, /effort directory: docs\/plan\/2026-01-01-a\//);
});

test('other efforts lists the three latest and counts the rest', () => {
  const out = run(
    {
      '2026-01-01-a/': 0,
      '2026-01-02-b/': 0,
      '2026-01-03-c/': 0,
      '2026-01-04-d/': 0,
      '2026-01-05-e/': 0,
    },
    START,
  );
  assert.match(out, /other efforts: 2026-01-04-d, 2026-01-03-c, 2026-01-02-b \(\+1\)/);
});

// A complete chain silences the unprompted brief; a misplaced artifact must still break it.
test('a loose artifact under docs/plan/ breaks the silence of a complete chain', () => {
  const out = run({ ...COMPLETE, 'x.spec.md': '' });
  assert.match(
    out,
    /docs\/plan\/ holds 1 loose artifact — artifacts belong in an effort directory/,
  );
});

test('a non-dated directory under docs/plan/ breaks the silence of a complete chain', () => {
  const out = run({ ...COMPLETE, 'notes/': 0 });
  assert.match(out, /not a dated effort directory: notes\//);
});
