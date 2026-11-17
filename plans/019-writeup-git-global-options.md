# Plan 019: The writeup scan sees `git commit` behind git's global options

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 08e36e3..HEAD -- plugins/writeup/hooks/scan.mjs plugins/writeup/test/scan.test.mjs`
> Plan 018 may have landed first and changed `scan.mjs` lines 1, 87 and 177 (header comment, `TOKEN`, the `targets` shell condition). Those edits are expected. Any change to `commandKind` (lines 140-152) is a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (touches the same file as plan 018; either order works)
- **Category**: bug
- **Planned at**: commit `08e36e3`, 2026-11-17

## Why this matters

The writeup hook scans a shell segment only when the word right after `git` is `commit`. Agents often place global options before the subcommand: `git -C ../worktree commit -m ...` when working in a worktree, `git -c core.hooksPath=... commit`, or `git --no-pager commit`. In all three cases the scan never runs. A planning probe confirmed it: `targets()` returns `[]` for each. After this plan, git's global options are skipped and the subcommand is checked.

## Current state

`plugins/writeup/hooks/scan.mjs:140-152`:

```js
const GH = {
  create: ['pr', 'PR body'],
  edit: ['pr', 'PR body'],
  comment: ['comment', 'PR comment'],
  review: ['review', 'review body'],
};
const commandKind = (words) => {
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i] === 'git' && words[i + 1] === 'commit') return ['commit', 'commit message'];
    if (words[i] === 'gh' && words[i + 1] === 'pr' && GH[words[i + 2]]) return GH[words[i + 2]];
  }
  return null;
};
```

`words` comes from `parse()` (lines 89-120): shell words of one segment, quotes stripped, so `-C` and its path are separate words, and `--git-dir=.git` is one word.

git(1) global options that take the **next** word as their value: `-C <path>`, `-c <name>=<value>`, `--git-dir <path>`, `--work-tree <path>`, `--namespace <name>`, `--config-env <name>=<envvar>`. The rest are flags (`--no-pager`, `-p`, `-P`, `--paginate`, `--bare`, `--no-replace-objects`, `--literal-pathspecs`, `--no-optional-locks`, ...) or use the `--opt=value` form, which is one word.

Conventions: short helpers with a one-line comment saying why (see `MESSAGE_FLAG` at `scan.mjs:122-124`). Test pattern: `'git commit-tree is silent; git commit still flags'` at `scan.test.mjs:241-250`, which uses the `claude()` helper.

## Commands you will need

| Purpose      | Command                                          | Expected on success |
| :----------- | :----------------------------------------------- | :------------------ |
| Plugin tests | `node --test plugins/writeup/test/scan.test.mjs` | `fail 0`            |
| Full gate    | `npm run check`                                  | exit 0              |

## Scope

**In scope**:

- `plugins/writeup/hooks/scan.mjs` (`commandKind` and a new helper directly above it)
- `plugins/writeup/test/scan.test.mjs`

**Out of scope**:

- The `gh` branch of `commandKind`. `gh pr --repo x create` is rare; leave it.
- `parse()`, `TOKEN`, `messageFile`. Note that `-F` detection in `messageFile` scans all words, so `git -C dir commit -F msg.txt` already finds the file once the segment is recognized. The file path still resolves against the payload `cwd`, not the `-C` directory. Do not change that here; see Maintenance notes.
- `client.mjs`, `hooks.json`, plugin versions.

## Git workflow

- Branch: `writeup/plan-019-git-global-options`
- One commit, e.g. `fix(writeup): scan git commit behind global options like -C`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Skip global options before the git subcommand

Directly above `commandKind`, add:

```js
// git's global options sit between `git` and the subcommand; these take the next word as value.
const GIT_VALUE_OPTION = /^(?:-C|-c|--git-dir|--work-tree|--namespace|--config-env)$/;
const gitSubcommand = (words, i) => {
  let j = i + 1;
  while (words[j]?.startsWith('-')) j += GIT_VALUE_OPTION.test(words[j]) ? 2 : 1;
  return words[j];
};
```

In `commandKind`, replace `words[i] === 'git' && words[i + 1] === 'commit'` with `words[i] === 'git' && gitSubcommand(words, i) === 'commit'`. Leave the loop bound and the `gh` line unchanged.

**Verify**: `node --test plugins/writeup/test/scan.test.mjs` → `fail 0` (the existing `commit-tree` test still passes, because `'commit-tree' !== 'commit'`).

### Step 2: Add tests

See Test plan.

**Verify**: `node --test plugins/writeup/test/scan.test.mjs` → `fail 0`, one more test than before.

### Step 3: Full gate

**Verify**: `npm run check` → exit 0.

## Test plan

One new test, `'git global options before commit are skipped'`, in `scan.test.mjs`, modeled on lines 241-250:

- Each of these flags (`assert.notEqual(claude(...), '')` and output matches `/rule 7/`):
  - `git -C ../wt commit -m "Delve"`
  - `git -c commit.gpgsign=false commit -m "Delve"`
  - `git --no-pager -C . commit -m "Delve"`
  - `git --git-dir=.git commit -m "Delve"`
- Each of these stays silent (`assert.equal(claude(...), '')`):
  - `git -C commit log` (a directory named `commit`; the subcommand is `log`)
  - `git --no-pager log --grep commit`

## Done criteria

- [ ] `node --test plugins/writeup/test/scan.test.mjs` reports `fail 0`, with the new test listed
- [ ] `npm run check` exits 0
- [ ] `grep -n "words\[i + 1\] === 'commit'" plugins/writeup/hooks/scan.mjs` returns nothing
- [ ] Only `scan.mjs`, `scan.test.mjs` and `plans/README.md` changed
- [ ] `plans/README.md` row 019 updated

## STOP conditions

- `commandKind` differs from the excerpt (other than plan 018's unrelated edits elsewhere in the file).
- Any existing test fails after step 1.
- You find yourself changing `parse()` or `messageFile` to make a test pass.

## Maintenance notes

- `git -C other commit -F msg.txt` reads `msg.txt` relative to the payload `cwd`, not `other`. git itself resolves it inside `other`. If that file is missing from `cwd`, the scan stays silent (fail open). A follow-up could resolve `-F` against the `-C` path. It was left out to keep this plan to one helper.
- A new git global option that takes a separate value must be added to `GIT_VALUE_OPTION`, or the next word is read as the subcommand. Unknown options fail toward silence, not false hits.
