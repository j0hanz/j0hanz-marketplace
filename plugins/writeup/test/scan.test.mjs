import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { findSlop, stripCode, RULES } from '../hooks/scan.mjs';

test('each rule flags its sample', () => {
  const samples = {
    7: 'We delve into it.',
    13: 'Fast — and small.',
    17: '## Getting Started With Docker',
    18: '- Done 🎉',
    19: 'He said “hi”.',
    20: 'I hope this helps.',
    23: 'In order to run it.',
    31: 'We utilize caching.',
  };
  for (const [id, text] of Object.entries(samples))
    assert.deepEqual(
      findSlop(text).map((h) => h.id),
      [Number(id)],
      text,
    );
});
test('a lone curly quote is one hit', () => {
  assert.deepEqual(
    findSlop('it’s fine').map((h) => h.id),
    [19],
  );
});
test('clean prose has no hits', () => {
  assert.deepEqual(
    findSlop('The parser rejects a bad date and exits with code 2.\n## API reference'),
    [],
  );
});
test('inflections hit, lookalikes do not', () => {
  assert.equal(findSlop('It underscores the point and is leveraging.').length, 2);
  assert.deepEqual(findSlop('We deliver numeric results.'), []);
  assert.deepEqual(findSlop('Prefix it with an underscore; file an enhancement.'), []);
  assert.deepEqual(findSlop('Open the component showcase.'), []);
  assert.deepEqual(
    findSlop('This enhances, showcases and underscored it.').map((h) => h.match),
    ['enhances', 'showcases', 'underscored'],
  );
});
test('code is ignored and newlines survive', () => {
  const text = 'a\n```\ndelve — 🎉\n```\nuse `utilize()` here\nwe delve';
  assert.equal(stripCode(text).split('\n').length, text.split('\n').length);
  assert.deepEqual(findSlop(text), [{ id: 7, match: 'delve', line: 6 }]);
});
test('CRLF reports the same line numbers', () => {
  assert.deepEqual(findSlop('ok\r\nwe delve\r\n'), findSlop('ok\nwe delve\n'));
});
test('every rule id still exists in unslop', () => {
  const skill = readFileSync(new URL('../skills/unslop/SKILL.md', import.meta.url), 'utf8');
  for (const { id } of RULES)
    assert.match(skill, new RegExp(`^${id}\\. \\*\\*`, 'm'), `rule ${id}`);
});

const HOOK = fileURLToPath(new URL('../hooks/scan.mjs', import.meta.url));
const run = (payload, env) =>
  execFileSync('node', [HOOK], { input: JSON.stringify(payload), encoding: 'utf8', env });
const claude = (payload) => run(payload, { ...process.env, COPILOT_PLUGIN_ROOT: '' });
test('markdown write with slop returns hookSpecificOutput', () => {
  const out = JSON.parse(
    claude({ tool_name: 'Write', tool_input: { file_path: 'README.md', content: 'We delve.' } }),
  );
  assert.equal(out.hookSpecificOutput.hookEventName, 'PostToolUse');
  assert.match(
    out.hookSpecificOutput.additionalContext,
    /^writeup:unslop flagged 1 pattern in README\.md:\n- rule 7 "delve" \(line 1\)\nA rewrite without these patterns passes the scan\.$/,
  );
});
test('Copilot create gets flat additionalContext', () => {
  const out = JSON.parse(
    run(
      { toolName: 'create', toolArgs: { path: 'docs/a.md', file_text: 'We delve.' } },
      { ...process.env, COPILOT_PLUGIN_ROOT: 'x' },
    ),
  );
  assert.match(out.additionalContext, /rule 7/);
});
test('chained git commit is scanned', () => {
  const out = claude({
    tool_name: 'Bash',
    tool_input: { command: 'git add -A && git commit -m "Delve into it"' },
  });
  assert.match(out, /An unpushed commit takes a new message with `git commit --amend`\./);
});
test('gh pr create is scanned', () => {
  assert.match(
    claude({
      tool_name: 'Bash',
      tool_input: { command: 'gh pr create --body "I hope this helps"' },
    }),
    /gh pr edit/,
  );
});
test('silent cases', () => {
  for (const p of [
    { tool_name: 'Bash', tool_input: { command: 'ls' } },
    { tool_name: 'Write', tool_input: { file_path: 'a.ts', content: 'delve' } },
    {
      tool_name: 'Write',
      tool_input: {
        file_path: 'C:\\r\\plugins\\writeup\\skills\\unslop\\SKILL.md',
        content: 'delve',
      },
    },
    { tool_name: 'Write', tool_input: { file_path: 'README.md', content: 'Plain text.' } },
    {
      tool_name: 'Write',
      tool_input: {
        file_path: 'C:\\Users\\me\\.claude\\projects\\x\\memory\\MEMORY.md',
        content: '- [note](a.md) — delve',
      },
    },
    { tool_name: 'Edit', tool_input: { file_path: 'CLAUDE.md', new_string: 'We delve — now.' } },
    {
      tool_name: 'Write',
      tool_input: { file_path: '.github/copilot-instructions.md', content: 'delve' },
    },
  ])
    assert.equal(claude(p), '', JSON.stringify(p));
});
test('Copilot shell and edit tools are scanned', () => {
  const copilot = (payload) => run(payload, { ...process.env, COPILOT_PLUGIN_ROOT: 'x' });
  for (const toolName of ['bash', 'powershell'])
    assert.match(
      JSON.parse(copilot({ toolName, toolArgs: { command: 'git commit -m "Delve in"' } }))
        .additionalContext,
      /rule 7 "Delve".*\nAn unpushed commit/s,
      toolName,
    );
  assert.match(
    JSON.parse(
      copilot({
        toolName: 'edit',
        toolArgs: JSON.stringify({ path: 'docs/a.md', old_str: 'x', new_str: 'We delve.' }),
      }),
    ).additionalContext,
    /^writeup:unslop flagged 1 pattern in an edit to docs\/a\.md:/,
  );
});
test('uppercase .MD is scanned', () => {
  assert.notEqual(
    claude({ tool_name: 'Write', tool_input: { file_path: 'README.MD', content: 'delve' } }),
    '',
  );
});
test('malformed stdin exits 0 silently', () => {
  assert.equal(execFileSync('node', [HOOK], { input: '{nope', encoding: 'utf8' }), '');
});
test('more than 20 hits are capped', () => {
  const out = claude({
    tool_name: 'Write',
    tool_input: { file_path: 'a.md', content: 'delve\n'.repeat(25) },
  });
  assert.match(JSON.parse(out).hookSpecificOutput.additionalContext, /- and 5 more\n/);
});
test('emoji counts only on heading and list lines', () => {
  assert.deepEqual(findSlop('🤖 Generated with [Claude Code](https://claude.com/claude-code)'), []);
  assert.deepEqual(findSlop('Shipped it 🎉 today'), []);
  assert.deepEqual(
    findSlop('# Done 🎉\n1. Ok 🎉').map((h) => h.id),
    [18, 18],
  );
});
test('Edit header says edit; Write header does not', () => {
  const ctx = (tool_name, tool_input) =>
    JSON.parse(claude({ tool_name, tool_input })).hookSpecificOutput.additionalContext;
  assert.match(
    ctx('Edit', { file_path: 'README.md', old_string: 'x', new_string: 'We delve.' }),
    /^writeup:unslop flagged 1 pattern in an edit to README\.md:\n- rule 7 "delve" \(line 1 of the edit\)\n/,
  );
  assert.match(
    ctx('Write', { file_path: 'README.md', content: 'We delve.' }),
    /^writeup:unslop flagged 1 pattern in README\.md:\n- rule 7 "delve" \(line 1\)\n/,
  );
});
test('gh pr comment and review are scanned with their own endings', () => {
  assert.match(
    claude({ tool_name: 'Bash', tool_input: { command: 'gh pr comment 7 --body "Delve"' } }),
    /PR comment:.*gh pr comment --edit-last/s,
  );
  assert.match(
    claude({
      tool_name: 'Bash',
      tool_input: { command: 'gh pr review 7 --approve --body "Delve"' },
    }),
    /review body:.*A follow-up `gh pr comment` carries the correction/s,
  );
  assert.equal(claude({ tool_name: 'Bash', tool_input: { command: 'gh pr view 7' } }), '');
});
test('message files named by -F and --body-file are read', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  try {
    writeFileSync(join(dir, 'msg.txt'), 'fix: x\n\nWe delve here.\n');
    writeFileSync(join(dir, 'body.md'), 'ok\nI hope this helps.\n');
    const out = (command) =>
      JSON.parse(claude({ tool_name: 'Bash', tool_input: { command }, cwd: dir }))
        .hookSpecificOutput.additionalContext;
    assert.match(
      out('git commit -F msg.txt'),
      /commit message \(msg\.txt\):\n- rule 7 "delve" \(line 3\)/,
    );
    assert.match(
      out(`gh pr create --body-file "${join(dir, 'body.md')}"`),
      /PR body \(.*body\.md\):\n- rule 20/,
    );
    assert.match(out('git commit --file=msg.txt'), /\(line 3\)/);
    assert.equal(
      claude({ tool_name: 'Bash', tool_input: { command: 'git commit -F missing.txt' }, cwd: dir }),
      '',
    );
    assert.equal(
      claude({ tool_name: 'Bash', tool_input: { command: 'echo ok | git commit -F -' }, cwd: dir }),
      '',
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('~~~ fences and double-backtick spans are stripped', () => {
  const text = '~~~\ndelve\n~~~\nuse ``a `delve` b`` ok\nwe delve';
  assert.equal(stripCode(text).split('\n').length, text.split('\n').length);
  assert.deepEqual(findSlop(text), [{ id: 7, match: 'delve', line: 5 }]);
});
test('git commit-tree is silent; git commit still flags', () => {
  assert.equal(
    claude({ tool_name: 'Bash', tool_input: { command: 'git commit-tree -m "Delve"' } }),
    '',
  );
  assert.notEqual(
    claude({ tool_name: 'Bash', tool_input: { command: 'git commit -m "Delve"' } }),
    '',
  );
});
test('a fence opens only at line start and closes on a run at least as long', () => {
  const inline = 'Wrap code in ``` fences.\nwe delve';
  assert.deepEqual(findSlop(inline), [{ id: 7, match: 'delve', line: 2 }]);
  const nested = '````markdown\n```text\nwe delve — here\n```\n\n> utilize\n````\nwe delve';
  assert.equal(stripCode(nested).split('\n').length, nested.split('\n').length);
  assert.deepEqual(findSlop(nested), [{ id: 7, match: 'delve', line: 8 }]);
  assert.deepEqual(findSlop('  ```\ndelve\n  ```\nok'), []);
  assert.deepEqual(findSlop('```js\ndelve\n```\r\nok'), []);
});
test('typographic pictographs are not emoji', () => {
  assert.deepEqual(findSlop('- © 2026 Acme ® and Foo™\n## ℹ Note'), []);
  assert.deepEqual(
    findSlop('- ✔ done').map((h) => h.id),
    [18],
  );
});
test('a --file inside the -m text is prose, not a flag', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  try {
    writeFileSync(join(dir, 'README.md'), 'We delve.\n');
    const command = 'git commit -m "docs: describe --file README.md handling, utilize it"';
    const ctx = JSON.parse(claude({ tool_name: 'Bash', tool_input: { command }, cwd: dir }))
      .hookSpecificOutput.additionalContext;
    assert.match(ctx, /^writeup:unslop flagged 1 pattern in commit message:\n- rule 31 "utilize"/);
    assert.doesNotMatch(ctx, /README\.md\)|delve/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('a commit chained with gh pr yields one block each, with its own label and ending', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  try {
    writeFileSync(join(dir, 'body.md'), 'I hope this helps.\n');
    const command =
      'git commit -m "fix: delve" && git push && gh pr create -t t --body-file body.md';
    const ctx = JSON.parse(claude({ tool_name: 'Bash', tool_input: { command }, cwd: dir }))
      .hookSpecificOutput.additionalContext;
    const [commit, pr] = ctx.split('\n\n');
    assert.match(commit, /^writeup:unslop flagged 1 pattern in commit message:\n- rule 7 "delve"/);
    assert.match(commit, /git commit --amend/);
    assert.match(pr, /^writeup:unslop flagged 1 pattern in PR body \(body\.md\):\n- rule 20/);
    assert.match(pr, /gh pr edit --body-file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('a heredoc message keeps its quotes and lines; a quoted git commit is not a command', () => {
  const command = `git add -A && git commit -m "$(cat <<'EOF'\nfix: x\n\nWe delve here.\nEOF\n)"`;
  const ctx = JSON.parse(claude({ tool_name: 'Bash', tool_input: { command } })).hookSpecificOutput
    .additionalContext;
  assert.match(
    ctx,
    /^writeup:unslop flagged 1 pattern in commit message:\n- rule 7 "delve" \(line 4\)/,
  );
  assert.equal(
    claude({ tool_name: 'Bash', tool_input: { command: 'echo "then git commit; we delve"' } }),
    '',
  );
});
test('the hook runs when invoked through a symlink or junction', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  try {
    const link = join(dir, 'hooks');
    try {
      symlinkSync(fileURLToPath(new URL('../hooks', import.meta.url)), link, 'junction');
    } catch {
      return; // no symlink privilege here; the guard is exercised by every other test
    }
    const out = execFileSync('node', [join(link, 'scan.mjs')], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: 'a.md', content: 'We delve.' },
      }),
      encoding: 'utf8',
      env: { ...process.env, COPILOT_PLUGIN_ROOT: '' },
    });
    assert.match(out, /rule 7/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
