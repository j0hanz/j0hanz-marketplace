import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ADVISE, runRules } from '../hooks/rules.mjs';

const RUNTIME = fileURLToPath(new URL('../hooks/runtime.mjs', import.meta.url));

test('focusableMissingFocusVisible flags cursor: pointer edit when file has :focus-visible elsewhere', () => {
  const added = '.card { cursor: pointer; }';
  const file = '.other:focus-visible { outline: 2px solid; }\n.card { cursor: pointer; }';
  const hits = runRules(ADVISE, added, 'app.css', () => file);
  assert.ok(hits.some((h) => h.msg.includes(':focus-visible')));
});

test('focusableMissingFocusVisible stays quiet when :focus-visible matches the selector', () => {
  const css = '.card { cursor: pointer; } .card:focus-visible { outline: 2px solid; }';
  const hits = runRules(ADVISE, css, 'app.css', () => css);
  assert.ok(!hits.some((h) => h.msg.includes('cursor: pointer without a :focus-visible')));
});

test('runtime resolves relative filePath against workspace(payload) when reading disk file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'css-runtime-'));
  try {
    writeFileSync(
      join(dir, 'styles.css'),
      '.btn:focus-visible { outline: 2px solid; }\n.btn { outline: none; }\n',
    );
    const r = spawnSync(process.execPath, [RUNTIME, 'post'], {
      input: JSON.stringify({
        cwd: dir,
        session_id: `rel-test-${Date.now()}`,
        tool_name: 'Edit',
        tool_input: { file_path: 'styles.css', new_string: '.btn { outline: none; }' },
      }),
      encoding: 'utf8',
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
