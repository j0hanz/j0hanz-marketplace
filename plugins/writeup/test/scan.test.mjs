import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { findSlop, lintSubject, stripCode, RULES } from '../hooks/scan.mjs';

test('each rule flags its sample', () => {
  const samples = {
    7: 'We delve into it.',
    8: 'The file serves as an index.',
    13: 'Fast — and small.',
    17: '## Getting Started With Docker',
    18: '- Done 🎉',
    19: 'He said “hi”.',
    20: 'I hope this helps.',
    21: 'Great question.',
    23: 'In order to run it.',
    24: 'It could potentially fail.',
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
const gateRun = (payload, env = { ...process.env, COPILOT_PLUGIN_ROOT: '' }, args = []) =>
  execFileSync('node', [HOOK, 'gate', ...args], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env,
  });
// Runs fn with a unique session id and removes that session's gate state afterwards.
let gateN = 0;
const gated = (fn) => {
  const id = `gatetest-${process.pid}-${++gateN}`;
  try {
    return fn(id);
  } finally {
    rmSync(join(tmpdir(), `writeup-gate-${id}.txt`), { force: true });
  }
};
const bash = (command, extra = {}) => ({ tool_name: 'Bash', tool_input: { command }, ...extra });
const reasonOf = (out) => JSON.parse(out).hookSpecificOutput.permissionDecisionReason;
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
    tool_input: { command: 'git add -A && git commit -m "fix: delve into it"' },
  });
  assert.match(out, /An unpushed commit takes a new message with `git commit --amend`\./);
});
test('gh pr create is left to the gate, not the PostToolUse scan', () => {
  const command = 'gh pr create --body "I hope this helps"';
  assert.equal(claude(bash(command)), '');
  gated((session_id) => assert.match(reasonOf(gateRun(bash(command, { session_id }))), /PR body/));
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
test('gh pr comment and review are gated with their own labels', () => {
  const comment = 'gh pr comment 7 --body "Delve"';
  const review = 'gh pr review 7 --approve --body "Delve"';
  assert.equal(claude(bash(comment)), '');
  assert.equal(claude(bash(review)), '');
  gated((session_id) => {
    assert.match(reasonOf(gateRun(bash(comment, { session_id }))), /PR comment:.*did not run/s);
    assert.match(reasonOf(gateRun(bash(review, { session_id }))), /review body:.*did not run/s);
  });
  assert.equal(claude(bash('gh pr view 7')), '');
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
    const pr = `gh pr create --body-file "${join(dir, 'body.md')}"`;
    assert.equal(claude({ tool_name: 'Bash', tool_input: { command: pr }, cwd: dir }), '');
    gated((session_id) =>
      assert.match(
        reasonOf(gateRun({ ...bash(pr), cwd: dir, session_id })),
        /PR body \(.*body\.md\):\n- rule 20/,
      ),
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
test('a commit chained with gh pr: the scan reports the commit, the gate the PR body', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  try {
    writeFileSync(join(dir, 'body.md'), 'I hope this helps.\n');
    const command =
      'git commit -m "fix: delve" && git push && gh pr create -t t --body-file body.md';
    const ctx = JSON.parse(claude({ tool_name: 'Bash', tool_input: { command }, cwd: dir }))
      .hookSpecificOutput.additionalContext;
    assert.equal(ctx.split('\n\n').length, 1);
    assert.match(ctx, /^writeup:unslop flagged 1 pattern in commit message:\n- rule 7 "delve"/);
    assert.match(ctx, /git commit --amend/);
    gated((session_id) => {
      const pr = reasonOf(gateRun({ ...bash(command), cwd: dir, session_id }));
      assert.match(pr, /^writeup:unslop flagged 1 pattern in PR body \(body\.md\):\n- rule 20/);
      assert.doesNotMatch(pr, /commit message/);
    });
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
test('a bare heredoc on stdin is part of its segment, not new commands', () => {
  for (const open of [`<<'EOF'`, '<<EOF', '<<-"EOF"', '<< EOF']) {
    const command = `git commit -F - ${open}\nfix: x\n\nIt's crucial; gh pr create is quoted here.\nEOF\necho done`;
    const ctx = JSON.parse(claude({ tool_name: 'Bash', tool_input: { command } }))
      .hookSpecificOutput.additionalContext;
    assert.equal(ctx.split('\n\n').length, 1, open);
    assert.match(
      ctx,
      /^writeup:unslop flagged 1 pattern in commit message:\n- rule 7 "crucial" \(line 4\)/,
      open,
    );
  }
});
test('a heredoc opened before a commit belongs to its opener, not the commit', () => {
  const command = `cat <<'EOF' > notes.md && git commit -m "fix: ok"\nIt's crucial.\nEOF\necho done`;
  assert.equal(claude({ tool_name: 'Bash', tool_input: { command } }), '');
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

// Antigravity has no PostToolUse context channel, so a scan answers {} and its findings wait
// in a per-conversation state file; the deliver pass answers injectSteps once and spends it.
const agy = (payload, args = []) =>
  execFileSync('node', [HOOK, ...args], { input: JSON.stringify(payload), encoding: 'utf8' });
const agyState = (id) => join(tmpdir(), `writeup-unslop-${id}.txt`);

test('Antigravity: write_file findings wait in state and deliver once', () => {
  const id = `agytest${process.pid}`;
  try {
    assert.equal(
      agy(
        {
          conversationId: id,
          workspacePaths: [tmpdir()],
          toolCall: { name: 'write_file', args: { Path: 'docs/a.md', Content: 'We delve.' } },
        },
        ['--antigravity'],
      ),
      '{}',
    );
    const out = JSON.parse(agy({ conversationId: id }, ['deliver', '--antigravity']));
    assert.equal(out.injectSteps.length, 1);
    assert.match(
      out.injectSteps[0].ephemeralMessage,
      /^writeup:unslop flagged 1 pattern in docs\/a\.md:\n- rule 7 "delve" \(line 1\)\nA rewrite without these patterns passes the scan\.$/,
    );
    assert.equal(agy({ conversationId: id }, ['deliver', '--antigravity']), '{}');
  } finally {
    rmSync(agyState(id), { force: true });
  }
});

test('Antigravity: run_command CommandLine is scanned, its message file read from the workspace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  const id = `agytestcmd${process.pid}`;
  try {
    writeFileSync(join(dir, 'msg.txt'), 'fix: x\n\nWe delve here.\n');
    assert.equal(
      agy(
        {
          conversationId: id,
          workspacePaths: [dir],
          toolCall: { name: 'run_command', args: { CommandLine: 'git commit -F msg.txt' } },
        },
        ['--antigravity'],
      ),
      '{}',
    );
    const out = JSON.parse(agy({ conversationId: id }, ['deliver', '--antigravity']));
    assert.match(
      out.injectSteps[0].ephemeralMessage,
      /commit message \(msg\.txt\):\n- rule 7 "delve" \(line 3\)/,
    );
    assert.match(out.injectSteps[0].ephemeralMessage, /git commit --amend/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(agyState(id), { force: true });
  }
});

test('Antigravity: edit_file Replacement reads as an edit; a clean write leaves no state', () => {
  const id = `agytestedit${process.pid}`;
  const clean = `agytestclean${process.pid}`;
  try {
    agy(
      {
        conversationId: id,
        toolCall: {
          name: 'edit_file',
          args: { Path: 'README.md', Target: 'x', Replacement: 'We delve.' },
        },
      },
      ['--antigravity'],
    );
    const out = JSON.parse(agy({ conversationId: id }, ['deliver', '--antigravity']));
    assert.match(
      out.injectSteps[0].ephemeralMessage,
      /^writeup:unslop flagged 1 pattern in an edit to README\.md:\n- rule 7 "delve" \(line 1 of the edit\)/,
    );

    agy(
      {
        conversationId: clean,
        toolCall: { name: 'write_file', args: { Path: 'README.md', Content: 'Plain text.' } },
      },
      ['--antigravity'],
    );
    assert.equal(existsSync(agyState(clean)), false);
  } finally {
    rmSync(agyState(id), { force: true });
    rmSync(agyState(clean), { force: true });
  }
});

const multiReplace = (id, chunks) =>
  agy(
    {
      conversationId: id,
      workspacePaths: [tmpdir()],
      toolCall: {
        name: 'multi_replace_file_content',
        args: { TargetFile: 'docs/a.md', ReplacementChunks: chunks },
      },
    },
    ['--antigravity'],
  );

test('Antigravity: multi_replace_file_content chunks are scanned as one edit', () => {
  const id = `agytestmulti${process.pid}`;
  try {
    multiReplace(id, [{ ReplacementContent: 'Fine.' }, { ReplacementContent: 'We delve.' }]);
    const out = JSON.parse(agy({ conversationId: id }, ['deliver', '--antigravity']));
    assert.match(
      out.injectSteps[0].ephemeralMessage,
      /^writeup:unslop flagged 1 pattern in an edit to docs\/a\.md:\n- rule 7 "delve" \(line 2 of the edit\)/,
    );
  } finally {
    rmSync(agyState(id), { force: true });
  }
});

test('multi_replace without chunks stays silent', () => {
  const id = `agytestnochunks${process.pid}`;
  try {
    assert.equal(multiReplace(id, 'oops'), '{}');
    assert.equal(agy({ conversationId: id }, ['deliver', '--antigravity']), '{}');
  } finally {
    rmSync(agyState(id), { force: true });
  }
});

test('deliver leaves no temp file behind', () => {
  const id = `agytestdrain${process.pid}`;
  try {
    agy(
      {
        conversationId: id,
        toolCall: { name: 'write_file', args: { Path: 'docs/a.md', Content: 'We delve.' } },
      },
      ['--antigravity'],
    );
    agy({ conversationId: id }, ['deliver', '--antigravity']);
    assert.equal(agy({ conversationId: id }, ['deliver', '--antigravity']), '{}');
    assert.deepEqual(
      readdirSync(tmpdir()).filter((f) => f.startsWith(`writeup-unslop-${id}`)),
      [],
    );
  } finally {
    rmSync(agyState(id), { force: true });
  }
});

test('GEMINI.md is agent-facing and stays quiet', () => {
  assert.equal(
    claude({ tool_name: 'Write', tool_input: { file_path: 'GEMINI.md', content: 'We delve.' } }),
    '',
  );
});

test('Antigravity: garbage on stdin still answers {}', () => {
  assert.equal(
    execFileSync('node', [HOOK, '--antigravity'], { input: 'not json', encoding: 'utf8' }),
    '{}',
  );
});

const copilot = (payload) => run(payload, { ...process.env, COPILOT_PLUGIN_ROOT: 'x' });
test('sentence-case headings with proper nouns are not title case', () => {
  assert.deepEqual(findSlop('## Installing Claude Code'), []);
  assert.deepEqual(findSlop('# Getting Started'), []);
  assert.deepEqual(
    findSlop('## Using GitHub Copilot With Claude Code').map((h) => h.id),
    [17],
  );
});
test('landscape flags only as "landscape of"', () => {
  assert.deepEqual(findSlop('Rotate to landscape orientation.'), []);
  assert.deepEqual(
    findSlop('The landscape of AI tools shifts.').map((h) => h.id),
    [7],
  );
});
test('git global options before commit are skipped', () => {
  for (const command of [
    'git -C ../wt commit -m "Delve"',
    'git -c commit.gpgsign=false commit -m "Delve"',
    'git --no-pager -C . commit -m "Delve"',
    'git --git-dir=.git commit -m "Delve"',
  ]) {
    const out = claude({ tool_name: 'Bash', tool_input: { command } });
    assert.notEqual(out, '', command);
    assert.match(out, /rule 7/, command);
  }
  for (const command of ['git -C commit log', 'git --no-pager log --grep commit'])
    assert.equal(claude({ tool_name: 'Bash', tool_input: { command } }), '', command);
});
test('Claude PowerShell tool is scanned', () => {
  const out = JSON.parse(
    claude({ tool_name: 'PowerShell', tool_input: { command: 'git commit -m "Delve in"' } }),
  );
  assert.match(out.hookSpecificOutput.additionalContext, /rule 7 "Delve"/);
});
test('here-string with apostrophe and semicolon is scanned whole', () => {
  const out = JSON.parse(
    copilot({
      toolName: 'powershell',
      toolArgs: { command: "git commit -m @'\nfix: x\n\nDon't stop; we delve.\n'@" },
    }),
  );
  assert.equal(out.additionalContext.split('\n\n').length, 1);
  assert.match(
    out.additionalContext,
    /^writeup:unslop flagged 1 pattern in commit message:\n- rule 7 "delve" \(line 4\)/,
  );
});
test('here-string followed by a chained gh pr create', () => {
  const out = JSON.parse(
    claude({
      tool_name: 'PowerShell',
      tool_input: {
        command:
          "git commit -m @'\nfix: x\n\nIt's crucial.\n'@; gh pr create --body \"I hope this helps\"",
      },
    }),
  );
  const blocks = out.hookSpecificOutput.additionalContext.split('\n\n');
  assert.equal(blocks.length, 1);
  assert.match(blocks[0], /commit message[\s\S]*rule 7 "crucial"/);
  gated((session_id) =>
    assert.match(
      reasonOf(
        gateRun({
          tool_name: 'PowerShell',
          session_id,
          tool_input: {
            command:
              "git commit -m @'\nfix: x\n\nIt's crucial.\n'@; gh pr create --body \"I hope this helps\"",
          },
        }),
      ),
      /PR body[\s\S]*rule 20/,
    ),
  );
});
test('double-quoted here-string is scanned whole', () => {
  const out = JSON.parse(
    claude({
      tool_name: 'PowerShell',
      tool_input: { command: 'git commit -m @"\nfix: x\n\nSay "hi"; we delve.\n"@' },
    }),
  );
  const ctx = out.hookSpecificOutput.additionalContext;
  assert.equal(ctx.split('\n\n').length, 1);
  assert.match(ctx, /rule 7 "delve"/);
});

const ctxOf = (command, cwd) => claude({ tool_name: 'Bash', tool_input: { command }, cwd });
test('lintSubject reports each reason', () => {
  assert.deepEqual(lintSubject('feat(api): add x'), []);
  assert.deepEqual(lintSubject('feat(api)!: drop v1'), []);
  const long = `feat: ${'x'.repeat(74)}`;
  assert.deepEqual(
    lintSubject(long).map((h) => h.match),
    ['80 chars, limit 72'],
  );
  assert.deepEqual(
    lintSubject('feat: add x.').map((h) => h.match),
    ['ends in a period'],
  );
  assert.deepEqual(
    lintSubject('Add x').map((h) => h.match),
    ['not in type(scope): summary form'],
  );
  assert.deepEqual(
    lintSubject('feature: add x').map((h) => h.match),
    ['unknown type "feature"'],
  );
});
test('git-generated subjects are skipped', () => {
  assert.deepEqual(lintSubject('fixup! feat: x'), []);
  assert.deepEqual(lintSubject('Revert "feat: x"'), []);
});
test('a -m subject with a period is flagged', () => {
  assert.match(ctxOf('git commit -m "Fixed it."'), /- commit subject: ends in a period/);
});
test('-am is read as a message flag', () => {
  assert.match(ctxOf('git commit -am "Fixed it."'), /- commit subject: ends in a period/);
});
test('a clean heredoc commit passes', () => {
  const command = `git commit -m "$(cat <<'EOF'\nfix(x): handle y\n\nBody line.\nEOF\n)"`;
  assert.equal(ctxOf(command), '');
});
test('a PowerShell here-string subject is read past its wrapper', () => {
  const out = ctxOf("git commit -m @'\nFixed it.\n'@");
  assert.match(out, /- commit subject: ends in a period/);
  assert.doesNotMatch(out, /@/); // the wrapper opener is not the subject
});
test('the first line of a -F file is the subject', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  try {
    writeFileSync(join(dir, 'msg.txt'), 'wip\n');
    assert.match(ctxOf('git commit -F msg.txt', dir), /not in type\(scope\): summary form/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('the subject check is commit-only', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  try {
    writeFileSync(join(dir, 'body.md'), 'Add x.\nWe delve.\n');
    const out = gated((session_id) =>
      reasonOf(gateRun({ ...bash('gh pr create --body-file body.md'), cwd: dir, session_id })),
    );
    assert.match(out, /rule 7/);
    assert.doesNotMatch(out, /commit subject/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('rules 21 and 24 do not hit lookalikes', () => {
  assert.deepEqual(findSlop('It may possibly work. The server is right.'), []);
});

const SLOP = 'gh pr create --body "We delve."';
test('gate: slop body is denied with the rule and the ending', () =>
  gated((session_id) => {
    const out = JSON.parse(
      gateRun(bash('gh pr create --body "I hope this helps"', { session_id })),
    );
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /rule 20/);
    assert.match(out.hookSpecificOutput.permissionDecisionReason, /The command did not run\./);
  }));
test('gate: the identical resubmission passes', () =>
  gated((session_id) => {
    assert.notEqual(gateRun(bash(SLOP, { session_id })), '');
    assert.equal(gateRun(bash(SLOP, { session_id })), '');
  }));
test('gate: a different slop body in the same session is denied again', () =>
  gated((session_id) => {
    assert.notEqual(gateRun(bash(SLOP, { session_id })), '');
    assert.match(
      reasonOf(gateRun(bash('gh pr create --body "We delve deeper."', { session_id }))),
      /rule 7/,
    );
  }));
test('gate: a clean body passes', () =>
  gated((session_id) =>
    assert.equal(gateRun(bash('gh pr create --body "Fix the parser."', { session_id })), ''),
  ));
test('gate: gh issue create and comment are denied', () =>
  gated((session_id) => {
    for (const c of ['gh issue create --body "We delve."', 'gh issue comment 3 --body "We delve."'])
      assert.match(reasonOf(gateRun(bash(c, { session_id }))), /rule 7/, c);
  }));
test('gate: commits are never gated; the scan still reports them', () =>
  gated((session_id) => {
    const commit = bash('git commit -m "fix: we delve"');
    assert.equal(gateRun({ ...commit, session_id }), '');
    assert.match(claude(commit), /rule 7/);
  }));
test('gate: Copilot without a session id denies once per repo', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'writeup-'));
  const env = { ...process.env, COPILOT_PLUGIN_ROOT: '1' };
  const payload = { toolName: 'bash', toolArgs: { command: SLOP }, cwd };
  try {
    assert.equal(JSON.parse(gateRun(payload, env)).permissionDecision, 'deny');
    assert.equal(gateRun(payload, env), '');
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    for (const f of readdirSync(tmpdir()))
      if (f.startsWith('writeup-gate-') && f.includes(cwd.split(/[\\/]/).pop()))
        rmSync(join(tmpdir(), f), { force: true });
  }
});
test('gate: Antigravity answers deny, allow, and allow on garbage', () => {
  const id = `gateagy${process.pid}`;
  const env = { ...process.env };
  const args = ['--antigravity'];
  try {
    const call = (name, a) => ({ conversationId: id, toolCall: { name, args: a } });
    assert.equal(
      JSON.parse(gateRun(call('run_command', { CommandLine: SLOP }), env, args)).decision,
      'deny',
    );
    assert.equal(
      gateRun(call('write_file', { Path: 'a.md', Content: 'We delve.' }), env, args),
      '{"decision":"allow"}',
    );
    const garbage = execFileSync('node', [HOOK, 'gate', ...args], {
      input: 'not json',
      encoding: 'utf8',
    });
    assert.equal(garbage, '{"decision":"allow"}');
  } finally {
    rmSync(join(tmpdir(), `writeup-gate-${id}.txt`), { force: true });
  }
});
test('gate: Claude garbage stdin prints nothing and exits 0', () => {
  assert.equal(
    execFileSync('node', [HOOK, 'gate'], {
      input: 'not json',
      encoding: 'utf8',
      env: { ...process.env, COPILOT_PLUGIN_ROOT: '' },
    }),
    '',
  );
});
test('gate: a --body-file with slop is denied and the block names the file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  try {
    writeFileSync(join(dir, 'body.md'), 'ok\nWe delve.\n');
    gated((session_id) =>
      assert.match(
        reasonOf(
          gateRun({ ...bash(`gh pr create --body-file "${join(dir, 'body.md')}"`), session_id }),
        ),
        /body\.md/,
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('gate: gh constructor name is not a command', () =>
  gated((session_id) =>
    assert.equal(gateRun(bash('gh constructor name --body "We delve."', { session_id })), ''),
  ));
test('a line continuation keeps the next line in its command', () => {
  for (const [tool_name, command] of [
    ['Bash', 'gh pr create \\\n  --title t \\\n  --body "We delve."'],
    ['Bash', 'gh pr create \\\r\n  --body "We delve."'],
    ['PowerShell', 'gh pr create `\n  --title t `\n  --body "We delve."'],
  ])
    gated((session_id) =>
      assert.match(
        reasonOf(gateRun({ tool_name, tool_input: { command }, session_id })),
        /PR body:\n- rule 7 "delve"/,
        command,
      ),
    );
});
test('a continued git commit reads its -F file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'writeup-'));
  try {
    writeFileSync(join(dir, 'msg.txt'), 'fix: x\n\nWe delve.\n');
    const ctx = JSON.parse(ctxOf('git commit \\\n  -F msg.txt', dir)).hookSpecificOutput
      .additionalContext;
    assert.match(ctx, /commit message \(msg\.txt\):\n- rule 7 "delve"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test('a newline without a continuation still ends the command', () =>
  gated((session_id) =>
    assert.match(
      reasonOf(
        gateRun(bash('git commit -m "fix: x"\ngh pr create --body "We delve."', { session_id })),
      ),
      /PR body:\n- rule 7 "delve"/,
    ),
  ));

test('the issue skill shows error text in a fence, not an indented block', () => {
  const skill = readFileSync(new URL('../skills/issue/SKILL.md', import.meta.url), 'utf8');
  assert.doesNotMatch(skill, /^ {4}\S/m);
  assert.match(skill, /^````text$/m);
});
