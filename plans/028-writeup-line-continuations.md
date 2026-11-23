# Plan 028: The writeup scan and gate read a command continued across lines as one command

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fc5a197..HEAD -- plugins/writeup/hooks/scan.mjs plugins/writeup/test/scan.test.mjs`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `fc5a197`, 2026-11-23

## Why this matters

The writeup plugin has a PreToolUse "gate" that denies a `gh pr create`, `gh issue create`, `gh pr comment` or `gh pr review` command once when its body contains AI-slop patterns, and a PostToolUse scan that reports slop in `git commit` messages. Both split a shell command into separate commands at every newline. A command written across lines with a bash `\` line continuation (or a PowerShell backtick continuation) is therefore cut into pieces: the `gh pr create \` piece is found, but the `--body "..."` or `--body-file x.md` on the following lines lands in a different piece that is never scanned. Measured at `fc5a197`: `gh pr create \` + newline + `--body "Additionally, this is crucial."` is **allowed** by the gate, while the same command on one line is **denied**. Agents write multi-line `gh` commands often, so the gate silently misses a common form. After this plan, a line ending in an unquoted `\` or `` ` `` joins the next line into the same command.

## Current state

Files:

- `plugins/writeup/hooks/scan.mjs`: the hook. `parse` (lines 145-176) splits a command into segments of words using the `TOKEN` regex (lines 142-143). `targets` (lines 253-281) turns each segment into a scan target. `gate` (lines 298-314) is the PreToolUse mode.
- `plugins/writeup/test/scan.test.mjs`: `node:test` suite, 65 tests at `fc5a197`, all passing.

Header comment, `scan.mjs:1-4`:

```js
// fires:  PostToolUse on Write|Edit|Bash|PowerShell (Copilot: create|edit|bash|powershell;
//         Antigravity: write_file|edit_file|run_command). A Bash command is split at unquoted
//         && || ; | and newlines; each `git commit` or `gh pr|issue create|edit|comment|review`
//         segment is scanned on its own. Nothing else fires.
```

Tokenizer comment and regex, `scan.mjs:135-143`:

```js
// Shell words and segments, quote-aware: a quoted string is one word, so a `--file` inside an
// -m message is text, not a flag. A PowerShell here-string (@' or @" to a line starting '@ or
// "@) is one word whatever quotes it holds. Segments split at unquoted && || ; | and newlines,
// so a `gh pr create` chained after `git commit` is its own target. A bare heredoc body
// (`-F - <<EOF`) stays in its segment untokenized, up to the delimiter line; a body whose
// opener sits in an earlier segment is skipped. ponytail: one heredoc per line; a second `<<`
// on the same line replaces the first.
const TOKEN =
  /@'\r?\n[\s\S]*?\n'@|@"\r?\n[\s\S]*?\n"@|"(?:\\[\s\S]|[^"\\])*"|'[^']*'|&&|\|\||[|;\n]|[^\s"'|;&]+/g;
```

The separator branch inside `parse`, `scan.mjs:162-166`:

<!-- prettier-ignore -->
```js
    if (/^(?:&&|\|\||[|;\n])$/.test(m[0])) {
      segments.at(-1).end = m.index;
      segments.push({ start: m.index + m[0].length, words: [] });
      continue;
    }
```

Why it fails: the last alternative `[^\s"'|;&]+` matches a lone `\` (or `` ` ``) as a word, then `[|;\n]` matches the newline and starts a new segment.

Test conventions (match them): tests are flat `test('sentence', () => ...)` calls with `assert` from `node:assert/strict`. Helpers already defined in the file and used below: `gated(fn)` (runs `fn(session_id)` with a fresh session id and deletes its gate state afterwards), `gateRun(payload)` (runs `scan.mjs gate` in a child process as Claude Code), `reasonOf(out)` (parses the deny reason), `bash(command, extra)` (builds a Bash payload), `ctxOf(command, cwd)` (runs the PostToolUse scan as Claude Code and returns raw stdout, a JSON string). Exemplar: the test `'gate: a --body-file with slop is denied and the block names the file'` near the end of the file.

## Commands you will need

| Purpose       | Command                                                                                  | Expected on success                          |
| ------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| Writeup tests | `node --test plugins/writeup/test/`                                                      | `ℹ fail 0`                                   |
| Lint          | `npx eslint plugins/writeup`                                                             | exit 0, no output                            |
| Format        | `npx prettier --write plugins/writeup/hooks/scan.mjs plugins/writeup/test/scan.test.mjs` | rewrites in place                            |
| Format check  | `npx prettier --check plugins/writeup`                                                   | `All matched files use Prettier code style!` |
| Full gate     | `npm run check`                                                                          | exit 0 (see STOP conditions)                 |

## Scope

**In scope** (the only files you should modify):

- `plugins/writeup/hooks/scan.mjs`: the `TOKEN` regex, one new line in `parse`, and two comments.
- `plugins/writeup/test/scan.test.mjs`: three new tests appended at the end.
- `plans/README.md`: this plan's status row.

**Out of scope** (do NOT touch):

- `plugins/writeup/hooks/client.mjs`: shared byte-for-byte with other plugins; `npm run validate` fails if it differs.
- `.claude-plugin/plugin.json` and `.antigravity-plugin/plugin.json` versions: the maintainer bumps versions in separate commits.
- The heredoc handling in `parse` (the `if (m[0] === '\n' && heredoc)` block): unchanged.
- Any other `scan.mjs` behavior (rules, `messageFile`, `subjectOf`, `commandKind`), even if it looks improvable.

## Git workflow

- Branch: `writeup/plan-028-line-continuations`.
- One commit. Conventional subject scoped to the plugin, matching `git log`, e.g. `fix(writeup): scan gh and git commands continued across lines`. Use the `writeup:commit` skill if available.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the three tests first and watch two fail

Append these tests at the end of `plugins/writeup/test/scan.test.mjs`, exactly:

```js
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
```

(In the JS source, `'\\\n'` is a backslash followed by a newline, which is what a bash continuation looks like.)

**Verify**: `node --test plugins/writeup/test/` → `ℹ pass 66`, `ℹ fail 2`; the two failures are `a line continuation keeps the next line in its command` and `a continued git commit reads its -F file`. The third new test passes already (it guards against over-joining).

### Step 2: Teach `TOKEN` and `parse` the continuation

In `scan.mjs`, replace the `TOKEN` regex (lines 142-143) with:

```js
const TOKEN =
  /[\\`]\r?\n|@'\r?\n[\s\S]*?\n'@|@"\r?\n[\s\S]*?\n"@|"(?:\\[\s\S]|[^"\\])*"|'[^']*'|&&|\|\||[|;\n]|(?:[^\s"'|;&\\`]|[\\`](?!\r?\n))+/g;
```

Two changes: a new first alternative ``[\\`]\r?\n`` matches a backslash or backtick directly followed by a line break; and the bare-word alternative no longer swallows a `\` or `` ` `` that is followed by a line break (``[\\`](?!\r?\n)`` still lets those characters appear inside a word otherwise, so `foo\bar` and `C:\dir` stay one word as before).

In `parse`, add one line directly above the separator branch quoted in "Current state":

<!-- prettier-ignore -->
```js
    if (/^[\\`]\r?\n$/.test(m[0])) continue; // line continuation: same segment, no word
    if (/^(?:&&|\|\||[|;\n])$/.test(m[0])) {
```

**Verify**: `node --test plugins/writeup/test/` → `ℹ pass 68`, `ℹ fail 0`.

### Step 3: Update the two comments

- `scan.mjs:2-3` header: change the text `A Bash command is split at unquoted && || ; | and newlines;` so it reads as in the block below. Keep the comment wrapped to the file's ~100-column width.
- Tokenizer comment above `TOKEN`: after the sentence that ends "is its own target.", insert the sentence shown in the block below.

```text
header:    A Bash command is split at unquoted && || ; | and newlines (a line ending in \ or ` continues);
tokenizer: A line ending in an unquoted \ (bash) or ` (PowerShell) continues onto the next, so a multi-line command stays one segment.
```

**Verify**: `git diff --stat` → only `plugins/writeup/hooks/scan.mjs` and `plugins/writeup/test/scan.test.mjs` changed.

### Step 4: Format and lint

Run the Format command from the table, then the Format check and Lint commands.

**Verify**: `npx prettier --check plugins/writeup` → `All matched files use Prettier code style!`; `npx eslint plugins/writeup` → exit 0. Then `node --test plugins/writeup/test/` → `ℹ fail 0` again.

## Test plan

- New, in `plugins/writeup/test/scan.test.mjs` (Step 1): bash `\` continuation with LF and with CRLF, PowerShell backtick continuation, all denied by the gate with rule 7; a `git commit \` + `-F msg.txt` on the next line reads the file in the PostToolUse scan; a plain newline still separates two commands (regression guard against over-joining).
- Pattern: the existing gate tests near the end of the file.
- Verification: `node --test plugins/writeup/test/` → 68 pass, 0 fail.

## Done criteria

- [ ] `node --test plugins/writeup/test/` prints `ℹ pass 68` and `ℹ fail 0`
- [ ] `npx eslint plugins/writeup` exits 0
- [ ] `npx prettier --check plugins/writeup` exits 0
- [ ] `npm run check` exits 0, or fails only on checks outside `plugins/writeup` that also fail on `main` at `fc5a197` (record which in the status row)
- [ ] `git diff --name-only main` lists only `plugins/writeup/hooks/scan.mjs`, `plugins/writeup/test/scan.test.mjs`, `plans/README.md`
- [ ] `plans/README.md` row 028 updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `TOKEN` regex or the separator branch in `parse` does not match the "Current state" excerpts.
- After Step 2, any of the 65 pre-existing tests fails. The heredoc and here-string tests are the likely ones; do not edit them to make them pass.
- The fix seems to need a change to `client.mjs`, `commandKind`, `messageFile` or the heredoc block.
- `npm run check` fails on something under `plugins/writeup` that Steps 1-4 did not touch.

## Maintenance notes

- In PowerShell, `\` is not a continuation character. A PowerShell line that ends in a backslash (for example a path like `C:\repo\` at end of line) now joins the next line into its segment. The effect is limited to extra text in one scan target; it can never hide a body, which is the failure this plan fixes. Accepted.
- A bash backtick followed by a newline would be an unclosed command substitution, so treating it as a continuation never splits a valid bash command wrongly.
- A heredoc opener line that itself ends in a continuation (`cat <<EOF \`) is not handled specially; the heredoc block in `parse` only triggers on a `\n` token. Not seen in practice.
- Reviewers: check that the new first alternative in `TOKEN` sits before the string alternatives is harmless (a quoted string starts with a quote, never `\` or `` ` ``), and that the three new tests fail on `main`.
