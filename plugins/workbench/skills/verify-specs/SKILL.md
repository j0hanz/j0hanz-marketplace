---
name: verify-specs
description: Verify a built system against its spec — run each requirement's falsifying observation and report the verdict per ID. Use when a change lands against a spec, or before signing one off. Not for writing requirements (write-specs).
---

# Verify Specs

**Black-box** throughout — only an observation tells you what the system does. [write-specs](../write-specs/SKILL.md) names one per requirement; this skill runs them.

## Steps

### 1. Collect the observations

List every requirement ID in the spec beside its falsifying observation. Where a spec predates that convention, derive one from the requirement's Given/When/Then — the `Then` is the observable. Where none can be derived, rule it `unobservable` and send it to open questions rather than scoring it.

**Done when** every ID in the spec has a named observation or an `unobservable` ruling, with none unaccounted for.

### 2. Observe

Run each one against the built system — prefer a test (cite the [tdd](../tdd/SKILL.md) test name); fall back to a command when no test covers it, a manual request or check only when no automation exists. An ID whose evidence is an argument rather than an observation is **unmet**.

Unwanted-behavior requirements (`If … then …`) need the bad input actually sent. An error path nobody triggered is unverified, not passing.

**Done when** every scored ID carries evidence, and every `If … then …` requirement had its trigger fired.

### 3. Rule, then fold

Report the verdict table, then close the loop on the spec itself:

- **Unmet, code is wrong** — hand to [write-plan](../write-plan/SKILL.md) as a follow-up plan naming the IDs.
- **Unmet, spec is wrong** — hand to [write-specs](../write-specs/SKILL.md#spec-delta) as a delta; behavior changes in the spec first.
- **Met** — fold any delta that shipped into the canonical spec, IDs intact.

**Done when** every unmet and unobservable ID names its handoff, the verdict is written to its file, and any folded delta matches the [delta](../write-specs/SKILL.md#spec-delta) shape.

## Referencing

The verdict lives beside the spec it judges as `<name>.verify.md`, under the [referencing convention](../write-specs/SKILL.md#referencing) — paths relative to the verdict. Verifying again after fixes appends a dated section; the first verdict stays, since which requirements failed and when is the record.

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

## Unmet

- **R2** — <what was observed instead>. Handoff: <follow-up plan or spec delta>.

## Folded

- <the delta section merged into the canonical spec, or "none">
```
