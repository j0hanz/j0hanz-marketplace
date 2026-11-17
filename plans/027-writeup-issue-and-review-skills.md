# Plan 027: Writeup teaches agents to write GitHub issues and review comments

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update the status row for this plan
> in `plans/README.md`, unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b9a98ef -- plugins/writeup/skills plugins/writeup/.claude-plugin plugins/writeup/.antigravity-plugin .claude-plugin/marketplace.json`
> Any change there since `b9a98ef` is a STOP condition: compare it to the excerpts below first. Plans 025 and 026 do not touch these paths.

## Status

- **Priority**: P2
- **Effort**: S-M (most time goes to the baseline and with-skill subagent runs)
- **Risk**: LOW
- **Depends on**: plans/026-writeup-gate-public-gh-writes.md (soft: 026 makes the scan gate `gh issue` and review text; this plan adds the matching guidance and does the version bump for 025-027)
- **Category**: direction
- **Planned at**: commit `b9a98ef`, 2026-11-17

## Why this matters

The writeup plugin covers commit messages (`writeup:commit`) and PR descriptions (`writeup:pr`), and its scan already checks `gh pr review` and `gh pr comment` text, but no skill tells an agent how to shape a GitHub issue or a code review comment. Agents writing those default to chat-style prose: a bug issue without repro steps, or a review comment that hedges and praises instead of naming the failure. The maintainer chose (2026-11-17) to add two skills, `writeup:issue` and `writeup:review`, each loading only when its command is about to run.

## Current state

- `plugins/writeup/skills/<name>/SKILL.md`: one folder per skill. Existing: `commit`, `pr`, `show-me`, `unslop`. Antigravity and Copilot read the same `skills/` folder, so a new folder ships on all three clients.
- The shape to copy is `plugins/writeup/skills/pr/SKILL.md` (1.9 KB). Verbatim excerpt:

```markdown
---
name: pr
description: Use when writing or updating a pull request description, or before running `gh pr create`.
---

**REQUIRED:** apply writeup:unslop to all prose, writeup:show-me for every visual.

## Description

Read branch diff (`git diff <base>...HEAD`) first. Describe each behavior by trigger and effect, not guarantee or coverage. PR description parts, in order:

1. **Summary line.** One sentence naming behavior user gets. No part, file or count. PR title same shape. Unrelated change on branch: one more line.
2. **Why.** Problem before change, or what it unblocks, 1 to 3 lines.
   ...

## What to leave out

Reviewer has diff. Leave out, in prose and visuals:

- Code in prose: identifiers, string literals, regexes, flags, any number from code.
  ...

Done when parts above appear in order, every number in description is test result or fact about problem, every unrelated change on branch has its line.
```

House style: a `**REQUIRED:**` line naming the writeup skills to apply; a section listing the parts **in order** (numbered, bold lead-in ending in a period); a short leave-out list; one `Done when ...` line that is checkable. Terse, article-light wording is the house style for these agent-facing files; keep it.

- Repo rules from `CLAUDE.md`: `SKILL.md` frontmatter is strict YAML (quote a `description` containing `: `); a `SKILL.md` stays under 24 KB and its `name` matches its folder; never hand-edit README's generated regions (`npm run site:data` rewrites them, and lists each plugin's skills there).
- Versions: `plugins/writeup/.claude-plugin/plugin.json` and `plugins/writeup/.antigravity-plugin/plugin.json` both say `"version": "0.4.1"` and the description `PR descriptions and commit messages written for people: plain prose, structural diagrams, slop flagged on write.`; `.claude-plugin/marketplace.json` lines 77-80 carry the same description. `npm run validate` checks the two manifests match on `name`, `version`, `description`.
- Recent commit subjects in this repo: `chore(plugins): bump writeup plugin version to 0.4.1`, `fix(writeup): scan git commit behind global options like -C`.

## Commands you will need

| Purpose                   | Command                                                                              | Expected on success                                           |
| ------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Validate                  | `npm run validate`                                                                   | no writeup failure (a pre-existing telltale failure is known) |
| Regenerate README regions | `npm run site:data`                                                                  | exit 0, README writeup section lists the new commands         |
| Format                    | `npm run format:check`                                                               | exit 0                                                        |
| Tests                     | `npm test`                                                                           | all pass                                                      |
| Size check                | `wc -c plugins/writeup/skills/issue/SKILL.md plugins/writeup/skills/review/SKILL.md` | each under 24576                                              |

Run from `C:/j0hanz-marketplace`.

## Suggested executor toolkit

- `superpowers:writing-skills` if available: this plan follows its RED-GREEN cycle (baseline without the skill, then with it). Read its "Match the Form to the Failure" table before step 3: these skills fix output **shape**, so they state the parts in order (a recipe), not a list of prohibitions.
- A subagent tool (Claude Code `Agent`) for the baseline and with-skill runs.

## Scope

**In scope**:

- `plugins/writeup/skills/issue/SKILL.md` (create)
- `plugins/writeup/skills/review/SKILL.md` (create)
- `plugins/writeup/.claude-plugin/plugin.json`, `plugins/writeup/.antigravity-plugin/plugin.json` (version and description)
- `.claude-plugin/marketplace.json` (writeup description only)
- README regions and site data that `npm run site:data` regenerates
- `plans/027-baseline.md` (create: your baseline and with-skill notes)

**Out of scope**:

- `plugins/writeup/skills/commit`, `pr`, `show-me`, `unslop`.
- `plugins/writeup/hooks/*` (plans 025 and 026).
- Hand edits to README regions between `<!-- ...:start -->` markers.

## Git workflow

- Branch: `writeup/plan-027-issue-review-skills`.
- Commits: `feat(writeup): add issue and review skills` (the two `SKILL.md` files and `plans/027-baseline.md`), then `chore(writeup): bump to 0.5.0` (manifests, catalog, regenerated README).
- The working tree may hold other uncommitted files under `plans/`; leave them out of your commits.
- Do not push or open a PR.

## Steps

### Step 1: Baseline runs (RED)

First create the branch. Then write the review diff once, below, and save it into `plans/027-baseline.md` under `## Review diff`. All runs, in both step 1 and step 4, use this exact diff.

The diff: one file, `hooks/scan.mjs`, with a `@@` hunk header carrying real line numbers. About 15 lines. It adds a function `readConfig(path)` that returns `JSON.parse(readFileSync(path, 'utf8'))` with no `try`. A hook calls it, and the hook's header comment says it must never crash. Exactly one bug, no other issues.

**Dispatch protocol.** Use the `Agent` tool, `subagent_type: general-purpose`, default model. Each run is a fresh agent. The prompt is the text below, verbatim, with `<SCENARIO>` replaced:

```text
Return only the requested text, in a single fenced block. Do not run any command,
do not call gh or git, do not edit or create any file, and do not invoke any skill.

<SCENARIO>
```

Scenarios (both describe a made-up project, so nothing in this repo contradicts them):

- **Issue**: `You maintain a CLI called csvtool. A user reports: on Windows 11 with Node 22.11.0 and csvtool 3.2.0, running "csvtool merge a.csv b.csv" where b.csv has a UTF-8 BOM prints "Error: column 'id' not found in b.csv", although the first column of b.csv is id. On Linux the same files merge fine. Write the GitHub issue body you would pass to gh issue create, plus the title.`
- **Review**: `Review this diff and write the review body for gh pr review --request-changes:` followed by the saved diff.

Run each scenario 3 times (6 runs). For each run, record in `plans/027-baseline.md` an entry in this format:

```text
### <issue|review> run <n>
Parts present, in order: <list of part names from step 2>
Parts missing: <list>
Banned phrases found: <exact quotes, or "none">
Output:
<the run's full text>
```

"Banned phrases" means a case-insensitive hit on any of: `great`, `nice`, `looks good`, `thanks`, `thank you`, `might want to`, `consider`, `perhaps`, `I think`, `I noticed`, `while working`.

**Verify**: `grep -c "^### \(issue\|review\) run" plans/027-baseline.md` → 6. If no run is missing a required part and no run has a banned phrase, STOP: the skill would fix nothing, so report back.

### Step 2: The contracts

Below are the parts each skill states, in order. Every part is required unless marked optional. Optional parts are not scored. Write the contracts into the skills exactly as given; do not drop parts.

`writeup:issue`. Bug report:

1. **Title.** The observed failure in one line, present tense, no "bug:" prefix unless the repo's labels or title log use one.
2. **What happens.** Observed behavior, exact error text in a `text` fence, trimmed to the decisive lines.
3. **Expected.** One line.
4. **Repro.** Numbered minimal steps from a clean state; commands copy-pasteable.
5. **Environment.** Only versions that bear on it (OS, runtime, tool version), copied from the report. A version the report did not give is left out, never invented.
6. **Cause** (optional). Only when verified, with `file:line`; a guess is labeled as one.

Feature request (written into the skill, not scored by the runs): **Title** names the capability; **Problem** says who hits what today; **Proposal** gives the behavior wanted; **Alternatives** is optional. An issue comment (`gh issue comment`) gives one new fact per comment: a repro result, a version, a verified cause. Repo has `.github/ISSUE_TEMPLATE/`: use the matching template's sections in order and put each part in its closest section.

Leave-out list: thanks and greetings, the agent's session story ("while working on X I noticed"), a fix nobody asked for, attribution to the model.

Done line: a reader who never saw the session can reproduce the bug (or state the problem) from the issue alone, and every claim of cause is verified or labeled a guess.

`writeup:review`:

1. **Verdict first.** Review body opens with the decision matching the flag (`--approve`, `--request-changes`, `--comment`) and the count of blocking items.
2. **Each comment.** Starts with a label: `blocking`, `non-blocking`, or `nit`. Then the location (`path:line`), the failure as a concrete scenario (input or state, then wrong result), and the fix.
3. **Order.** Blocking first, then non-blocking, then nits.

Leave-out list: praise padding, restating what the diff does, points the linter or formatter enforces, hedges ("might want to consider").

Done line: every `blocking` or `non-blocking` comment names a failure scenario and a fix, and the verdict matches the flag.

Scope: the review body and comments posted with `gh pr review` or `gh pr comment`. Inline line comments posted through `gh api` are not covered.

No verify for this step: it is the spec for step 3.

### Step 3: Write the two skills (GREEN)

Create both files in the house style shown in "Current state". Frontmatter:

```yaml
---
name: issue
description: Use when writing or editing a GitHub issue or issue comment, or before running `gh issue create`.
---
```

```yaml
---
name: review
description: Use when writing a code review or review comment, or before running `gh pr review` or `gh pr comment` on someone's PR.
---
```

First body line of each: `**REQUIRED:** apply writeup:unslop to all prose.` One short example per skill, in a `text` fence. Write it yourself; do not copy a run's output. The issue example uses a different made-up bug, not the csvtool one, so the step-4 runs cannot copy it. The review example is one blocking comment on a different bug than the saved diff.

`scripts/skill-lint.mjs` checks every line, fenced examples included, and fails validate on text that looks like another plugin's skill name: a catalog plugin name (`review`, `css`, `prompt`, `tutor`, `workbench`, …) directly followed by `:` and a non-space. In examples, write `path:line` locations with real file paths (`src/merge.js:42`), never with a word like `review:` or `css:`.

**Verify**:

- `wc -c plugins/writeup/skills/issue/SKILL.md plugins/writeup/skills/review/SKILL.md` → each under 24576 bytes.
- `grep -x "name: issue" plugins/writeup/skills/issue/SKILL.md && grep -x "name: review" plugins/writeup/skills/review/SKILL.md` → both lines print (validate does not check that the name matches the folder).
- `npm run validate 2>&1 | grep -i writeup | grep -i -E "fail|error"` → prints nothing.

### Step 4: With-skill runs

Repeat step 1's protocol. Add the new skill's full `SKILL.md` text to each prompt, between the first paragraph and the scenario, under the line `Follow these instructions:`. Also paste `plugins/writeup/skills/unslop/SKILL.md` below it, since the skill requires unslop and the run may not invoke skills. Record entries in the same format under a `## With skill, round <r>` heading.

A run **passes** when it has every required part in order and no banned phrase. A round passes when each scenario passes at least 2 of 3 runs and at least 5 of 6 pass in total.

**Verify**: the latest round passes. If it does not, tighten the wording of each failing part (state its shape more precisely, as a positive recipe; do not lengthen the leave-out lists). Then run a full new round of 6. After round 3 still failing: STOP.

### Step 5: Version and description

Set `"version": "0.5.0"` in both writeup manifests. Set this description in both manifests and in the writeup entry of `.claude-plugin/marketplace.json`:

`PR descriptions, commit messages, issues and review comments written for people: plain prose, structural diagrams, slop caught before it publishes.`

Add `"issues"` and `"code-review"` to `keywords` in `plugins/writeup/.claude-plugin/plugin.json`.

Then run `npm run site:data`. It rewrites README's generated regions and `site/src/data/marketplace.json`; the latter is gitignored and does not show in `git status`.

**Verify**:

- `grep -c "slop caught before it publishes" plugins/writeup/.claude-plugin/plugin.json plugins/writeup/.antigravity-plugin/plugin.json .claude-plugin/marketplace.json` → 1 for each file (validate does not compare the catalog with the manifests).
- `grep -n "/writeup:issue\|/writeup:review" README.md` → at least one hit, on the writeup `- Commands:` line.
- `npm run validate 2>&1 | grep -i writeup | grep -i -E "fail|error"` → prints nothing.

### Step 6: Repo gate

**Verify**: `npm run format:check && npm test` → exit 0. If format fails only on in-scope files, run `npx prettier --write` on them and re-check.

## Test plan

The skills are prose; their tests are the step-1 and step-4 subagent runs, recorded in `plans/027-baseline.md`. `npm run validate` checks strict YAML frontmatter and the skill-lint rules; step 3's `grep -x` checks the names.

## Done criteria

- [ ] Step 3's three verify commands give the expected results
- [ ] `grep -c "^### \(issue\|review\) run" plans/027-baseline.md` ≥ 12, and the latest `## With skill, round <r>` section passes per step 4 (reviewer re-scores it from the recorded outputs)
- [ ] `grep -c '"0.5.0"' plugins/writeup/.claude-plugin/plugin.json plugins/writeup/.antigravity-plugin/plugin.json` reports 1 each
- [ ] Step 5's three verify commands give the expected results
- [ ] `npm run format:check` and `npm test` exit 0
- [ ] `git status --short -- ':!plans'` lists only in-scope files
- [ ] `plans/README.md` row 027 status reads `DONE (branch writeup/plan-027-issue-review-skills @ <sha>; round <r> passed <n>/6)`

## STOP conditions

- Step 1's baseline shows no failure to fix.
- No subagent tool is available: write the skills from step 2's contracts, mark the row `DONE (untested: no subagent runs)` and say so in your report. Do not invent run results.
- `npm run validate` rejects a skill name or description and the fix is not quoting.
- Step 4 still fails after round 3.
- A subagent run executes a command or posts to GitHub despite the prompt: stop all runs and report.

## Maintenance notes

- The scan's `ENDING` sentences for `issue`, `comment` and `review` (plan 026) and these skills describe the same commands; keep them consistent if either changes.
- If plans 025 or 026 are rejected, still bump to 0.5.0: the new skills alone justify a minor version.
- Deferred: a release-notes skill (`gh release create --notes`), not chosen by the maintainer this round.
