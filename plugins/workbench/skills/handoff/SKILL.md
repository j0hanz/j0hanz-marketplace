---
name: handoff
description: Compact this session into a handoff file the next one starts cold from — state, dead ends, and the skill it runs first.
argument-hint: 'What will the next session be used for?'
disable-model-invocation: true
---

# Handoff

The reader is a **cold start**: a fresh session holding none of this conversation, only the repo and this file.

So the file carries **what dies with this session** — the reasoning, the dead ends, the live working state. Everything the repo already holds is a link, never a copy: specs, plans, run logs, ADRs, issues, commits, diffs. A handoff that restates a plan is a stale copy of it by the next commit.

The argument names what the next session is for, and narrows the file to it — keep what bears on that job, link the rest.

## Rules

Write from the repo, not from memory. Reopen every file you cite, and record the branch and `git rev-parse --short HEAD` so the next session can tell drift from disagreement.

Live state is the part nothing else records: uncommitted files and what is in them, stashes, servers left running, hand-set env vars, a migration applied to a local database. Name it or it is lost.

A dead end carries the reason it died. "Tried X" invites a second run at X; "X fails because the API returns Y" closes it.

Route to one skill, not a list — [plan](../plan/SKILL.md)'s Routes table picks it. Write it as the command the next session types, `/workbench:run-plan`, since half the bench is user-invoked and fires no other way.

Secrets follow the [write-plan rule](../write-plan/SKILL.md#secrets): name the `file:line` and the credential type, recommend rotation. Personal data goes the same way — the location, not the value.

**Done when** the file names the branch and SHA, every claim that cannot be recovered from the repo is on the page and everything else is a link that resolves, each dead end carries its reason, the next step is one concrete action, one route command is named, and no credential or personal data survives the read-through.

## Referencing

The file lives in the OS temporary directory (`%TEMP%`, `$TMPDIR`) as `<slug>.handoff.md` — session scaffolding, outside the workspace. Where the work already keeps a change directory and the handoff has to outlive the session, write it there as `<name>.handoff.md` under the [referencing convention](../write-specs/SKILL.md#referencing) instead.

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

Only what the repo cannot tell you: uncommitted files and what is in them,
stashes, running processes and their ports, hand-set env vars, local data
changes. "Clean tree, nothing running" where that is the truth.

## Decided here

Decisions made in this conversation and written down nowhere else, each with
the reason. One that outlives this change belongs in an ADR
(`/workbench:write-adr`) — link the record here rather than repeat it.

## Ruled out

- <approach> — <the evidence that killed it>

## Open

- <question> — <who or what settles it>

## Next

1. <one concrete action, with the command that proves it worked>
2. …

## Artifacts

| What      | Where             |
| :-------- | :---------------- |
| Spec      | `<absolute path>` |
| Plan      | `<absolute path>` |
| PR, issue | `<url>`           |
```

Report the path when it is written — the next session opens by reading it.
