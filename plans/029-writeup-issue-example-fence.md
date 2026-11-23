# Plan 029: The issue skill shows error output in a fence the writeup scan skips

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat fc5a197..HEAD -- plugins/writeup/skills/issue/SKILL.md plugins/writeup/skills/show-me/SKILL.md plugins/writeup/test/scan.test.mjs`
> If any of these changed since this plan was written, compare the
> "Current state" excerpts against the live files before proceeding; on a
> mismatch, treat it as a STOP condition. Plan 028 appends tests to
> `scan.test.mjs`; that change is expected and is not drift.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (028 touches the same test file; run them one at a time)
- **Category**: bug
- **Planned at**: commit `fc5a197`, 2026-11-23

## Why this matters

The writeup plugin's `issue` skill tells agents to put exact error text in a `text` fence, but its own example shows the error as a 4-space indented block, because a three-backtick fence cannot sit inside the three-backtick fence that wraps the example. Agents copy the example: all three with-skill runs recorded in `plans/027-baseline.md` produced indented error blocks. The writeup scan strips fenced code and inline code before checking for slop, but it reads indented lines as prose. Real error output often holds curly quotes (gcc prints `‘foo’ undeclared` in UTF-8 locales) or em dashes, which are rules 19 and 13. The gate then denies `gh issue create`, and the agent may "fix" the verbatim error text to get past it, which corrupts the evidence in the issue. After this plan, the example shows a real `text` fence, and the skill says not to indent.

The plan also removes the one em dash left in `show-me/SKILL.md`, which an earlier audit marked "fix in passing".

## Current state

Files:

- `plugins/writeup/skills/issue/SKILL.md`: the issue-writing skill. Item 2 at line 13; the example at lines 19-43.
- `plugins/writeup/skills/show-me/SKILL.md`: the diagram skill. Line 100 holds an em dash.
- `plugins/writeup/test/scan.test.mjs`: test suite. It already reads a skill file in the test `'every rule id still exists in unslop'` (around line 69); use it as the pattern.
- `plugins/writeup/hooks/scan.mjs:74-75`: `FENCE` and `stripCode`. A fence of four backticks around a three-backtick fence is handled per CommonMark (test `'a fence opens only at line start and closes on a run at least as long'`). Do not change this file.

`issue/SKILL.md:13`:

```markdown
2. **What happens.** Observed behavior. Exact error text in a `text` fence, trimmed to decisive lines.
```

`issue/SKILL.md:19-29` (start of the example):

````markdown
Example:

```text
Title: export drops the last row when the table has one column

## What happens
`tabx export t.db out.csv` writes every row except the last.

    wrote 41 rows (table has 42)

## Expected
```
````

`issue/SKILL.md:41-43` (end of the example), three consecutive lines with no blank line between them: `## Cause`, then `Guess: the writer stops one row early when there is no delimiter to flush.`, then a line holding only three backticks (the closing fence).

`show-me/SKILL.md:100`:

```markdown
GitHub renders `mermaid` and `diff` fences in PR body. HTML file can't live there — Markdown views only.
```

Conventions: skill files are terse imperative Markdown, sentence-case headings, no em dashes (writeup's own rule 13). A `SKILL.md` must stay under 24 KB (both files are under 6 KB).

## Commands you will need

| Purpose       | Command                                             | Expected on success                          |
| ------------- | --------------------------------------------------- | -------------------------------------------- |
| Writeup tests | `node --test plugins/writeup/test/`                 | `ℹ fail 0`                                   |
| Format check  | `npx prettier --check plugins/writeup`              | `All matched files use Prettier code style!` |
| Lint          | `npx eslint plugins/writeup`                        | exit 0                                       |
| Plugin check  | `claude plugin validate ./plugins/writeup --strict` | exit 0 (skip if `claude` is not on PATH)     |
| Full gate     | `npm run check`                                     | exit 0 (see STOP conditions)                 |

## Scope

**In scope** (the only files you should modify):

- `plugins/writeup/skills/issue/SKILL.md`: line 13 and the example fence.
- `plugins/writeup/skills/show-me/SKILL.md`: line 100 only.
- `plugins/writeup/test/scan.test.mjs`: one new test appended at the end.
- `plans/README.md`: this plan's status row.

**Out of scope** (do NOT touch):

- `plugins/writeup/hooks/scan.mjs`: making `stripCode` skip indented code blocks was considered and rejected, because nested list content is also indented four spaces and would be hidden from the scan.
- Any other text in the two skills, including the rest of the example.
- Plugin versions in either `plugin.json`: the maintainer bumps them separately.

## Git workflow

- Branch: `writeup/plan-029-issue-example-fence`.
- One commit, e.g. `docs(writeup): show issue error output in a text fence`. Use the `writeup:commit` skill if available.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the regression test and watch it fail

Append at the end of `plugins/writeup/test/scan.test.mjs`:

`````js
test('the issue skill shows error text in a fence, not an indented block', () => {
  const skill = readFileSync(new URL('../skills/issue/SKILL.md', import.meta.url), 'utf8');
  assert.doesNotMatch(skill, /^ {4}\S/m);
  assert.match(skill, /^````text$/m);
});
`````

`readFileSync` is already imported at the top of the file.

**Verify**: `node --test plugins/writeup/test/` → exactly one failure, the new test.

### Step 2: Rewrite the issue example and item 2

In `issue/SKILL.md`:

1. Change the example's opening fence (the line after `Example:`) from three backticks + `text` to four backticks + `text`: ` ````text `.
2. Change the example's closing fence (the line after `Guess: the writer stops ...`) from three backticks to four.
3. Replace the indented line `    wrote 41 rows (table has 42)` with a three-backtick `text` fence holding that line (no indent):

   ````markdown
   ```text
   wrote 41 rows (table has 42)
   ```
   ````

   Keep the blank line above and below it.

4. On line 13, append one sentence after `trimmed to decisive lines.`: ` Never an indented block: the writeup scan reads indented lines as prose.`

The example section must end up as:

`````markdown
````text
Title: export drops the last row when the table has one column

## What happens
`tabx export t.db out.csv` writes every row except the last.

```text
wrote 41 rows (table has 42)
```

## Expected
Output has 42 rows.

## Repro
1. `tabx new t.db --columns id`
2. `tabx insert t.db 1 2 3`
3. `tabx export t.db out.csv`
4. `wc -l out.csv` prints 2, not 3.

## Environment
tabx 1.8.0, Ubuntu 24.04

## Cause
Guess: the writer stops one row early when there is no delimiter to flush.
````
`````

**Verify**: `node --test plugins/writeup/test/` → `ℹ fail 0`.

### Step 3: Remove the em dash in show-me

Replace `show-me/SKILL.md:100` with:

```markdown
GitHub renders `mermaid` and `diff` fences in PR body. HTML file can't live there, so use Markdown views only.
```

**Verify**: `grep -c "—" plugins/writeup/skills/show-me/SKILL.md plugins/writeup/skills/issue/SKILL.md` → both counts `0`.

### Step 4: Format, lint, validate

Run the Format check, Lint and Plugin check commands from the table.

**Verify**: each gives its expected result. If prettier reports a skill file, run `npx prettier --write <that file>` and confirm with `git diff` that it changed only whitespace.

## Test plan

- New, in `plugins/writeup/test/scan.test.mjs` (Step 1): the issue skill holds no 4-space indented line, and its example opens with a four-backtick `text` fence.
- Pattern: `'every rule id still exists in unslop'`.
- Verification: `node --test plugins/writeup/test/` → all pass, one more than before this plan.

## Done criteria

- [ ] `node --test plugins/writeup/test/` prints `ℹ fail 0`, with the new test listed as passing
- [ ] `grep -nE "^ {4}[^ ]" plugins/writeup/skills/issue/SKILL.md` prints nothing
- [ ] `grep -c "—" plugins/writeup/skills/show-me/SKILL.md` prints `0`
- [ ] `npx prettier --check plugins/writeup` and `npx eslint plugins/writeup` exit 0
- [ ] `npm run check` exits 0, or fails only on checks outside `plugins/writeup` that also fail on `main` at `fc5a197` (record which in the status row)
- [ ] `git diff --name-only main` lists only the three in-scope plugin files and `plans/README.md`
- [ ] `plans/README.md` row 029 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `issue/SKILL.md` line 13 or the example does not match the "Current state" excerpts.
- Prettier rewrites the four-backtick fence into something else (for example `~~~`) or reflows the example.
- `claude plugin validate ./plugins/writeup --strict` fails after the change but passed before it.

## Maintenance notes

- Any new example in a writeup skill that shows a fence inside an example needs an outer fence longer than the inner one (four backticks around three). An indented block is never a substitute: `stripCode` in `scan.mjs` skips fences and inline code only.
- If indented error blocks still show up in agent output after this lands, the next step is a scanner change, not more skill text. That change must not hide nested list content, which is also indented.
- Reviewers: render the issue skill on GitHub and confirm the example shows the inner `text` fence as a fence.
