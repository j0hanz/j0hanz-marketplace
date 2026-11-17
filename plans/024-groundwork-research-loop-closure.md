# Plan 024: Route research findings into the domain model

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 4e32151..HEAD -- plugins/groundwork/skills/research/SKILL.md plugins/groundwork/.claude-plugin/plugin.json plugins/groundwork/.antigravity-plugin/plugin.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live file before proceeding; on a
> mismatch, treat it as a STOP condition. Sibling plans 021/022 only touch the
> version fields of the manifests — a version bump past `0.5.0` from them is
> expected and tolerated.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (soft: run after 021/022 so one of them owns the version bump)
- **Category**: direction
- **Planned at**: commit `4e32151`, 2026-11-17

## Why this matters

The groundwork plugin's promise is that thinking artifacts land in a durable domain model: `GLOSSARY.md` for terms, ADRs for decisions. Every sibling skill closes that loop — `prototype/SKILL.md:38` and `improve-codebase-architecture/SKILL.md:66-71` both route new terms and rejected candidates into `groundwork:domain-modeling`. `research` is the one skill that surfaces new terms and contradicts settled decisions for a living, yet its 13 lines end at "save findings somewhere sensible." Findings that sharpen a term or contradict an ADR have no defined path into the model, which is exactly the moment the plugin is for.

This is a design plan from a direction audit: the shape below was chosen to match the plugin's existing loop-closure pattern, kept minimal so research stays the plugin's deliberately thin skill.

## Current state

`plugins/groundwork/skills/research/SKILL.md` — the whole file today:

```markdown
---
name: research
description: Use when the user wants a topic researched against primary sources, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up **background agent** for research, so you keep working while it reads.

Its job:

1. Investigate question against **primary sources** (official docs, source code, specs, first-party APIs), not secondary write-up. Trace every claim to source that owns it.
2. Write findings to single Markdown file, cite each claim's source.
3. Save where repo already keeps such notes; match existing convention. If none, put somewhere sensible, say where.
```

The loop-closure pattern to match (from `plugins/groundwork/skills/prototype/SKILL.md:38`):

```markdown
3. Decision with load-bearing reason future readers would re-litigate? Call Skill tool with `groundwork:domain-modeling`, offer ADR. New domain terms surfaced? Same skill, update `GLOSSARY.md`.
```

And the restraint pattern (from `plugins/groundwork/skills/improve-codebase-architecture/SKILL.md:56`): "Don't list every theoretical refactor ADR forbids" — integration fires only when findings actually surface something, never unconditionally.

## Commands you will need

| Purpose                | Command                                                | Expected on success |
| ---------------------- | ------------------------------------------------------ | ------------------- |
| Scoped plugin validate | `claude plugin validate ./plugins/groundwork --strict` | exit 0              |
| Full validation        | `npm run validate`                                     | exit 0              |

`npm run validate` needs `claude` on PATH (repo CLAUDE.md). A failure pointing at a path outside `plugins/groundwork/` is pre-existing noise for this plan: report it, do not chase it.

## Scope

**In scope** (the only files you should modify):

- `plugins/groundwork/skills/research/SKILL.md`
- `plugins/groundwork/.claude-plugin/plugin.json` (version bump only, if 021/022 have not bumped it)
- `plugins/groundwork/.antigravity-plugin/plugin.json` (same)
- `plans/README.md` (status row)

**Out of scope** (do NOT touch, even though they look related):

- The `description` frontmatter of `research/SKILL.md` — it stays within the 40-word budget (`scripts/skill-lint.mjs` BUDGET) and needs no change.
- `plugins/groundwork/skills/domain-modeling/*` — the skill being pointed at; it already defines when to offer an ADR ("Offer ADRs sparingly", `ADR-FORMAT.md`).
- Any other groundwork skill.

## Git workflow

- Branch: `groundwork/plan-024-research-loop`
- One commit. Subject style, matching `git log`:
  `feat(groundwork): route research findings into the domain model`
- End the commit message with:
  `Co-Authored-By: Claude Code <noreply@anthropic.com>`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Append the loop-closure section

At the end of `plugins/groundwork/skills/research/SKILL.md`, after the numbered list, append exactly:

```markdown
## After the report lands

Findings that surface a term or contradict a recorded decision route into the domain model:

- New or sharpened term? Call Skill tool with `groundwork:domain-modeling`: update `GLOSSARY.md`.
- Finding contradicts an ADR in `docs/adr/`? Say so in the report; maintainer decides whether to reopen. Don't quietly re-litigate a recorded decision.
- Label findings with `GLOSSARY.md` terms where project has one.
```

Keep the file's voice: terse, imperative, `Call Skill tool with` for chaining (same phrasing as `prototype/SKILL.md:38`), no em dashes (the writeup plugin in this repo flags them).

**Verify**: `grep -n "^## After the report lands$" plugins/groundwork/skills/research/SKILL.md` → one match. `grep -n "groundwork:domain-modeling" plugins/groundwork/skills/research/SKILL.md` → one match. `grep -c "^- " plugins/groundwork/skills/research/SKILL.md` → 3.

### Step 2: Bump the plugin version (only if 021/022 have not)

In both manifests, if the version is still `0.5.0`, change it to `0.5.1` in `plugins/groundwork/.claude-plugin/plugin.json` and `plugins/groundwork/.antigravity-plugin/plugin.json` alike. If either file already reads `0.5.1` or higher, leave both untouched.

**Verify**: `node -p "require('./plugins/groundwork/.claude-plugin/plugin.json').version === require('./plugins/groundwork/.antigravity-plugin/plugin.json').version"` → prints `true`.

### Step 3: Validate

**Verify**: `claude plugin validate ./plugins/groundwork --strict` → exit 0. Then `npm run validate` → exit 0 — it re-runs `scripts/skill-lint.mjs`, which resolves the `groundwork:domain-modeling` reference and the markdown links. Failures on paths outside `plugins/groundwork/` are pre-existing noise: report, don't chase.

## Test plan

No new tests: prose in a skill file; `node --test` covers scripts only. `skill-lint` under `npm run validate` is the guard that the appended `groundwork:domain-modeling` reference names a real skill in this plugin (it fails `validate` if it does not).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plugins/groundwork/skills/research/SKILL.md` ends with the appended `## After the report lands` section, bullets byte-identical to the plan
- [ ] `claude plugin validate ./plugins/groundwork --strict` → exit 0
- [ ] `npm run validate` → exit 0, or failures only outside `plugins/groundwork/`
- [ ] Both manifests carry the same version, at least `0.5.1`
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The `research/SKILL.md` excerpt does not match the live file, or the file has grown beyond 13 lines (drift since `4e32151`).
- `npm run validate` reports the appended `groundwork:domain-modeling` reference as `not found` — that means the plugin's skill set changed under the plan; report the live skill list.
- A verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The appended section deliberately does not make research offer ADRs directly: ADR restraint lives in `groundwork:domain-modeling` ("Offer ADRs sparingly", `domain-modeling/SKILL.md:68-73`). If domain-modeling's rules change, research inherits them; don't fork them here.
- Watch in review: the bullets must not grow ceremony — research staying thin is a design choice, not an oversight. If it needs more than these three bullets later, promote it to its own reference doc like `LOGIC.md`.
- Deferred: none.
