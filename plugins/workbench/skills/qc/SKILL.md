---
name: qc
description: Review a branch diff for maintainability and return blocking comments. Use once a branch's changes have landed, or when asked to review the maintainability of a diff. Not for correctness bugs (bug-hunt) or test coverage (tdd, verify-specs).
---

Dispatch the review to a background subagent — you keep working while it reviews.

Fill in the refs (hand the subagent refs so it opens the files itself; inline the diff text only where the base ref is unavailable) and pass the template as the agent's prompt.

```text
<diff>
{the refs and files to review, or the inline diff if the base ref is unavailable}
</diff>

<standards>
1. Spaghetti growth. Ad-hoc conditionals, one-off branches, narrow
   edge-case handling, "temporary" flags bolted onto unrelated flows —
   design problems, not style. Default remedy: a dedicated helper or
   module; reach for a state machine or policy object only when control
   flow is what's modeled.
2. Orchestration. Independent work serialized for no reason should run
   parallel; related updates that can leave state half-applied should be
   restructured atomically, orchestration separated from business logic.
   Judge by the brittleness it adds; performance tuning is out of scope.
3. Direct, boring code over magic. Flag **indirection** that adds no
   behavior — thin wrappers and pass-through helpers, and generic
   mechanisms hiding a single data-shape assumption. Delete them, keep
   the direct flow.
4. Type and boundary cleanliness. Flag **escape hatches** where a typed
   contract could exist: unnecessary optionality, `unknown`, `any`,
   cast-heavy code. A silent fallback papering over an unclear invariant
   means the boundary belongs explicit.
5. Canonical layer, canonical helpers. Code lives with the module that
   **owns** the concept — flag leaks in either direction, and bespoke or
   copy-pasted logic where an existing utility already does the job.
6. Giant files. Flag any file this PR pushes from under 1k lines to over
   1k, naming the extraction boundary you would cut on. A waiver names
   its structural reason in the comment; it is never silent.

Hunt code judo: a restructure that uses the existing architecture to
delete complexity outright. The bar is **net deletion** — the diff
removes more than it adds and introduces no new concept, behavior
preserved, code inevitable in hindsight. A change that leaves the
codebase less modular or less legible fails, even when tests pass.
</standards>

<output>
Your final message is the whole deliverable — a single, self-contained
report. Read in full every file the diff touches and check all six
standards against each one; open the report with the list of files you
read. Then report regressions first, then missed code-judo moves; within
each, standard order above. Direct, demanding, lowercase — name the
problem, propose the move as a question. A comment is **blocking** (you
would request changes on it) or it is not worth writing. Close by naming
each file where you looked for a code-judo move and found none. Approve
when every standard is clear and nothing blocking remains.
</output>
```

Relay the review when it returns — the agent's report reaches you, not the user. Acting on it is the next change, at [write-plan](../write-plan/SKILL.md).
