---
name: refactor
description: Execute a behavior-preserving structural move — characterize the behavior with a green test first, then move structure with tests as the net. Use when restructuring code whose observable behavior must not change. Not for readability (clean-code), adding behavior (run-plan, tdd), or reviewing structure (qc).
---

# Refactor

Move **structure** with **behavior locked**. The net is a test green before the move and green after — never a judgment that "this looks the same."

Behavior is settled here, and that is what lets you touch structure without a spec or a plan. You enter from [plan](../plan/SKILL.md)'s "behavior-preserving structure change" route or a [qc](../qc/SKILL.md) recommendation, and you bypass [write-specs](../write-specs/SKILL.md) and [write-plan](../write-plan/SKILL.md) — there is no new behavior to specify or route.

A refactor that changes observable behavior is a bug wearing a refactor's clothes. The test net is what catches it.

## Steps

### 1. Pin the behavior

Before any structure changes, establish a **green net** that captures the behavior under the move.

- A passing test already covers the behavior → use it.
- No test covers it → write a **characterization test** that captures the behavior as it is today, not as it should be, and run it green. This is not red-green: the test encodes current behavior, bugs and all, because the move must not change it.
- No runnable check exists at all — no test runner, no script, no REPL command that exercises the target → state the absence and hand to [tdd](../tdd/SKILL.md) to establish one. You do not move structure blind.
- The target has no observable behavior — nothing calls it, or every call is itself dead → flag it dead and hand to [write-plan](../write-plan/SKILL.md) for deletion. There is nothing to characterize.

**Done when** a green test pins every behavior the move touches, or the target is flagged dead or handed off for a missing runner.

### 2. Move the structure

Execute the move: a **rename**, an **extraction**, a **reorder**, or a **deleted comment** — the vocabulary [clean-code](../clean-code/SKILL.md) uses, at the scale [qc](../qc/SKILL.md) would recommend. One move at a time; run the net after each. Green stays green between moves.

A move that cannot finish with the net green stops here — it is not behavior-preserving, and you are at step 3's decline.

**Done when** the structural move is complete and the net is green after every move in it.

### 3. Gate behavior

Run the full net — the characterization tests plus every pre-existing test in scope. The behavior captured in step 1 must reproduce exactly.

- Green → the move held behavior. Proceed.
- Red → the move changed behavior. **Revert that move.** Do not adjust the test to make it pass: a test edited to match new behavior is the net disabled, and the red is the net doing its job.

A move that needs new or changed behavior to make sense — a new branch, a different return on some input, behavior that was not there before — is **declined**, not forced. That is not a refactor; it is new behavior, and it enters the chain at [write-plan](../write-plan/SKILL.md), worked as [tdd](../tdd/SKILL.md). Hand it over with the structural goal named; the plan can carry both.

**Done when** the net is green end to end and no move in this pass introduced behavior, or the behavior-changing move has been declined and handed to write-plan.

### 4. Hand to qc

Structure moved, behavior held, net green: hand the change to [qc](../qc/SKILL.md) to review the **new structure** — the move may be behavior-preserving and still be ugly, mislayered, or indirected past readability. qc is the axis for that; refactor is not.

**Done when** the change is handed to qc with the move named and the net result recorded.

## Hard rules

- **Never add or change observable behavior.** A refactor that does is a bug. The net catches it; reverting catches it; declining the move before it runs prevents it.
- **Never edit a test to make it pass.** A characterization test encodes current behavior; editing it to match a move's result disables the net. Red means revert the move.
- **Tests green before and after.** No green net, no move — step 1 hands off instead.
- **Characterize, do not assert desired behavior.** A characterization test that encodes what the code _should_ do rather than what it _does_ do is a regression test, not a net, and it will lie about a move's safety.
- **Behavior-changing moves are declined, not forced.** They go to write-plan, worked as tdd.

## Referencing

A refactor on a planned change records its net and result beside the plan as `<name>.refactor.md`, under the [referencing convention](../write-specs/SKILL.md#referencing). On a route straight from plan with no effort directory, the result goes to chat and the net is the repo's tests.

```markdown
pinned behavior [`db.test.ts:12`](../../../src/db.test.ts#L12)
handed to qc [`qc`](../qc/SKILL.md)
```
