import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
  assert.equal(findSlop('It underscores and is leveraging.').length, 2);
  assert.deepEqual(findSlop('We deliver numeric results.'), []);
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
    /^writeup:unslop flagged 1 pattern in README\.md:\n- rule 7 "delve" \(line 1\)\nRewrite these lines\.$/,
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
  assert.match(out, /Amend the commit if it is not pushed\./);
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
  ])
    assert.equal(claude(p), '', JSON.stringify(p));
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
    /^writeup:unslop flagged 1 pattern in an edit to README\.md:\n/,
  );
  assert.match(
    ctx('Write', { file_path: 'README.md', content: 'We delve.' }),
    /^writeup:unslop flagged 1 pattern in README\.md:\n/,
  );
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
