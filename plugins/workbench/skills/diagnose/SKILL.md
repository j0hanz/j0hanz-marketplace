---
name: diagnose
description: Debug a bug whose cause is unknown. Use on a flaky test, a production-only crash, a wrong result on one input, or any symptom that must be reproduced before fixing. Not for static review of written code (bug-hunt).
---

# Diagnose

A reported symptom is a cause's shadow, and the first plausible cause is usually wrong. diagnose **reproduces before it names** — it runs the code to make the symptom happen, then narrows by running more, until the cause is pinned to a line or a state. A cause named without a reproduction is a guess, and a guessed cause fixes the symptom for one input and leaves the bug for the next.

Triggers: a flaky test, a crash only in production, a wrong result on one input.

## Steps

### 1. Reproduce

Before any hypothesis, make the symptom happen. A reproduction is a command, a script, or an input that produces the reported wrong behavior **on demand** — not "I saw it once", but "run this, it fails."

- The symptom reproduces → you have the falsifying observation the fix must drive green. Proceed to step 2.
- The symptom shows on some runs only → the reproduction is a loop: run the command 20 times and report the failure rate, e.g. `3/20 failed`. In step 2 every run means the whole loop, and a change counts only when it moves the rate; narrow until the rate is 20/20 or 0/20. If the first 20 runs all pass, run 80 more; no failure in all 100 runs → treat it as the non-reproduction below.
- The symptom will not reproduce → do not name a cause. Report the non-reproduction, with what you tried, and route to [research](../research/SKILL.md) for the conditions you have not matched, or to the user for the environment difference you cannot see. A cause for a symptom you cannot reproduce is a guess about a ghost.
- The system cannot be run at all — no runner, no build, a dependency that will not install → state the inability and route to [bug-hunt](../bug-hunt/SKILL.md) for a static pass, or to the user. diagnose runs the code; with no runnable system, it has nothing to run.

**Done when** the symptom reproduces on demand, on every run or at a failure rate measured over 20 runs, or the non-reproduction or unrunnable system is reported and routed away.

### 2. Narrow by running

With a reproduction, narrow to the root cause by **running the code**, not by reading it alone. Default to **bisect commits** when the repro passes on a commit you can name (a release tag, the last deploy, the commit before the suspect change); run the repro there to check. With no such commit, **narrow inputs**.

- **Bisect commits** — `git bisect` between that known-good commit and the failing one. The run is the oracle; the commit that flips is where the cause entered. When that commit's diff is too large to pin a line, narrow inputs on it next.
- **Narrow inputs** — shrink the reproduction to the minimal input that still fails. Remove everything that does not change the outcome; the smallest failing case is the cause's shadow at its sharpest.

Static reading guides the run — it tells you where to bisect and what to strip — but a cause reached by reading alone, with no run to confirm, is a hypothesis, not a pin. Run to confirm.

**Done when** the run has isolated the failing line or state — the smallest input or the bisected commit, confirmed by running — not a plausible region read from the source.

### 3. Pin the cause

Reach the **failing line or state**: the statement whose execution produces the wrong behavior, or the state that makes the next statement go wrong. State it as a cause, not a region: `db.ts:42 — the connection is read after close`, not "something in the db layer."

Hand [write-plan](../write-plan/SKILL.md) two things:

- the **cause** — `file:line` or the state, enough that the fix targets it;
- the **repro** — the reproduction from step 1, which is the fix's **success gate**: the fix is done when the repro goes green and nothing else regresses.

[write-specs](../write-specs/SKILL.md) is bypassed — a bug fix's spec is one requirement, and the repro is its falsifying observation. The fix enters the chain at write-plan, worked as [tdd](../tdd/SKILL.md): red is the repro, green is the fix.

**Done when** the cause is pinned to a line or state and write-plan holds the cause plus the repro as the gate.

### 4. Route the regression

A bug worth a standing check — one that would recur undetected without a test catching it — gets its repro routed to [write-qa](../write-qa/SKILL.md) as a **regression case**, in addition to write-plan. The repro that proved the bug now proves the fix holds. Default to routing it: a reproduced bug is a regression waiting to happen, and the repro is already written.

A bug that cannot recur once fixed, or whose repro is too slow to keep, can skip this — name why.

**Done when** the repro is routed to write-qa when regression-worthy (with the reason when not), alongside the write-plan handoff.

## Referencing

The diagnosis lives in the effort directory as `<name>.diagnose.md`, under the [referencing convention](../write-specs/SKILL.md#referencing) — the repro, the bisect log or the minimal input, the pinned cause, and the handoff. Diagnose usually runs before any other skill on the bug, so where no effort directory exists for it yet, create `docs/plan/YYYY-MM-DD-<name>/` and write the diagnosis there; write-plan's `<name>.plan.md` lands beside it under the same `<name>`.

```markdown
repro [`BUG-007`](../../../docs/qa/BUG-007-checkout-total-zero.md)
pinned cause [`db.ts:42`](../../../src/lib/db.ts#L42)
handed to write-plan [`write-plan`](../write-plan/SKILL.md)
```

The fix is the next change: write-plan takes the cause and repro, run-plan works it test-first, and [bug-hunt](../bug-hunt/SKILL.md) reviews the landed fix.
