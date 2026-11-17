# Plan 026: The writeup scan stops slop before a `gh` command publishes it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b9a98ef -- plugins/writeup/hooks/scan.mjs plugins/writeup/hooks/hooks.json plugins/writeup/hooks.json plugins/writeup/test/scan.test.mjs`
> Plan 025 is expected to have landed first: it adds rules 8, 21, 24 to `RULES`, a `lintSubject`/`subjectOf` pair, a `subject` field on commit targets, and a `commit subject` line in `message`. Those changes are expected. Any other change to `targets`, `commandKind`, `GH`, `ENDING`, the main block, or either `hooks.json` is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (a PreToolUse hook that crashes denies the tool under Copilot and Antigravity)
- **Depends on**: plans/025-writeup-scan-rules-and-subject.md (soft: same file; run 025 first to avoid conflicts)
- **Category**: direction
- **Planned at**: commit `b9a98ef`, 2026-11-17

## Why this matters

The writeup scan runs on PostToolUse. For `gh pr create`, `gh pr comment` and the rest, the findings arrive after the text is already public on GitHub, and the fix is a second edit that people may already have read or been notified about. This plan adds a PreToolUse **gate**: before a public `gh` write runs, the same scan checks the body, and if it finds hits the hook denies the command and lists them. The agent then rewrites the text and runs the command again. A false positive must never trap the agent, so the gate denies a given text only once: an unchanged resubmission passes. Local `git commit` keeps the current PostToolUse advice, because amending an unpushed commit is cheap.

The maintainer decided (2026-11-17):

- Gate all public `gh` writes: `gh pr create|edit|comment|review` and `gh issue create|edit|comment`.
- Escape: deny once per exact body; the identical resubmission passes.
- Drop the PostToolUse report for gated commands (the gate already reported). PostToolUse keeps scanning Markdown files and commit messages.
- Commit messages are never gated.

## Current state

- `plugins/writeup/hooks/scan.mjs` (line numbers here are at `b9a98ef`; plan 025 shifts them, so find each block by its name): the hook. Header comment (lines 1-14) documents fires/reads/emits/fails. `ENDING` (lines 75-81) maps target kind to the closing sentence. `GH` (lines 144-149) maps a `gh pr` subcommand to `[kind, label]`. `commandKind(words)` (lines 157-164) finds `git ... commit` or `gh pr <sub>` in one segment's words. `targets(payload)` (lines 174-199) yields `{ kind, name, text }` per scanned thing. Main block (lines 212-228) dispatches on `process.argv[2]`: `deliver` drains Antigravity advisories, otherwise it scans and parks.
- Excerpt, `scan.mjs:144-164`:

```js
const GH = {
  create: ['pr', 'PR body'],
  edit: ['pr', 'PR body'],
  comment: ['comment', 'PR comment'],
  review: ['review', 'review body'],
};
// ...
const commandKind = (words) => {
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === 'git' && gitSubcommand(words, i) === 'commit')
      return ['commit', 'commit message'];
    if (words[i] === 'gh' && words[i + 1] === 'pr' && GH[words[i + 2]]) return GH[words[i + 2]];
  }
  return null;
};
```

- Excerpt, main block `scan.mjs:212-228`:

```js
if (basename(process.argv[1] ?? '') === 'scan.mjs') {
  try {
    const payload = JSON.parse((await readText(process.stdin)) || '{}');
    if (process.argv[2] === 'deliver') {
      process.stdout.write(drainAdvisory(PLUGIN_KEY, payload));
    } else {
      const blocks = targets(payload).flatMap((t) => {
        /* findSlop -> message */
      });
      process.stdout.write(parkAdvisory(PLUGIN_KEY, payload, blocks.join('\n\n')));
    }
  } catch {
    process.stdout.write(pass());
  }
}
```

- `plugins/writeup/hooks/client.mjs` (shared, read-only for you) already exports what the gate needs:
  - `allow()`: `'{"decision":"allow"}'` on Antigravity, `''` elsewhere. **Antigravity denies a tool when a PreToolUse hook prints nothing**, so every non-deny path, including the `catch`, must print `allow()`.
  - `deny(reason)`: the right deny JSON for Claude Code (`hookSpecificOutput.permissionDecision`), Copilot (flat `permissionDecision`) and Antigravity (`{decision:'deny', reason}`).
  - `stateFile(prefix, payload, fallback, ext)`: `tmpdir()/<prefix>-<session id>.<ext>`, the per-session temp file. `sessionId` reads `payload.session_id` (Claude Code) or `payload.conversationId` (Antigravity), else `fallback`. Copilot's PreToolUse payload has no confirmed session field, so pass `workspace(payload)` as `fallback`: without a session id, the state is then per repo, not machine-wide.
- `plugins/writeup/hooks/hooks.json` (Claude Code and Copilot): today only a `PostToolUse` entry, matcher `Write|Edit|Bash|PowerShell|create|edit|bash|powershell`, with a `command` and a `powershell` twin.
- `plugins/writeup/hooks.json` (Antigravity, repo root of the plugin): `PostToolUse` with `matcher: ""` running `node ./hooks/scan.mjs --antigravity`, and `PreInvocation` running `scan.mjs deliver --antigravity`.
- Exemplar PreToolUse hook in this repo: `plugins/workbench/hooks/gate.mjs` (prints `allow()` or `deny(reason)`), wired in `plugins/workbench/hooks/hooks.json` lines 15-25 (the `Write|create` entry). Match its shape.
- Repo rules from `CLAUDE.md`: under Copilot a PreToolUse hook that crashes or exits non-zero denies the tool; every `node` hook `command` has a `powershell` twin using `$env:CLAUDE_PLUGIN_ROOT`; tool matchers name both spellings.

## Commands you will need

| Purpose       | Command                                | Expected on success                                                                                |
| ------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Writeup tests | `node --test plugins/writeup/test/`    | all pass                                                                                           |
| All tests     | `npm test`                             | all pass                                                                                           |
| Lint, format  | `npm run lint && npm run format:check` | exit 0                                                                                             |
| Validate      | `npm run validate`                     | writeup checks pass (a pre-existing telltale failure is known; see `plans/README.md` rows 021-024) |

Run from `C:/j0hanz-marketplace`.

## Scope

**In scope**:

- `plugins/writeup/hooks/scan.mjs`
- `plugins/writeup/hooks/hooks.json`
- `plugins/writeup/hooks.json`
- `plugins/writeup/test/scan.test.mjs`

**Out of scope**:

- `plugins/writeup/hooks/client.mjs`: shared byte-identical across plugins. If you think it needs a change, STOP.
- Any other plugin.
- Skills and manifests (plan 027 adds skills and bumps the version).
- Gating `git commit` or `git push`.

## Git workflow

- Branch: `writeup/plan-026-gh-gate`.
- One or two commits, e.g. `feat(writeup): gate public gh writes before they publish`.
- Do not push or open a PR.

## Steps

### Step 1: Recognize `gh issue` commands

Split `GH` into per-group maps and extend `commandKind`:

```js
const GH = {
  pr: {
    create: ['pr', 'PR body'],
    edit: ['pr', 'PR body'],
    comment: ['comment', 'PR comment'],
    review: ['review', 'review body'],
  },
  issue: {
    create: ['issue', 'issue body'],
    edit: ['issue', 'issue body'],
    comment: ['comment', 'issue comment'],
  },
};
// in commandKind:
const group = words[i] === 'gh' && Object.hasOwn(GH, words[i + 1]) ? GH[words[i + 1]] : null;
if (group && Object.hasOwn(group, words[i + 2])) return group[words[i + 2]];
```

`Object.hasOwn` keeps prototype names out: `gh constructor name` must not match.

`messageFile` already reads `-F`/`--body-file`, which `gh issue` uses too.

**Verify**: `node --test plugins/writeup/test/` → all pass.

### Step 2: Add the gate mode

In `scan.mjs`:

1. `const GATED = new Set(['pr', 'comment', 'review', 'issue']);`
2. Replace the `pr`, `comment` and `review` values in `ENDING`, and add `issue`, all with one shared sentence (facts, not orders, per the comment above `ENDING`):
   `'The command did not run. The same text sent again unchanged runs; a rewrite without these patterns passes the scan.'`
3. Import `allow`, `deny`, `stateFile` from `./client.mjs`, and `createHash` from `node:crypto`; add `appendFileSync` to the `node:fs` import.
4. Export `gate(payload)` returning the stdout string:
   - `blocked` = `targets(payload)` filtered to `GATED.has(t.kind)`, each paired with its `findSlop(t.text)` hits, keeping those with hits.
   - For each, `hash = createHash('sha256').update(t.text).digest('hex')`. Read the state file `stateFile('writeup-gate', payload, workspace(payload))` (missing file = no hashes). Drop targets whose hash is already listed.
   - None left → `return allow()`.
   - Else append each remaining target's hash plus `\n` to the state file, and `return deny(blocks.join('\n\n'))`, where blocks come from `message(t, hits)` for the remaining targets only. A target already seen is left out of the deny text.
5. Main block. Today `JSON.parse` runs before any dispatch, and its `catch` prints `pass()`, which is `{}` on Antigravity. Antigravity reads `{}` at PreToolUse as a deny, so bad input there would block every tool. Restructure so the gate owns its own parse:

   ```js
   if (basename(process.argv[1] ?? '') === 'scan.mjs') {
     const raw = await readText(process.stdin).catch(() => '');
     if (process.argv[2] === 'gate') {
       try {
         process.stdout.write(gate(JSON.parse(raw || '{}')));
       } catch {
         process.stdout.write(allow()); // fail open: a crash must never deny the tool
       }
     } else {
       try {
         const payload = JSON.parse(raw || '{}');
         // ... existing deliver / scan branches, unchanged ...
       } catch {
         process.stdout.write(pass());
         // fail open: never block a tool on a reflective hook
       }
     }
   }
   ```

6. Post-scan branch: filter `targets(payload)` to `!GATED.has(t.kind)` before scanning, so gated commands are reported only by the gate.
7. Header comment: add that `scan.mjs gate` is the PreToolUse mode for public `gh` writes, and that it denies once per exact body hash per session (per repo when the client sends no session id). Rewrite the `fails:` line, since "never blocks" is no longer true: `fails:  any parse or read error -> exit 0; the scan prints nothing, the gate answers allow`.

**Verify**: `node --test plugins/writeup/test/` → the five tests listed in step 4 now FAIL: three `gh`-only tests and two commit+`gh` chains (lines 280 and 565 at `b9a98ef`). That is expected; step 4 converts them. Every other test passes.

### Step 3: Wire the hook for all three clients

`plugins/writeup/hooks/hooks.json`: add a `PreToolUse` key before `PostToolUse`:

```json
"PreToolUse": [
  {
    "matcher": "Bash|PowerShell|bash|powershell",
    "hooks": [
      {
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/scan.mjs\" gate",
        "powershell": "node \"$env:CLAUDE_PLUGIN_ROOT/hooks/scan.mjs\" gate",
        "timeout": 10
      }
    ]
  }
],
```

`plugins/writeup/hooks.json` (Antigravity): add, next to `PostToolUse` and in the same shape:

```json
"PreToolUse": [
  {
    "matcher": "",
    "hooks": [
      { "type": "command", "command": "node ./hooks/scan.mjs gate --antigravity", "timeout": 10 }
    ]
  }
],
```

**Verify**: `npm run validate` → no writeup failures. If `agy` is on PATH, validate runs `agy plugin validate` too; a rejection of the `PreToolUse` shape is a STOP condition.

### Step 4: Tests

Add a helper next to `claude()` in `scan.test.mjs`:

```js
const gateRun = (payload, env = { ...process.env, COPILOT_PLUGIN_ROOT: '' }, args = []) =>
  execFileSync('node', [HOOK, 'gate', ...args], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env,
  });
```

Every gate test passes a unique `session_id` (e.g. `` `gatetest-${process.pid}-<n>` ``) and removes `join(tmpdir(), `writeup-gate-${id}.txt`)` in a `finally`, as the Antigravity tests at lines 356-380 do with `agyState`.

Convert the existing tests that assert PostToolUse output for `gh` commands (at `b9a98ef`: `gh pr create is scanned` line 102, `gh pr comment and review are scanned with their own endings` line 193, the `--body-file` half of line 207, the chained commit + `gh pr` test line 280, `here-string followed by a chained gh pr create` line 565). Keep what each one tests (parsing, body files, here-strings), but:

- the PostToolUse run for the `gh` part now expects no `gh` block. The chained tests at lines 280 and 565 split output on `\n\n` and expect two blocks; they now expect one (the commit's);
- a `gateRun` of the same payload, with a unique `session_id` added, expects the deny.

Plan 025's test "`gh pr create --body-file` has no `commit subject` line" keeps passing. After this plan it passes because `gh` leaves PostToolUse. Leave it.

Then add:

1. Claude: `gh pr create --body "I hope this helps"` → JSON with `hookSpecificOutput.permissionDecision === 'deny'`, reason contains `rule 20` and `The command did not run.`
2. The same payload again, same session → `''` (passes).
3. The same command with a different slop body in the same session → denied again.
4. Clean body → `''`.
5. `gh issue create --body "We delve."` and `gh issue comment 3 --body "We delve."` → denied.
6. `git commit -m "fix: we delve"` through `gateRun` → `''` (commits are never gated); through `claude()` → still reports rule 7.
7. Copilot (`COPILOT_PLUGIN_ROOT: '1'`), payload `{ toolName: 'bash', toolArgs: { command: 'gh pr create --body "We delve."' }, cwd: <a fresh mkdtempSync dir> }` (no session id): → flat `permissionDecision: 'deny'`. The same payload again → `''`. The state file is `writeup-gate-<slugged cwd>.txt`; remove it in `finally`.
8. Antigravity (`args = ['--antigravity']`, payload `{ conversationId, toolCall: { name: 'run_command', args: { CommandLine: 'gh pr create --body "We delve."' } } }`) → `{"decision":"deny",...}`; a `write_file` payload → exactly `{"decision":"allow"}`; garbage stdin `'not json'` → exactly `{"decision":"allow"}`.
9. Claude garbage stdin through `gateRun` → `''` and exit code 0.
10. `gh pr create --body-file "<absolute path>/body.md"` with slop in a `mkdtempSync` file, as the test at line 220 builds it → denied, and the block names the file.
11. `gh constructor name` through `gateRun` → `''`.

Write each numbered item as its own `test()`.

**Verify**: `node --test plugins/writeup/test/` → all pass, at least 11 new tests.

### Step 5: Repo gate

**Verify**: `npm run lint && npm run format:check && npm test` → exit 0; `npm run validate` → no writeup failure.

## Test plan

Step 4 covers it: deny, deny-once, re-deny on changed text, clean pass, `gh issue`, commit not gated, all three client answer shapes, crash answers allow on every client, and body files.

## Done criteria

- [ ] `node --test plugins/writeup/test/` exits 0
- [ ] `echo not-json | node plugins/writeup/hooks/scan.mjs gate --antigravity` prints exactly `{"decision":"allow"}` and exits 0
- [ ] `echo not-json | node plugins/writeup/hooks/scan.mjs gate` prints nothing and exits 0
- [ ] `grep -c '"PreToolUse"' plugins/writeup/hooks/hooks.json plugins/writeup/hooks.json` reports 1 for each file
- [ ] `npm run lint`, `npm run format:check`, `npm test` exit 0
- [ ] `npm run validate 2>&1 | grep -i writeup | grep -i -E "fail|error"` prints nothing (validate itself exits red on a pre-existing telltale failure)
- [ ] `git status --short -- ':!plans'` lists only the four in-scope files
- [ ] `plans/README.md` status row for 026 updated, noting the live checks below as pending

## STOP conditions

- The drift check shows changes other than plan 025's.
- Any path in gate mode can exit without printing `allow()` or `deny(...)` and you cannot see how to close it inside `scan.mjs`.
- `npm run validate` or `agy plugin validate` rejects the new `PreToolUse` entries.
- Making a test pass needs a change to `client.mjs`.
- A converted test would lose what it was testing (parsing, body files, here-strings), rather than only moving its `gh` assertion to the gate.

## Maintenance notes

- **Live checks pending** (cannot run in tests): in a real Claude Code session, confirm the deny reason reaches the model and the agent resubmits; in Copilot CLI, confirm the deny shows and a crash-free run allows; in Antigravity, confirm `matcher: ""` PreToolUse runs on `run_command` and the allow answer does not slow other tools; in Copilot CLI, log one PreToolUse payload to learn whether it carries a session id (until then the state is per repo). Record results in `plans/README.md`.
- A chained `git commit && gh pr create` with a slop body is denied as a whole, so the commit does not run either. Commits are never gated on their own.
- A body piped on stdin (`gh pr comment -F -`) is not read, so the gate allows it.
- The deny-once escape trusts the agent: it can resubmit unchanged text with a real hit. That was the maintainer's call over a hard block.
- The state file lives in the OS temp dir per session and grows by one line per denied body. Not cleaned up. That is acceptable at this size.
- Plan 027 adds `writeup:issue` and `writeup:review` skills that tell the agent how to write the text this gate checks.
