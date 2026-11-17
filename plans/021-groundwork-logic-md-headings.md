# Plan 021: Restore the mangled headings in prototype's LOGIC.md

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 4e32151..HEAD -- plugins/groundwork/skills/prototype/LOGIC.md plugins/groundwork/.claude-plugin/plugin.json plugins/groundwork/.antigravity-plugin/plugin.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `4e32151`, 2026-11-17

## Why this matters

`LOGIC.md` is the logic-branch reference of the `groundwork:prototype` skill. A botched find/replace left its last numbered heading reading `### 5. Ca### 5. Capture the answer` and destroyed the `## Anti-patterns` heading, leaving the bare fragment `atterns` on its own line. Every run of the skill's logic branch loads this file, so every agent executing it receives garbled section structure, and the six anti-pattern bullets now hang under the wrong heading. No lint or validator reads prose, so nothing catches this — only this plan does.

## Current state

`plugins/groundwork/skills/prototype/LOGIC.md` — logic-branch guide, 67 lines. Its sibling `UI.md` ends with a top-level `## Anti-patterns` section (`UI.md:105`); `LOGIC.md` is meant to have the same shape. Lines 52–67 today:

```markdown
### 4. Hand it over

Open file for user, give absolute path (see [SKILL](SKILL.md) rules). They click through walkthroughs and free-play when ready; interesting moments = "wait, that shouldn't be possible" or "huh, I assumed X would be different"; those are bugs in the _idea_, the whole point. Want new actions or scenario → add. Prototypes evolve.

### 5. Ca### 5. Capture the answer

Follow "When the question is answered" in [SKILL](SKILL.md). Logic-specific part: validated reducer / machine / function set lifts into real module; HTML shell does not.

atterns

- **Don't add tests.** Prototype needing tests no longer prototype.
- **Don't wire it to the real database.** In-memory state unless question specifically about persistence.
- **Don't generalise.** No "what if we wanted to support X later." Prototype answers one question.
- **Don't blur the logic and the page together.** If pure module references DOM, `document`, or button handlers, no longer liftable. Page = thin shell over pure module.
- **Don't reach for a framework, bundler, or server.** One file recipient double-clicks; React app or dev server defeats "shareable".
- **Don't ship the HTML shell into production.** Page optimised for hand click-through. Logic module behind it worth keeping.
```

Two defects on those lines:

- Line 56: `### 5. Ca### 5. Capture the answer` — the heading text `### 5. Ca` was pasted onto the front of the real heading.
- Line 60: `atterns` — the remnant of a `## Anti-patterns` heading that lost its `## Anti-p` prefix. The six bullets below it are that section's content.

Both plugin manifests are at version `0.5.0`:

- `plugins/groundwork/.claude-plugin/plugin.json` — `"version": "0.5.0"`
- `plugins/groundwork/.antigravity-plugin/plugin.json` — same. `npm run validate` fails if `name`, `version` or `description` differ between the two, so any version bump must land in both.

## Commands you will need

| Purpose                | Command                                                | Expected on success |
| ---------------------- | ------------------------------------------------------ | ------------------- |
| Scoped plugin validate | `claude plugin validate ./plugins/groundwork --strict` | exit 0              |
| Full validation        | `npm run validate`                                     | exit 0              |
| Full pre-merge gate    | `npm run check`                                        | exit 0              |

`npm run validate` and `npm run check` need `claude` on PATH (repo CLAUDE.md). A failure pointing at a path outside `plugins/groundwork/` is pre-existing noise for this plan: report it, do not chase it.

## Scope

**In scope** (the only files you should modify):

- `plugins/groundwork/skills/prototype/LOGIC.md`
- `plugins/groundwork/.claude-plugin/plugin.json` (version bump only)
- `plugins/groundwork/.antigravity-plugin/plugin.json` (version bump only)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- `plugins/groundwork/skills/prototype/SKILL.md` and `UI.md` — planned by sibling plan 022 and untouched otherwise; their content is correct.
- Any other plugin, the catalog, the site. Prose elsewhere in `LOGIC.md` — fix the two defects and stop.

## Git workflow

- Branch: `groundwork/plan-021-logic-headings`
- One commit. Subject style, matching `git log` (e.g. `fix(writeup): stop rules 7 and 17 flagging literal landscape and sentence-case headings`):
  `fix(groundwork): restore the mangled headings in prototype LOGIC.md`
- End the commit message with:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Repair the two headings

In `plugins/groundwork/skills/prototype/LOGIC.md`:

1. Replace the line `### 5. Ca### 5. Capture the answer` with `### 5. Capture the answer`.
2. Replace the line `atterns` with `## Anti-patterns`.

Change nothing else in the file. The result: heading `### 5. Capture the answer` followed by its `Follow "When the question is answered"…` paragraph, then heading `## Anti-patterns` followed by the six `Don't …` bullets — the same shape as `UI.md`.

**Verify**: `git grep -n "Ca###" -- plugins/groundwork` → no output. `git grep -n "^atterns$" -- plugins/groundwork` → no output.

### Step 2: Bump the plugin version

In both `plugins/groundwork/.claude-plugin/plugin.json` and `plugins/groundwork/.antigravity-plugin/plugin.json`, if (and only if) the version is still `0.5.0`, change it to `0.5.1`. If a sibling plan already bumped it past `0.5.0`, leave both files untouched.

**Verify**: `node -p "require('./plugins/groundwork/.claude-plugin/plugin.json').version === require('./plugins/groundwork/.antigravity-plugin/plugin.json').version"` → prints `true`.

### Step 3: Validate

**Verify**: `claude plugin validate ./plugins/groundwork --strict` → exit 0. Then `npm run validate` → exit 0, or failures only on paths outside `plugins/groundwork/` (report those as-is).

## Test plan

No new tests: the change is prose in a skill reference file, and this repo's test suite (`node --test`) covers scripts, not skill prose. The regression guard is the grep checks in Step 1 — the exact strings that mark this defect can never appear again without failing them.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `git grep -n "Ca###" -- plugins/groundwork` → no output
- [ ] `git grep -n "^atterns$" -- plugins/groundwork` → no output
- [ ] `grep -n "^## Anti-patterns$" plugins/groundwork/skills/prototype/LOGIC.md` → one match
- [ ] `claude plugin validate ./plugins/groundwork --strict` → exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The lines 52–67 excerpt above does not match the live file (drift since `4e32151`).
- Similar mangled fragments (`…### N. …### N.` or orphaned word-fragments on their own line) appear elsewhere in `plugins/groundwork` — report the locations instead of fixing beyond the two named defects.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `scripts/skill-lint.mjs` checks links and names in skill prose but cannot see heading structure; a recurrence of this corruption will not be caught by `npm run check`. Reviewer: confirm the diff is exactly the two heading lines (plus the version bump), nothing else.
- Deferred: none.
