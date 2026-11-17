# Plan 025: The writeup scan flags rules 8, 21 and 24 and checks the commit subject line

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b9a98ef -- plugins/writeup/hooks/scan.mjs plugins/writeup/test/scan.test.mjs plugins/writeup/skills/commit/SKILL.md`
> Any change to those files since `b9a98ef` is a STOP condition: compare it to the excerpts below first.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `b9a98ef`, 2026-11-17

## Why this matters

The writeup plugin's scan hook (`plugins/writeup/hooks/scan.mjs`) checks agent-written prose against the numbered rules in `plugins/writeup/skills/unslop/SKILL.md`, but only 8 of about 30 rules have a regex. Three more rules are fixed phrases with low false-hit risk: rule 8 ("serves as", "stands as", "boasts"), rule 21 ("Great question", "absolutely right"), rule 24 ("could potentially"). Separately, `plugins/writeup/skills/commit/SKILL.md` makes "subject fits 72 chars" its done criterion and fixes an allowed type list, but nothing checks either, so a long or malformed subject lands unnoticed. After this plan the scan reports both.

## Current state

- `plugins/writeup/hooks/scan.mjs`: the hook. `RULES` (lines 25-49) is an array of `{ id, pattern, line? }`; `findSlop(text)` (lines 60-70) strips code, splits lines, and returns `{ id, match, line }` hits sorted by line then id. `targets(payload)` (lines 174-199) returns `{ kind, name, text, edit? }` per scanned thing; `kind` is `file`, `commit`, `pr`, `comment` or `review`. `message(t, hits)` (lines 201-209) renders each hit as `- rule ${h.id} "${h.match}" (line ${h.line})`. The main block (lines 212-228) calls `findSlop(t.text)` per target.
- `plugins/writeup/test/scan.test.mjs`: `node:test` suite, 45 tests, all passing at `b9a98ef`. The first test, `each rule flags its sample` (lines 18-35), holds one sample sentence per rule id. Test `every rule id still exists in unslop` (lines 66-70) asserts each `RULES` id has a `^<id>. **` heading in the unslop skill; rules 8, 21 and 24 already have one.
- Excerpt, `scan.mjs:45-49`:

```js
  { id: 19, pattern: /[“‘][^“”‘’\n]*[”’]|[“”‘’]/g },
  { id: 20, pattern: /I hope this helps|let me know if|\bof course!|\bcertainly!|smoking gun/gi },
  { id: 23, pattern: /\bin order to\b|\bdue to the fact that\b|\bit is important to note\b/gi },
  { id: 31, pattern: /\b(?:utiliz\w*|leverag\w*|facilitat\w*|numerous|in the event that)\b/gi },
];
```

- Excerpt, `scan.mjs:189-197` (how a commit target is built; `words` are the shell words of one command segment, quotes already removed, so `-m "fix: x"` gives words `-m` and `fix: x`):

```js
if ((tool === 'Bash' || tool === 'PowerShell') && typeof command === 'string') {
  return parse(command).flatMap(({ text, words }) => {
    const found = commandKind(words);
    if (!found) return [];
    const [kind, name] = found;
    const msg = messageFile(words, workspace(payload));
    return [msg ? { kind, name: `${name} (${msg.file})`, text: msg.text } : { kind, name, text }];
  });
}
```

- From `plugins/writeup/skills/commit/SKILL.md` (the rules the subject check enforces): "`type(scope): summary`, Conventional Commits form. Type one of `feat`, `fix`, `refactor`, `perf`, `docs`, `test`, `chore`, `build`, `ci`, `style`, `revert`. ... no trailing period. Aim 50 chars; 72 limit. `!` after scope marks breaking change."
- Conventions: ES modules, no dependencies, Prettier formatting (single quotes, trailing commas, 100-col), short `//` comments that say why. Every regex in `RULES` carries the `g` flag (`matchAll` requires it).

## Commands you will need

| Purpose         | Command                                             | Expected on success                      |
| --------------- | --------------------------------------------------- | ---------------------------------------- |
| Writeup tests   | `node --test plugins/writeup/test/`                 | all pass                                 |
| All tests       | `npm test`                                          | all pass                                 |
| Lint            | `npm run lint`                                      | exit 0                                   |
| Format          | `npm run format:check`                              | exit 0                                   |
| Plugin validate | `claude plugin validate ./plugins/writeup --strict` | exit 0 (skip if `claude` is not on PATH) |

Run all commands from the repo root `C:/j0hanz-marketplace`.

## Scope

**In scope**:

- `plugins/writeup/hooks/scan.mjs`
- `plugins/writeup/test/scan.test.mjs`

**Out of scope**:

- `plugins/writeup/hooks/client.mjs`: copied byte-identical into other plugins and checked by `npm run validate`; never edit it here.
- `plugins/writeup/skills/*`: the rules already exist in the skills.
- Plugin version numbers in both manifests: plan 027 owns the version bump.
- Rule 8's word "features": too common in real docs, deliberately not matched.

## Git workflow

- Branch: `writeup/plan-025-rules-and-subject`.
- One commit, conventional subject, e.g. `feat(writeup): flag rules 8, 21, 24 and check the commit subject`.
- Do not push or open a PR.

## Steps

### Step 1: Add rules 8, 21 and 24

In `RULES`, insert in id order (8 after 7; 21 after 20; 24 after 23):

```js
  { id: 8, pattern: /\b(?:serves as|stands as|boasts)\b/gi },
  { id: 21, pattern: /\bgreat question\b|\babsolutely right\b/gi },
  { id: 24, pattern: /\b(?:could|might|may) potentially\b|\b(?:could|might) possibly\b/gi },
```

Add samples to the `each rule flags its sample` test object: `8: 'The file serves as an index.'`, `21: 'Great question.'`, `24: 'It could potentially fail.'`.

**Verify**: `node --test plugins/writeup/test/` → all pass.

### Step 2: Export a subject checker

Add to `scan.mjs`, below `findSlop`, an exported `lintSubject(subject)` that returns hits shaped `{ id: 'subject', match: <reason>, line: 1 }`:

Trim the subject first; every check below uses the trimmed value.

- `subject` not a string or empty after trim → `[]`.
- Subject starts with a git-generated prefix (`fixup! `, `squash! `, `amend! `, `Revert "`, `Merge `) → `[]`: git wrote it, not the agent.
- Length over 72, counted in code points (`[...subject].length`) → reason `` `${n} chars, limit 72` ``.
- Ends in `.` → reason `ends in a period`.
- Does not match `/^([a-z]+)(\([^)]*\))?!?: \S/` → reason `not in type(scope): summary form`. When it matches but the type is not one of the 11 listed above → reason `` `unknown type "${type}"` ``.

Return every reason that applies, in the order above. Keep the type list as one `const` with a comment naming `skills/commit/SKILL.md` as its source.

**Verify**: `node -e "import('./plugins/writeup/hooks/scan.mjs').then(m=>console.log(JSON.stringify(m.lintSubject('Fixed stuff.'))))"` → two hits: `ends in a period` and `not in type(scope): summary form`. (On Windows run it from Git Bash or PowerShell; if quoting breaks, write the one-liner to a scratch `.mjs` file instead.)

### Step 3: Find the subject of a commit target

Add a helper `subjectOf(words, msg)` and set `subject` on commit targets only (`kind === 'commit'`) inside `targets`:

1. `msg` (the `-F` file) present → the first line of `msg.text` that is not blank and does not start with `#` (git strips both).
2. Else the first message value: the word after a word matching `/^-[a-zA-Z]*m$/` (covers `-m`, `-am`, `-sm`, `-vm`) or after `--message`, or the part after `=` in `--message=...`. A quoted glued `-m"fix: x"` already arrives as two words (`-m`, `fix: x`), so no glued form needs handling.
3. That value can be wrapped. Its first line is then only an opener, and the subject is the next line. Openers:
   - Claude Code's heredoc: one word like `$(cat <<'EOF'\nfeat: x\n\nbody\nEOF\n)`. First line matches `/^\$\(cat <<-?['"]?[\w.-]+['"]?\s*$/`.
   - PowerShell here-strings: `parse` keeps the `@'` / `@"` wrapper on the word (its quote strip at `scan.mjs:115` only removes matching `"` or `'` at both ends). First line is exactly `@'` or `@"`.
4. Nothing found (editor commit, `-F -` stdin, heredoc on stdin) → `undefined`. The subject check then reports nothing.

Trim `\r` from the result.

In the main block, change the hits for a target to `[...lintSubject(t.subject), ...findSlop(t.text)]`. Subject hits count toward the `flagged N patterns` header.

In `message`, render a subject hit as `` `- commit subject: ${h.match}` `` (no quotes, no line number); other hits keep their current line.

Some existing tests commit with a non-conventional subject and assert exact output or hit counts. If one fails only because a new `commit subject` line appears, change only that test's commit subject to a conventional one, keeping any slop it tests:

- `chained git commit is scanned` (line 95): `"Delve into it"` → `"fix: delve into it"`.
- The test at lines 323-326 (`git commit -m "ok"`, expects `''`): `"ok"` → `"fix: ok"`.

Change nothing else in those tests. The here-string tests at lines 552-590 must pass without edits; a failure there means step 3.3 is wrong.

**Verify**: `node --test plugins/writeup/test/` → all pass.

### Step 4: Tests

Add tests to `plugins/writeup/test/scan.test.mjs`, modeled on `chained git commit is scanned` (lines 95-101), using the existing `claude()` helper. Write each numbered item as its own `test()`. Commands with `\n` use a JS template literal holding real newlines, as at line 298.

1. `lintSubject` unit cases: `'feat(api): add x'` → `[]`; an 80-char valid subject → one hit `80 chars, limit 72`; `'feat: add x.'` → `ends in a period`; `'Add x'` → `not in type(scope): summary form`; `'feature: add x'` → `unknown type "feature"`; `'feat(api)!: drop v1'` → `[]`.
2. Hook: `git commit -m "Fixed it."` → output contains `- commit subject: ends in a period`.
3. Hook: the heredoc form, command string `git commit -m "$(cat <<'EOF'\nfix(x): handle y\n\nBody line.\nEOF\n)"` → output is `''` (clean subject, clean body).
4. Hook: `-F msg.txt` with a temp file whose first line is `wip` → contains `not in type(scope): summary form`. Model the temp file on test `message files named by -F and --body-file are read` (line 207).
5. Hook: `gh pr create --body-file body.md` where `body.md`'s first line is `Add x.` and a later line is `We delve.` → output has a rule 7 hit and no `commit subject` line (the check is commit-only).
6. Rule false-hit guards: `findSlop('It may possibly work. The server is right.')` → `[]`.
7. Hook: PowerShell here-string `git commit -m @'\nFixed it.\n'@` (real newlines) → contains `- commit subject: ends in a period`, and no `not in type(scope)` line about `@'`.
8. Hook: `git commit -am "Fixed it."` → contains `- commit subject: ends in a period`.
9. `lintSubject('fixup! feat: x')` and `lintSubject('Revert "feat: x"')` → `[]`.

**Verify**: `node --test plugins/writeup/test/` → all pass, 9 new tests.

### Step 5: Repo gate

**Verify**: `npm run lint && npm run format:check && npm test` → exit 0. If `npm run format:check` fails only on your files, run `npx prettier --write plugins/writeup/hooks/scan.mjs plugins/writeup/test/scan.test.mjs` and re-check.

## Test plan

Covered in step 4: one sample per new rule, every subject reason, each subject source (`-m`, `-am`, heredoc `-m`, here-string `-m`, `-F` file), git-generated subjects, the commit-only scope, and false-hit guards.

## Done criteria

- [ ] `node --test plugins/writeup/test/` exits 0 with at least 54 tests
- [ ] `npm run lint` and `npm run format:check` exit 0
- [ ] `grep -n "id: 8,\|id: 21,\|id: 24," plugins/writeup/hooks/scan.mjs` prints 3 lines
- [ ] `git status --short -- ':!plans'` lists only the two in-scope files
- [ ] `plans/README.md` status row for 025 updated

## STOP conditions

- The drift check shows changes to `RULES`, `targets` or `message`.
- A `-m` value for the heredoc or here-string form does not arrive as one word starting with `$(cat <<`, `@'` or `@"`: print the words for that command from inside `targets` (temporary `console.error`), report what you saw, and stop.
- A new rule pattern hits any existing test's "clean" sample.
- `npm run validate` (if you run it) fails on a writeup check.

## Maintenance notes

- The type list duplicates `skills/commit/SKILL.md`. Edit both together.
- Plan 026 moves `gh` commands from this PostToolUse scan to a PreToolUse gate. It reuses `findSlop` and does not touch the subject check.
- Deferred: subject checks for other forms (e.g. `git commit --amend` without `-m`).
