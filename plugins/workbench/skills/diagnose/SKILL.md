---
name: diagnose
description: Reproduce a reported symptom and narrow to its root cause by running the code — bisect commits or narrow inputs, not static tracing. Use when a bug's cause is unknown and must be reproduced before fixing. Not for static correctness review (bug-hunt), reading sources (research), or writing the fix (write-plan).
---

# Diagnose

A reported symptom is a cause's shadow, and the first plausible cause is usually wrong. diagnose **reproduces before it names** — it runs the code to make the symptom happen, then narrows by running more, until the cause is pinned to a line or a state. A cause named without a reproduction is a guess, and a guessed cause fixes the symptom for one input and leaves the bug for the next.

It is the runtime skill [bug-hunt](../bug-hunt/SKILL.md) is not: bug-hunt traces statically and never executes; diagnose runs. It is not [research](../research/SKILL.md) (reading sources, not running them) and not [write-plan](../write-plan/SKILL.md) (the fix, not the cause).

Use it when a bug's cause is unknown and must be reproduced before anyone fixes it: a flaky test, a crash only in production, a wrong result on one input.

## Steps

### 1. Reproduce

Before any hypothesis, make the symptom happen. A reproduction is a command, a script, or an input that produces the reported wrong behavior **on demand** — not "I saw it once", but "run this, it fails."

- The symptom reproduces → you have the falsifying observation the fix must drive green. Proceed to step 2.
- The symptom will not reproduce → do not name a cause. Report the non-reproduction, with what you tried, and route to [research](../research/SKILL.md) for the conditions you have not matched, or to the user for the environment difference you cannot see. A cause for a symptom you cannot reproduce is a guess about a ghost.
- The system cannot be run at all — no runner, no build, a dependency that will not install → state the inability and route to [bug-hunt](../bug-hunt/SKILL.md) for a static pass, or to the user. diagnose runs the code; with no runnable system, it has nothing to run.

**Done when** the symptom reproduces on demand, or the non-reproduction or unrunnable system is reported and routed away.

### 2. Narrow by running

With a reproduction, narrow to the root cause by **running the code**, not by reading it alone. Two levers:

- **Bisect commits** — `git bisect` between the last known-good and the failing commit. The run is the oracle: each checked-out commit either reproduces (bad) or does not (good). The commit that flips is where the cause entered.
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

## Hard rules

- **Never name a cause without a reproduction.** A cause for a symptom you have not reproduced is a guess. Step 1 routes away when it will not reproduce.
- **Never name a cause with no runnable system.** No run, no diagnose — route to bug-hunt or the user.
- **Never write the fix.** The fix is [run-plan](../run-plan/SKILL.md)/[tdd](../tdd/SKILL.md)'s axis. diagnose ends at the cause and the repro.
- **Run to confirm, read to guide.** A cause reached by static tracing alone is a hypothesis; the run is what pins it.

## Referencing

The diagnosis lives beside the spec as `<name>.diagnose.md`, under the [referencing convention](../write-specs/SKILL.md#referencing) — the repro, the bisect log or the minimal input, the pinned cause, and the handoff. Where no effort directory exists, it goes to chat and the repro is the command the fix's tdd run uses as red.

```markdown
repro [`BUG-007`](../../../docs/qa/BUG-007-checkout-total-zero.md)
pinned cause [`db.ts:42`](../../../src/lib/db.ts#L42)
handed to write-plan [`write-plan`](../write-plan/SKILL.md)
```

The fix is the next change: write-plan takes the cause and repro, run-plan works it test-first, and [bug-hunt](../bug-hunt/SKILL.md) reviews the landed fix.
