---
name: write-plan
description: Plan a change as an implementation file a cold executor can follow — another agent, or a future session. Use when a change is understood and the question is how to build it, from a pinned cause, a settled spec, or a review finding to act on. Not for deciding what the behavior should be (write-specs), executing the plan (run-plan), or work too big for one session (frontier).
---

# Write Plan

It is read by a **cold executor**: a session with no memory of yours, possibly a cheaper model.

Three properties make a plan executable by that reader:

1. **Self-contained** — every path, excerpt, convention, and command is in the file. "As discussed above" is a broken plan.
2. **Gated** — each step ends in a command with an expected result, so the executor never has to _judge_ whether it worked.
3. **Bounded** — an explicit out-of-scope list, and STOP conditions that end the run.

## Steps

### 1. Recon

Open every file the plan will name. Fan out [research](../research/SKILL.md) when the change touches more files than you can open in one pass — it maps callers and conventions while you route, and you still open what the plan names. Run every command it will cite — guessed commands are the most common way a plan dies on contact. Record `git rev-parse --short HEAD`. Note the conventions the change must match, each with one exemplar file to imitate.

**Done when** every path, symbol, and command destined for the plan has been verified against the repo, every convention the change must match has a linked exemplar file to imitate, and the SHA is recorded.

### 2. Route

Order the steps so the build stays passing between them — e.g., add the new path, switch the callers, then delete the old one. Where the change spans layers, make the first step a thin **vertical slice** and widen from there. Tests are steps, not a wish at the end — a step that adds behavior is worked test-first by [tdd](../tdd/SKILL.md), so its Verify command is the suite.

**Done when** each step verifies on its own, and the step list reads in that order — every new path added before the caller switch, every caller switch before the deletion.

### 3. Write, then read it cold

Fill the template, then reread it as the executor. Wherever you filled a gap from memory, inline the missing fact.

**Done when** every **Current state** excerpt has been re-opened at its `file:line` and matched, every step is Gated, every file and symbol mention is a working relative link, every out-of-scope file is listed with a reason touching it is wrong, each STOP condition names a risk specific to this change, and every Verify command has been run and produced its expected output.

## Referencing

Every file, line, and symbol the plan names is a link, so the executor opens it instead of searching for it. A plan lives beside its spec as `<name>.plan.md`, under the [referencing convention](../write-specs/SKILL.md#referencing) — paths relative to the plan file.

```markdown
file [`src/lib/db.ts`](../../../src/lib/db.ts)
line [`db.ts:42`](../../../src/lib/db.ts#L42)
range [`db.ts:40-60`](../../../src/lib/db.ts#L40-L60)
symbol [`Pool.acquire()`](../../../src/lib/db.ts#L40)
requirement [`R2`](<name>.spec.md#requirements)
sibling spec [`<name>.spec.md`](<name>.spec.md)
```

Commands, flags, patterns, and expected output stay in plain backticks — nothing to open.

## Template

```markdown
# Plan: <imperative title — what is true once this lands>

> **Executor rules**: work the steps in order. Run every Verify command and
> confirm its expected result before moving on. On any STOP condition, stop and
> report the condition, the step, and the evidence.
>
> **Written against** commit `<short SHA>`, <YYYY-MM-DD>.
> **Drift check (run first)**: `git diff --stat <SHA>..HEAD -- <in-scope paths>`
> Its file list is what narrows the excerpt match: compare
> [Current state](#current-state) against the live code for every file it flags.
> A mismatch is a [STOP](#stop) condition.

## Goal

2–5 sentences: the problem, its concrete cost, what improves when this lands.
Requirements covered: [`R2`](<name>.spec.md#requirements), [`R5`](<name>.spec.md#requirements)
— or "none, this is a fix".

## Current state

The facts, inlined — every excerpt readable without opening another document:

- [`<path>`](<rel-path>#L10-L40) — its role here, and the lines that matter
- Short excerpts as the code exists today, each headed by its linked
  `file:line`, enough that the executor can confirm it is looking at the right
  thing
- Each convention to match, with its linked exemplar: "errors follow the
  pattern in [`result.ts:12-30`](<rel-path>#L12-L30)"
- Any decided constraint from a spec or ADR, quoted, with the source linked —
  the executor has not read those documents

## Commands

| Purpose   | Command | Expected on success |
| --------- | ------- | ------------------- |
| Typecheck | `<cmd>` | exit 0, no errors   |
| Tests     | `<cmd>` | all pass            |

## Scope

**In scope** — the only files to modify:

- [`<path>`](rel-path)

**Files out of scope** — leave alone even though they look related:

- [`<path>`](rel-path) — <why touching it is wrong>

## Steps

### 1. <imperative title>

Exactly what to do, with every file and symbol linked. Include the target shape
where it is load-bearing — the pattern to produce, not every line.

**Verify**: `<command>` → `<expected output>`

### 2. …

## Done

Machine-checkable. All must hold:

- [ ] `<typecheck cmd>` exits 0
- [ ] `<test cmd>` exits 0, including the new tests for <case>
- [ ] `git status` shows no files outside the in-scope list

## STOP

Stop and report if:

- The code at a [Current state](#current-state) location does not match its
  excerpt.
- A step's verification fails twice after one fix attempt — a second failure
  means the step's assumption is wrong, not its implementation.
- The fix appears to require an out-of-scope file.
- <the key assumption this plan rests on> turns out to be false.

## Notes

- What a reviewer should scrutinize, and anything deliberately deferred.
- Rollback, as commands — for migrations, deletions, and production data only.
```

## Sizing

The full template is the default. For a change touching at most two files with no ordering constraint, keep Goal, Current state, Steps with their Verify lines, and Done.

## Secrets

Secrets never appear in a plan: reference `file:line` and the credential type, and recommend rotation.
