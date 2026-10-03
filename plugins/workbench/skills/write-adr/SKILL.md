---
name: write-adr
description: Record a settled decision as an ADR. Use when the decision will outlive the effort that made it. Not for behavior a change must deliver (write-specs), or decisions not yet settled (grilling).
---

# Write ADR

An ADR fixes **why the system is shaped this way**, so the next reader argues with the reasoning instead of re-running it. Write one once the decision is settled — [grilling](../grilling/SKILL.md) is where that happens.

It earns a record when it constrains work that has not started: a technology, a boundary, a protocol, a convention everything downstream must match. A choice reversible in an afternoon is a code comment.

## Rules

One decision per record, titled as the decision rather than its topic — "Issue RS256 JWTs, verified per service", not "Authentication".

Each option carries the one line that lost it. Where nothing was rejected, go find what was. Where nothing was, it is not an ADR — write the choice as a code comment at the site it shapes, or, before that code exists, as a line in the governing spec's Constraints ([write-specs](../write-specs/SKILL.md)).

Consequences include what got worse. The cost accepted is the one thing a reader cannot reconstruct from the code.

An accepted record stays as written — its reasoning stood on facts true that day. Supersede instead: a new record, plus one line on the old one linking it.

Done when the record is written to `docs/adr/NNN-<slug>.md` under the next free number, titled as one decision statement, carries at least one rejected option with the line that lost it, states the decision as a commitment, and names the cost accepted in Consequences. (The supersede rule above governs the record's later life and is not part of this check.)

## Referencing

Write the record to `docs/adr/NNN-<slug>.md`: `NNN` is the next zero-padded three-digit number after the highest already in `docs/adr/` (`001` when there is none), `<slug>` the decision in a few kebab-case words. It sits outside the per-change directories under `docs/plan/` — a decision outlives the change that made it.

Paths are relative **to the record**:

```markdown
superseded by [`ADR-012`](012-<slug>.md)
existing code [`db.ts:40-60`](../../src/lib/db.ts#L40-L60)
spec [`auth spec`](../plan/2026-08-13-auth/auth.spec.md)
```

A spec quotes the record from its Constraints by link ([write-specs](../write-specs/SKILL.md)).

## Template

```markdown
# ADR-NNN: <the decision, as a statement>

**Status**: accepted, <YYYY-MM-DD>
**Deciders**: <who confirmed it>

## Context

2–5 sentences: the forces in play — the constraint, the deadline, the system it
has to fit. Facts as they stood, not as they turned out.

## Options

- **<option>** — <the one line that lost it>
- **<option, chosen>** — <the one line that won it>

## Decision

One paragraph, stated as a commitment: "we will …".

## Consequences

- <what this makes easy or cheap>
- <the cost accepted — what got worse>
- <what has to change if it is ever revisited>
```

Superseding touches one line on the old record:

```markdown
**Status**: superseded by [ADR-012](012-<slug>.md), <YYYY-MM-DD>
```
