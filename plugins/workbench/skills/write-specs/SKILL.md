---
name: write-specs
description: Spec the observable behavior a change must deliver, fixed before any code or plan exists. Use when asked to spec a feature, or to capture what a built system already guarantees. Not for the execution route (write-plan), verifying a built system (verify-specs), or reader-facing prose documents (writing-docs).
---

# Write Specs

A spec fixes **what** must be observably true; a plan fixes **how**. A requirement is **black-box** or it is prose — paths, function names, and libraries belong in the plan.

## Steps

### 1. Ground it

Read the system before describing it — existing code, related specs, whatever fixes the vocabulary. Fan out [research](../research/SKILL.md) where the repo holds the answer; it reads while you write. Resolve what you can from that material; where it is silent, state the default you chose as an assumption. Leave a `[NEEDS CLARIFICATION: <question>]` marker inline instead only where a wrong guess would invalidate a requirement rather than adjust it. Ask the user only what the material cannot answer — [grilling](../grilling/SKILL.md) is how.

**Done when** every claim is traceable on the page: a link to what you read, a quoted user answer, a line in Assumptions, or a marker.

### 2. Write it

Fill the template. Requirements get stable IDs (`R1`, `R2`, …) — the plan references them and test names cite them verbatim ([tdd](../tdd/SKILL.md)). IDs are never renumbered; new ones append.

**Done when** every requirement has a stable ID and at least one scenario, every input has a malformed-version requirement, every dependency an outage requirement, every list an empty case, and every reference out of the file is a working relative link.

### 3. Falsify it

Its own pass over the finished set — contradictions and missing story behavior are only visible across requirements, never inside one.

Per requirement, name the single observation that proves it false, on the page beside its ID; [verify-specs](../verify-specs/SKILL.md) runs it once the change lands. If you cannot name one, it is prose — rewrite until a black-box observer could fail it. Then read the set once as a whole.

**Done when** every requirement carries its falsifying observation, every story in Users and stories names the requirement IDs that deliver it, and every marker appears in the open-questions list.

## Requirement syntax

One obligation per statement, in the EARS pattern matching its trigger. `shall` is the load-bearing verb.

| Pattern      | Template                                                             | Use for                    |
| ------------ | -------------------------------------------------------------------- | -------------------------- |
| Ubiquitous   | The `<system>` shall `<response>`                                    | property that always holds |
| State-driven | While `<state>`, the `<system>` shall `<response>`                   | holds during a condition   |
| Event-driven | When `<trigger>`, the `<system>` shall `<response>`                  | response to an event       |
| Optional     | Where `<feature is included>`, the `<system>` shall `<response>`     | flagged or variant builds  |
| Unwanted     | If `<trigger>`, then the `<system>` shall `<response>`               | errors, failures, abuse    |
| Complex      | While `<state>`, when `<trigger>`, the `<system>` shall `<response>` | both, when both matter     |

**Unwanted behavior** is the pattern that gets skipped and the one that ships broken.

Quality claims carry a number and a measurement point — not "fast" but "within 200 ms at p95, measured at the API boundary".

Scenarios use Given/When/Then, one per branch:

```markdown
- **R4** When a session token has expired, the API shall reject the request.
  - Falsified by: a read with an expired token returning anything but 401.
  - Given an expired token, When a read is requested, Then the response is 401.
  - Given a valid token, When a read is requested, Then the response is 200.
```

## Referencing

A change keeps one directory: `docs/plan/YYYY-MM-DD-<name>/`, dated the day it is created — by whichever skill creates it first. Every artifact scoped to that change sits in it: `<name>.spec.md`, `<name>.plan.md`, `<name>.run.md`, `<name>.verify.md`, and the QA set `<name>.test-plan.md`, `<name>.cases.md`, `<name>.regression.md` ([write-qa](../write-qa/SKILL.md)). This is the convention every skill downstream links to rather than restates.

A record that outlives the change that made it sits outside those directories: decisions at `docs/adr/` ([write-adr](../write-adr/SKILL.md)), QA standing records at `docs/qa/` ([write-qa](../write-qa/SKILL.md)). Where such a record is numbered, the number is `NNN-<slug>`, zero-padded, the next one found by scanning its directory.

Links are relative to the file they sit in. Depth from a file to repo source:

| File                             | Lives in                   | Repo root is   |
| :------------------------------- | :------------------------- | :------------- |
| spec, plan, run log, verdict, QA | `docs/plan/<dir>/`         | `../../../`    |
| ADR                              | `docs/adr/`                | `../../`       |
| QA standing record               | `docs/qa/`                 | `../../`       |
| frontier map                     | `docs/plan/<dir>/`         | `../../../`    |
| frontier ticket                  | `docs/plan/<dir>/tickets/` | `../../../../` |

```markdown
related spec [`auth spec`](auth.md)
decision [`ADR-004`](../../../docs/adr/004-tokens.md)
existing code [`db.ts:40-60`](../../../src/lib/db.ts#L40-L60)
requirement [`R2`](auth.md#requirements)
```

Requirement IDs are cited by label and linked to their section. Terms the spec defines stay in backticks (`token_expired`) — a reader greps for them.

## Template

```markdown
# Spec: <system or feature name>

<One sentence: what this does for whom.>

## Why

2–5 sentences. The problem, who hits it, what it costs today, what is true once
this exists. Intent is what lets a correct judgment call happen later when a
requirement turns out to be underspecified.

## Users and stories

Prioritized, each a slice that could ship and be demonstrated on its own, each
naming the requirement IDs that deliver it:

- **P1** — As a <user>, I want <capability>, so that <outcome>. (R1, R4)

## Requirements

- **R1** The `<system>` shall …
  - Falsified by: <the single observation that proves it false>
  - Given …, When …, Then …
- **R2** If <bad input>, then the `<system>` shall …
  - Falsified by: …
  - Given …, When …, Then …

## Constraints

Non-functional bounds. Existing decisions this must stay consistent with,
quoted, each linked to its source ([write-adr](../write-adr/SKILL.md) writes
them): "tokens expire at 24 h — [`ADR-004`](rel-path)".

## Out of scope

What a reader would expect and will not get, one line of why each.

## Success criteria

2–4 measurable, technology-agnostic outcomes — observable without reading the
source.

## Assumptions and open questions

Defaults you chose where the input was silent, stated as choices. Then every
`[NEEDS CLARIFICATION]` marker still in the file, each linked to the
requirement it blocks, with who can answer it.
```

## Spec delta

Amending a spec that already exists is a **delta** against its current IDs, never an edit in place, so a reader sees exactly what moved. It lives beside the spec it amends, under the [referencing convention](#referencing), headed by a link to that spec: "amends [`auth spec`](auth.md)". [verify-specs](../verify-specs/SKILL.md) folds it into the canonical spec once the change ships, IDs intact.

```markdown
## ADDED

- **R9** When … the system shall …
  - Falsified by: …
  - Given …, When …, Then …

## MODIFIED

- **R3** was: <old text> — now: <new text>. Reason: <one line>.

## REMOVED

- **R5** — <why it no longer applies>
```

When the behavior is settled and the question becomes how to build it, hand off to [write-plan](../write-plan/SKILL.md).
