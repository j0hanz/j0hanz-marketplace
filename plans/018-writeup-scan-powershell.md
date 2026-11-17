# Plan 018: The writeup scan checks commit and PR text sent through PowerShell

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 08e36e3..HEAD -- plugins/writeup/hooks plugins/writeup/test`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `08e36e3`, 2026-11-17

## Why this matters

The writeup plugin's `PostToolUse` hook (`plugins/writeup/hooks/scan.mjs`) scans commit messages and `gh pr` bodies for AI writing patterns. Claude Code on Windows has a shell tool named `PowerShell` (capital P, S). The hook never matches that tool name and the script never treats it as a shell, so every commit made through it goes unscanned. The PowerShell tool's own guidance tells agents to pass commit messages as here-strings (`git commit -m @'` ... `'@`). The script's tokenizer does not know here-strings either. An apostrophe in the message ("don't") ends a quoted word early, and a `;` after it splits the command, so the rest of the message is never scanned. After this plan, PowerShell commits are scanned in full under Claude Code and Copilot.

## Current state

Files:

- `plugins/writeup/hooks/hooks.json`: Claude Code / Copilot hook registration.
- `plugins/writeup/hooks/scan.mjs`: the scanner; tokenizer at lines 81-120, target selection at lines 162-187.
- `plugins/writeup/test/scan.test.mjs`: `node:test` suite (38 tests, all pass at `08e36e3`).
- `plugins/writeup/hooks/client.mjs`: shared hook I/O. **Out of scope**: `scripts/validate.mjs` requires it to stay byte-identical across plugins.

`plugins/writeup/hooks/hooks.json:5`:

```json
        "matcher": "Write|Edit|Bash|create|edit|bash|powershell",
```

`plugins/writeup/hooks/client.mjs:17-35` maps Copilot's lowercase `powershell` to `Bash`, but has no entry for Claude's `PowerShell`, so `toolName()` returns `'PowerShell'` unchanged:

```js
const CLAUDE_TOOL = {
  ...
  bash: 'Bash',
  powershell: 'Bash',
  ...
};
export const toolName = (payload = {}) => {
  const name = String(payload.tool_name ?? payload.toolName ?? payload.toolCall?.name ?? '');
  return CLAUDE_TOOL[name] ?? name;
};
```

`plugins/writeup/hooks/scan.mjs:177`, the only shell branch in `targets`:

```js
  if (tool === 'Bash' && typeof command === 'string') {
```

Claude Code's `PowerShell` tool sends `tool_input: { command }`, the same shape as `Bash`, so `toolInput()` already returns `command` for it.

`plugins/writeup/hooks/scan.mjs:87` (the tokenizer regex; first alternative wins at a given position):

```js
const TOKEN = /"(?:\\[\s\S]|[^"\\])*"|'[^']*'|&&|\|\||[|;\n]|[^\s"'|;&]+/g;
```

`scan.mjs:1-4` header comment (update it in step 1):

```js
// fires:  PostToolUse on Write|Edit|Bash (Copilot: create|edit|bash|powershell; Antigravity:
//         write_file|edit_file|run_command). A Bash command is split at unquoted && || ; | and
//         newlines; each `git commit` or `gh pr create|edit|comment|review` segment is scanned
//         on its own. Nothing else fires.
```

PowerShell here-string syntax: `@'` or `@"` ends its line; the body runs until a line that starts with `'@` or `"@` at column 0. Single-quoted `@'...'@` is literal; double-quoted `@"..."@` expands variables. Either way, quotes inside the body do not end the string.

Observed at `08e36e3` (probe run during planning):

- `targets({tool_name:'PowerShell', tool_input:{command:'git commit -m "We delve"'}})` returns `[]`.
- For Copilot `powershell` with command `git commit -m @'\nfix: x\n\nDon't stop; we delve.\n'@`, the commit segment text ends at `Don't stop`, so `delve` is not reported.

Conventions: the file uses a terse comment above each regex or helper explaining _why_ (see the comments at `scan.mjs:81-86` and `122-123`). Tests run the hook as a subprocess through the `claude()` / `run()` helpers at `scan.test.mjs:72-75`; model new tests on `'chained git commit is scanned'` (line 95) and `'a bare heredoc on stdin is part of its segment, not new commands'` (line 310).

## Commands you will need

| Purpose      | Command                                          | Expected on success |
| :----------- | :----------------------------------------------- | :------------------ |
| Plugin tests | `node --test plugins/writeup/test/scan.test.mjs` | `fail 0`            |
| Full gate    | `npm run check`                                  | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `plugins/writeup/hooks/hooks.json`
- `plugins/writeup/hooks/scan.mjs`
- `plugins/writeup/test/scan.test.mjs`

**Out of scope**:

- `plugins/writeup/hooks/client.mjs` and every other plugin's `client.mjs`. Validate requires them identical; a `PowerShell` mapping there would be a cross-plugin change.
- `plugins/writeup/hooks.json` (Antigravity). Its matcher is `""`, and Antigravity has no PowerShell tool.
- `.claude-plugin/plugin.json` version. Fix commits in this plugin do not bump it.
- Plan 019's change to `commandKind`. Do not touch `commandKind` here.

## Git workflow

- Branch: `writeup/plan-018-powershell`
- One commit, conventional subject, e.g. `fix(writeup): scan commits sent through the PowerShell tool`. Body says the problem (PowerShell commits went unscanned; here-string messages were cut at the first `;` after an apostrophe).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Route Claude's `PowerShell` tool to the shell branch

1. In `hooks/hooks.json:5`, change the matcher to `"Write|Edit|Bash|PowerShell|create|edit|bash|powershell"`.
2. In `scan.mjs:177`, change the condition to `(tool === 'Bash' || tool === 'PowerShell') && typeof command === 'string'`.
3. In the header comment (`scan.mjs:1`), change `Write|Edit|Bash` to `Write|Edit|Bash|PowerShell`.

**Verify**: `node -e "import('./plugins/writeup/hooks/scan.mjs').then(m=>console.log(m.targets({tool_name:'PowerShell',tool_input:{command:'git commit -m \"We delve\"'}}).length))"` (from PowerShell, or write it to a file first if quoting breaks) → prints `1`.

### Step 2: Tokenize PowerShell here-strings as one word

In `scan.mjs:87`, put two here-string alternatives **first** in `TOKEN`:

```js
const TOKEN =
  /@'\r?\n[\s\S]*?\n'@|@"\r?\n[\s\S]*?\n"@|"(?:\\[\s\S]|[^"\\])*"|'[^']*'|&&|\|\||[|;\n]|[^\s"'|;&]+/g;
```

Add one comment line above the existing tokenizer comment block (lines 81-86), in the file's style, e.g. `// A PowerShell here-string (@' or @" to a line starting '@ or "@) is one word whatever quotes it holds.`

The word-unquoting at `scan.mjs:111` leaves a word that starts with `@` alone; that is fine, because words are only used to find `git commit` / `gh pr` and `-F`/`--body-file` values.

A planning probe confirmed this regex tokenizes `git commit -m @'\nfix: x\n\nDon't stop; we delve.\n'@; gh pr create --body "x"` into `git`, `commit`, `-m`, the whole here-string, `;`, `gh`, `pr`, `create`, `--body`, `"x"`.

**Verify**: `node --test plugins/writeup/test/scan.test.mjs` → `fail 0` (existing 38 tests unchanged).

### Step 3: Add tests

Append to `plugins/writeup/test/scan.test.mjs` (see Test plan). Use the existing `claude()` helper for Claude payloads and `run(payload, { ...process.env, COPILOT_PLUGIN_ROOT: 'x' })` for Copilot.

**Verify**: `node --test plugins/writeup/test/scan.test.mjs` → `fail 0`, test count 38 + the number you added.

### Step 4: Full gate

**Verify**: `npm run check` → exit 0.

## Test plan

New tests in `plugins/writeup/test/scan.test.mjs`:

1. **Claude PowerShell tool is scanned**: `claude({ tool_name: 'PowerShell', tool_input: { command: 'git commit -m "Delve in"' } })` parses to `hookSpecificOutput.additionalContext` matching `/rule 7 "Delve"/`.
2. **Here-string with apostrophe and `;` is scanned whole**: Copilot `powershell` payload, command `git commit -m @'\nfix: x\n\nDon't stop; we delve.\n'@`. Expect exactly one block (`additionalContext.split('\n\n').length === 1`) matching `/^writeup:unslop flagged 1 pattern in commit message:\n- rule 7 "delve" \(line 4\)/`. Line 4 is correct: the segment's line 1 is `git commit -m @'`.
3. **Here-string followed by a chained `gh pr create`**: Claude `PowerShell` payload, command `git commit -m @'\nfix: x\n\nIt's crucial.\n'@; gh pr create --body "I hope this helps"`. Expect two blocks: the first names `commit message` with rule 7 `"crucial"`, the second names `PR body` with rule 20.
4. **Double-quoted here-string**: command `git commit -m @"\nfix: x\n\nSay "hi"; we delve.\n"@` (JS string; escape the inner quotes). Expect one block with rule 7 `"delve"`.

## Done criteria

- [ ] `node --test plugins/writeup/test/scan.test.mjs` reports `fail 0` and at least 4 more tests than 38
- [ ] `npm run check` exits 0
- [ ] `git diff --name-only main` lists only the 3 in-scope files (plus `plans/README.md`)
- [ ] `grep -n "PowerShell" plugins/writeup/hooks/hooks.json plugins/writeup/hooks/scan.mjs` shows the matcher, the condition, and the header comment
- [ ] `plans/README.md` row 018 updated

## STOP conditions

- The excerpts above do not match the live files.
- `npm run check` fails in `validate` on the new matcher. That would mean validate enforces a matcher format this plan does not know. Report the message.
- Any existing test fails after step 2. The here-string alternatives must not change Bash tokenizing; a failure means they do.
- The fix seems to need a change to `client.mjs`.

## Maintenance notes

- If `client.mjs` ever gains `PowerShell: 'Bash'` in `CLAUDE_TOOL` (a cross-plugin change), the `|| tool === 'PowerShell'` in `scan.mjs` becomes dead and can go.
- Here-string bodies report line numbers counted from the `git commit -m @'` line, as heredoc messages already do. Message line N shows as line N+1.
- Still unhandled: PowerShell backtick escapes and `` `n `` inside double-quoted strings, and `--%` stop-parsing. These are rare in commit commands.
- Reviewer: check that the here-string alternatives are first in `TOKEN`; if they come after the catch-all word alternative, `@` is eaten as a word and the fix silently does nothing.
