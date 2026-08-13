---
name: run-plan
description: Execute a written plan as its cold executor. Use when handed a plan file to carry out, or resuming one mid-flight. Not for writing the plan (write-plan).
---

# Run Plan

You are the **cold executor** [write-plan](../write-plan/SKILL.md) wrote for.

The plan carries its own contract — Executor rules, Verify lines, Scope, Done, STOP. This skill covers only what the file cannot: where you are in it, and what happens when it breaks.

## Steps

### 1. Orient

Read the whole plan. Establish that it still describes the repo: run its **Drift check** first — its file list is what narrows the excerpt match — then match each **Current state** excerpt in a file it flags. Read the run log beside the plan if one exists; the first unlogged step is where you start.

**Done when** the drift command has run, every Current state excerpt in a flagged file has been matched against that file (a mismatch is a STOP), and the starting step is named.

### 2. Work one step

Do exactly what this step says; the next step starts once this one's Verify has matched. Where the step adds behavior, work it as [tdd](../tdd/SKILL.md): the seams are the step's.

A step carrying no Verify line closes on the **Commands** table instead — every command in it runs and hits its Expected-on-success cell.

**Done when** the step's Verify command has run and matched its expected result.

### 3. Log, then take the next step

Append one line to the run log before starting the next step. The plan itself is never edited — it was written against a commit, and execution state is not part of it.

```markdown
# Run: <plan title>

Executing [`<name>.plan.md`](<name>.plan.md), started <YYYY-MM-DD> at `<short SHA>`.

- **1** 2026-08-13 — done. `pnpm typecheck` → exit 0.
- **2** 2026-08-13 — done. `pnpm test` → 41 passed.
- **3** 2026-08-13 — STOP: `db.ts:40-60` no longer matches Current state.
```

Repeat 2–3 until the steps run out.

**Done when** every step in the plan carries a run log line reading done or STOP.

### 4. Close

Run the **Done** checklist as commands and record each result under `## Done` at the foot of the run log. Report those results to the user, with the plan's Notes review points and every deviation the log holds. Then hand the landed change to the reviewers its risk earns, each on its own axis: [bug-hunt](../bug-hunt/SKILL.md) for correctness and security, [qc](../qc/SKILL.md) for structure, and — where the Goal cites requirement IDs — [verify-specs](../verify-specs/SKILL.md) for behavior. The plan's Done proves the steps ran, not that the code is correct, the structure held, or the behavior arrived.

**Done when** every Done box has a command result behind it and the user has the list.

## Referencing

The run log lives beside the plan it executes as `<name>.run.md`, under the [referencing convention](../write-specs/SKILL.md#referencing) — dated by the plan's directory rather than the day of the run. One log per plan: a retry after a STOP appends to the same file.

```markdown
plan [`<name>.plan.md`](<name>.plan.md)
step [`step 3`](<name>.plan.md#3-<step-slug>)
evidence [`db.ts:42`](../../../src/lib/db.ts#L42)
```

## Stopping

STOP is a report, never a workaround. Name the condition, the step, and the evidence, then hand off:

| What tripped it                          | Hands to                                                      |
| :--------------------------------------- | :------------------------------------------------------------ |
| Behavior the spec got wrong              | [write-specs](../write-specs/SKILL.md#spec-delta), as a delta |
| A decision only the user makes           | [grilling](../grilling/SKILL.md)                              |
| Drift, failed verification, foreign file | the user, with the log line                                   |

Resuming after a STOP clears keeps the old line; a fresh line records the retry.
