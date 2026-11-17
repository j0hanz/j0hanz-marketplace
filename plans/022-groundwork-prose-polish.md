# Plan 022: Fix the grill-with-docs typo and name where the prototype verdict lands

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 4e32151..HEAD -- plugins/groundwork/skills/grill-with-docs/SKILL.md plugins/groundwork/skills/prototype/SKILL.md plugins/groundwork/.claude-plugin/plugin.json plugins/groundwork/.antigravity-plugin/plugin.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live file before proceeding; on a
> mismatch, treat it as a STOP condition. Sibling plan 021 only touches
> `prototype/LOGIC.md` and the version fields — a version bump past `0.5.0`
> from it is expected and tolerated.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (soft: run after 021 so one of the two owns the version bump)
- **Category**: docs
- **Planned at**: commit `4e32151`, 2026-11-17

## Why this matters

Two small prose defects in the groundwork plugin's skills. First, the `grill-with-docs` description says "(ADR's and glossary)" — a typo in text every user sees in the skill listing, and "ADR's" is the wrong possessive for an acronym plural. Second, `prototype/SKILL.md` says "Write verdict: question, answer, what surprised user" but never says where — an executing agent improvises (random file, lost note), and the whole point of the verdict is that it survives the prototype's deletion.

## Current state

**File 1**: `plugins/groundwork/skills/grill-with-docs/SKILL.md` — a two-line alias skill that chains two other skills. Full content today:

```markdown
---
name: grill-with-docs
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
disable-model-invocation: true
---

Call Skill tool twice: `groundwork:grilling`, `groundwork:domain-modeling`.
```

The description contains no `: ` outside the YAML key, so it stays valid strict YAML unquoted. Only the parenthetical changes.

**File 2**: `plugins/groundwork/skills/prototype/SKILL.md` — the prototype skill. Its closing section, lines 34–39 today:

```markdown
## When the question is answered

1. Write verdict: question, answer, what surprised user.
2. Fold validated decision into real code, rewritten properly. Prototype code had no tests or error handling.
3. Decision with load-bearing reason future readers would re-litigate? Call Skill tool with `groundwork:domain-modeling`, offer ADR. New domain terms surfaced? Same skill, update `GLOSSARY.md`.
4. Remove prototype from working tree. Ask user first whether to keep copy, e.g. on `prototype/<name>` branch. No branches or commits without asking.
```

Step 1 gives no destination. The plugin's own convention for "where do notes go" is in `plugins/groundwork/skills/research/SKILL.md:12`: "Save where repo already keeps such notes; match existing convention." The verdict fix follows the same logic.

Both plugin manifests are at version `0.5.0`; sibling plan 021 may have bumped them to `0.5.1`.

## Commands you will need

| Purpose                | Command                                                | Expected on success |
| ---------------------- | ------------------------------------------------------ | ------------------- |
| Scoped plugin validate | `claude plugin validate ./plugins/groundwork --strict` | exit 0              |
| Full validation        | `npm run validate`                                     | exit 0              |

`npm run validate` needs `claude` on PATH (repo CLAUDE.md). A failure pointing at a path outside `plugins/groundwork/` is pre-existing noise for this plan: report it, do not chase it.

## Scope

**In scope** (the only files you should modify):

- `plugins/groundwork/skills/grill-with-docs/SKILL.md`
- `plugins/groundwork/skills/prototype/SKILL.md`
- `plugins/groundwork/.claude-plugin/plugin.json` (version bump only, if 021 has not bumped it)
- `plugins/groundwork/.antigravity-plugin/plugin.json` (same)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `plugins/groundwork/skills/prototype/LOGIC.md` and `UI.md` — their "Capture the answer" sections say "Follow 'When the question is answered' in [SKILL](SKILL.md)", which stays true after this change; no edit needed.
- The description budget: `grill-with-docs` has `disable-model-invocation: true`, so the 40-word budget in `scripts/skill-lint.mjs` does not apply.

## Git workflow

- Branch: `groundwork/plan-022-prose-polish`
- One commit. Subject style, matching `git log`:
  `fix(groundwork): fix grill-with-docs typo and name where the prototype verdict lands`
- End the commit message with:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the grill-with-docs description

In `plugins/groundwork/skills/grill-with-docs/SKILL.md`, replace:

```yaml
description: A relentless interview to sharpen a plan or design, which also creates docs (ADR's and glossary) as we go.
```

with:

```yaml
description: A relentless interview to sharpen a plan or design, which also creates docs (ADRs and a glossary) as we go.
```

**Verify**: `git grep -n "ADR's" -- plugins/groundwork` → no output.

### Step 2: Give the verdict a destination

In `plugins/groundwork/skills/prototype/SKILL.md`, replace step 1 of "When the question is answered":

```markdown
1. Write verdict: question, answer, what surprised user.
```

with:

```markdown
1. Write verdict where the project keeps decisions (its decision notes if it has them, else the conversation): question, answer, what surprised user.
```

Keep the file's voice: terse, `user` not `the user`, no em dashes (the writeup plugin in this repo flags them).

**Verify**: `git grep -n "Write verdict" -- plugins/groundwork` → the one line, now containing `where the project keeps decisions`.

### Step 3: Bump the plugin version (only if 021 has not)

In both manifests, if the version is still `0.5.0`, change it to `0.5.1` in `plugins/groundwork/.claude-plugin/plugin.json` and `plugins/groundwork/.antigravity-plugin/plugin.json` alike. If either file already reads `0.5.1` or higher, leave both untouched.

**Verify**: `node -p "require('./plugins/groundwork/.claude-plugin/plugin.json').version === require('./plugins/groundwork/.antigravity-plugin/plugin.json').version"` → prints `true`.

### Step 4: Validate

**Verify**: `claude plugin validate ./plugins/groundwork --strict` → exit 0. Then `npm run validate` → exit 0, or failures only on paths outside `plugins/groundwork/` (report those as-is).

## Test plan

No new tests: both changes are prose in skill files, and this repo's test suite (`node --test`) covers scripts, not skill prose. `scripts/skill-lint.mjs` re-checks the edited description's YAML strictness as part of `npm run validate`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `git grep -n "ADR's" -- plugins/groundwork` → no output
- [ ] `git grep -n "Write verdict" -- plugins/groundwork` → one line, containing `where the project keeps decisions`
- [ ] `claude plugin validate ./plugins/groundwork --strict` → exit 0
- [ ] Both manifests carry the same version, at least `0.5.1`
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Either excerpt in "Current state" does not match the live file (drift since `4e32151`).
- The `grill-with-docs` description has changed in any other way — the fix must touch only the parenthetical.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The `grill-with-docs` description shows up in Claude Code's skill listing; any future edit to it must keep the YAML strict (a value containing `: ` needs quoting — repo CLAUDE.md, "Two clients").
- Reviewer: the diff should be exactly two prose lines plus (maybe) two version fields.
- Deferred: none.
