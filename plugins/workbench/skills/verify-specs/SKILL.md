---
name: verify-specs
description: Verify a built system against its spec, with a verdict per requirement ID. Use when a change lands against a spec, or before signing one off. Not for writing requirements (write-specs).
---

# Verify Specs

**Black-box** throughout — only an observation tells you what the system does. [write-specs](../write-specs/SKILL.md) names one per requirement; this skill runs them.

## Steps

### 1. Collect the observations

List every requirement ID in the spec beside its falsifying observation. When the change directory holds a `<name>.delta.md`, the spec is the one its `amends` line names with the [delta](../write-specs/SKILL.md#spec-delta) applied: ADDED IDs in, REMOVED IDs out, each MODIFIED ID taking its `now:` text and the delta's falsifier. Where a spec predates the falsifier convention, derive one from the requirement's Given/When/Then — the `Then` is the observable. Where none can be derived, rule it `unobservable`: it is not scored, and step 3 routes it.

**Done when** every ID in the spec has a named observation or an `unobservable` ruling.

### 2. Observe

Run each one against the built system — prefer a test (cite the [tdd](../tdd/SKILL.md) test name); fall back to a command when no test covers it, a manual check only when no automation exists — cite the [write-qa](../write-qa/SKILL.md) case that scripts it, and file what it breaks as a bug record there. An ID whose evidence is an argument rather than an observation is **unmet**.

Unwanted-behavior requirements (`If … then …`) need the bad input actually sent. An error path nobody triggered is **unverified** — not a verdict but step 2 unfinished: fire the trigger.

**Done when** every scored ID carries evidence, and every `If … then …` requirement had its trigger fired.

### 3. Rule, then fold

Every ID gets exactly one verdict: `met`, `unmet`, or `unobservable`. Report the verdict table, then close the loop on the spec itself:

- **Unmet, code is wrong** — hand to [write-plan](../write-plan/SKILL.md) as a follow-up plan naming the IDs.
- **Unmet, spec is wrong** — hand to [write-specs](../write-specs/SKILL.md#spec-delta) as a delta; behavior changes in the spec first.
- **Unobservable** — hand to [write-specs](../write-specs/SKILL.md#spec-delta) as a delta that rewrites the requirement until it carries a falsifying observation a black-box observer could fail.
- **Every ID met** — fold the change's `<name>.delta.md`, if any, into the spec it amends: ADDED entries appended to Requirements, each MODIFIED entry replaced by its `now:` text with the delta's falsifier and scenarios, each REMOVED entry deleted — IDs intact, never renumbered.

**Done when** every ID carries one of the three verdicts, every `unmet` and `unobservable` ID names its handoff, the verdict is written to its file, and a folded spec keeps the Requirements entry shape — no `ADDED`, `MODIFIED`, or `REMOVED` heading left in it.

## Referencing

The verdict lives beside the spec as `<name>.verify.md`, under write-specs' [referencing convention](../write-specs/SKILL.md#referencing). Verifying again after fixes appends a dated section; the first verdict stays — which requirements failed and when is the record.

```markdown
spec [`<name>.spec.md`](<name>.spec.md)
requirement [`R2`](<name>.spec.md#requirements)
evidence [`auth.test.ts:88`](../../../src/auth/auth.test.ts#L88)
```

## Report

```markdown
# Verification: <spec name>

Against [`<name>.spec.md`](<name>.spec.md), commit `<short SHA>`, <YYYY-MM-DD>.

| ID  | Verdict      | Observation            | Evidence                                  |
| --- | ------------ | ---------------------- | ----------------------------------------- |
| R1  | met          | expired token rejected | `pnpm test auth` → 401, `auth.test.ts:88` |
| R2  | unmet        | empty list renders     | renders `undefined`, no empty case        |
| R7  | unobservable | —                      | "fast" carries no number                  |

## Unmet and unobservable

- **R2** — <what was observed instead, or why no observation exists>. Handoff: <follow-up plan or spec delta>.

## Folded

- <the delta folded into the spec it amends, or "none">
```

## Handing off

Every ID met is the chain's end, not a stop: say so plainly and name what the
change still owes — [bug-hunt](../bug-hunt/SKILL.md) if correctness was never
reviewed, [qc](../qc/SKILL.md) if the structure was not, neither if run-plan
already routed both. A spec signed off with no reviewer having read the diff is
a verdict on behavior alone.
