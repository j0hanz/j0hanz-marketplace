import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { effortRoot } from '../hooks/effort.mjs';
import { misplacement } from '../hooks/gate.mjs';

// A project whose docs/plan/ holds two efforts. The second is deliberately named
// for something other than the stem inside it, so a directory-name match cannot
// pass these tests.
const project = mkdtempSync(join(tmpdir(), 'workbench-hooks-'));
const root = effortRoot(project);
const effort = (dir, ...files) => {
  mkdirSync(join(root, dir), { recursive: true });
  for (const file of files) writeFileSync(join(root, dir, file), '#\n');
};
effort('2026-08-01-alpha', 'alpha.spec.md', 'alpha.plan.md');
effort('2026-08-13-hooks', 'workbench-hooks.plan.md');
process.on('exit', () => rmSync(project, { recursive: true, force: true }));

const today = new Date().toISOString().slice(0, 10);

test('a new stem opens its own dated directory instead of joining the live effort', () =>
  assert.equal(
    misplacement(join(project, 'payments.spec.md'), project)?.corrected,
    join(root, `${today}-payments`, 'payments.spec.md'),
  ));

test('an artifact goes back to the effort directory its siblings already live in', () =>
  assert.equal(
    misplacement(join(project, 'workbench-hooks.run.md'), project)?.corrected,
    join(root, '2026-08-13-hooks', 'workbench-hooks.run.md'),
  ));

test('an artifact already in an effort directory is left alone', () =>
  assert.equal(misplacement(join(root, '2026-08-01-alpha', 'alpha.plan.md'), project), null));

test('an artifact under tickets/ is left alone', () =>
  assert.equal(
    misplacement(join(root, '2026-08-01-alpha', 'tickets', 'alpha.plan.md'), project),
    null,
  ));

test('a non-string file path is not a verdict and does not throw', () => {
  assert.equal(misplacement(42, project), null);
  assert.equal(misplacement(undefined, project), null);
});

test('a Stop with nothing stale leaves no marker behind', () => {
  const transcript = join(project, 'session.jsonl');
  const session_id = 'nothing-stale';
  const run = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../hooks/stale.mjs', import.meta.url))],
    {
      input: JSON.stringify({ session_id, transcript_path: transcript, cwd: project }),
      encoding: 'utf8',
      // A plugin root outside any plugins/cache/ path is never stale, so this run
      // has nothing to say and must therefore claim nothing.
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: project, CLAUDE_PROJECT_DIR: project },
    },
  );
  assert.equal(run.status, 0);
  assert.equal(run.stdout, '');
  assert.equal(existsSync(`${transcript}.workbench-stale`), false);
  assert.equal(existsSync(join(tmpdir(), `workbench-stale-${session_id}.txt`)), false);
});
