---
name: handoff
description: Compact this session into a file the next one starts cold from — live state, dead ends, and the command it runs first.
argument-hint: '[what the next session picks up]'
disable-model-invocation: true
---

# Handoff

The reader is a **cold start**: a fresh session holding none of this conversation, only the repo and this file.

So the file carries **what dies with this session** — the reasoning, the dead ends, the live working state. Everything the repo already holds is a link, never a copy: specs, plans, run logs, frontier maps, ADRs, issues, commits, diffs. A handoff that restates a plan is a stale copy of it by the next commit.

The argument names what the next session is for, and narrows the file to it — keep what bears on that job, link the rest.

## Rules

Write from the repo, not from memory — `git status` read, every file you cite reopened. Record the branch and `git rev-parse --short HEAD`, so the next session can tell drift from disagreement.

A dead end carries the reason it died. "Tried X" invites a second run at X; "X fails because the API returns Y" closes it.

Route to one skill, not a list — the one whose entry condition the unfinished work actually meets. Write it as the command the next session types, `/workbench:run-plan`, since part of the bench is user-invoked and fires no other way.

Secrets follow the [write-plan rule](../write-plan/SKILL.md#secrets): name the `file:line` and the credential type, recommend rotation. Personal data goes the same way — the location, not the value.

**Done when** the file names the branch and SHA, every path `git status` lists sits in Working state or is named there as unrelated, everything that dies with the session is on the page and everything else is a link that resolves, each dead end carries its reason, one route command is named (First move) and the single command that proves it landed is named (Next), no credential or personal data survives the read-through, and the path has been reported.

## Referencing

The file lives in the OS temporary directory (`%TEMP%`, `$TMPDIR`) as `<slug>.handoff.md`, the slug taken from the job. It is session scaffolding, not a record of the change: it sits outside the effort directories the [referencing convention](../write-specs/SKILL.md#referencing) defines, and it is never committed — the spec, plan, and run log are what the repo keeps.

Outside the repo, relative links do not resolve. Every reference is an absolute path carrying its line, `C:\repo\src\lib\db.ts:42` — not the relative markdown link the other bench artifacts use.

## Template

```markdown
# Handoff: <what the next session is picking up>

**From** <YYYY-MM-DD>, `<absolute repo path>`, branch `<branch>` at `<short SHA>`.
**Job**: <what the next session is for, one sentence>.
**First move**: `/workbench:<skill>` — <why that one>.

## Where it stands

What landed, what is half-done, what has not been touched. One line each.

## Working state

What dies with the session — name it or it is lost: uncommitted files
and what is in them, stashes, running processes and their ports, hand-set env
vars, local data changes. "Clean tree, nothing running" where that is the truth.

## Decided here

Decisions that die with this session, each with the reason. One that outlives this change belongs in an ADR
(`/workbench:write-adr`) — link the record here rather than repeat it.

## Ruled out

- <approach> — <the evidence that killed it>

## Open

- <question> — <who or what settles it>

## Next

The command that proves the first move landed: `<command or output that shows the route started>`.

## Artifacts

| What      | Where             |
| :-------- | :---------------- |
| Spec      | `<absolute path>` |
| Plan      | `<absolute path>` |
| PR, issue | `<url>`           |
```
