# What to Look For

## Builder tells — check these first

Failure modes specific to agent-written code. Highest yield per minute of reading:

- **Contract drift** — function signature, type, field name, or return shape changed in one file, call sites elsewhere still use old one.
- **Invented API** — method, option, or config key called on library or internal module that not exist there. Open definition, confirm exists. Plausible-looking not enough.
- **Half-finished migration** — old and new code paths both present, both live, or callers split between them.
- **Abandoned attempt residue** — dead branches, unreachable code, unused variable computed from previous approach. Noise alone; real signal rewrite stopped halfway.
- **Tests that assert the bug** — test written after code, encoding wrong behavior as expected. Read what test claims vs what it asserts.
- **Confidently wrong error handling** — exception caught and swallowed, error logged but not propagated, failure path returning success-shaped value.
- **Hallucinated configuration** — env vars, feature flags, settings keys read but never defined or documented anywhere.
- **Scope creep** — behavior changed nothing asked for, especially in file task not need touch.
- **Comment/docstring mismatch** — prose describes what earlier version did.

## Core taxonomy

Language-agnostic patterns. Check each consciously against actual code. Never assume category clean because file "seems fine".

- **Logic** — off-by-one, inverted condition, wrong operator, wrong boolean precedence, wrong comparison for type.
- **Null and type safety** — unhandled null/undefined, unsafe cast, missing optional chaining, value not assumed type.
- **Edge cases** — empty, zero, negative, single-element vs many, first and last loop iteration, boundary values.
- **Error handling** — missing handling around fallible calls, wrong error propagated, partial failure leaving inconsistent state.
- **Concurrency and async** — race conditions, unawaited promises, stale closures, state written after teardown, read-then-write without atomicity.
- **Resource leaks** — unclosed handles, streams, connections, transactions; listeners and subscriptions never removed.
- **State** — mutation of what should be immutable, derived state going stale, double application of update.
- **API contract mismatch** — caller and callee disagree on field name, type, nullability, or required parameter.
- **Persistence** — schema/code disagreement, missing migration, unhandled unique-constraint violation, writes outside transaction that must be atomic.
- **Performance with correctness cost** — N+1 queries, unbounded growth, O(n²) where input can get large. Not micro-optimization.
- **Dependencies** — deprecated or vulnerable versions, conflicting requirements, use of API slated for removal.
