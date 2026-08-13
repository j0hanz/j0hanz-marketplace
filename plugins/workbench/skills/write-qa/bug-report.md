# Bug report template

Part of [write-qa](SKILL.md), loaded when routing lands on a bug report — a defect observed in running software. Hunting bugs in a diff is [bug-hunt](../bug-hunt/SKILL.md); this template records what execution found.

Filed under `docs/qa/` — see Referencing in `SKILL.md`.

Severity is impact; priority (scale in `SKILL.md`) is scheduling urgency. Set both.

| Severity | Criteria                                                  |
| -------- | --------------------------------------------------------- |
| Critical | Outage, data loss, security breach, or core path unusable |
| High     | Major feature broken with no practical workaround         |
| Medium   | Partial break with a workaround                           |
| Low      | Cosmetic or rare edge                                     |

Default triage: frequent high/critical impact is P0/P1; rare low impact is P3. Set all other priorities from release risk and commitments.

```markdown
# BUG-[ID]: [Specific title - area + failure]

**Severity:** Critical | High | Medium | Low
**Priority:** P0 | P1 | P2 | P3
**Type:** Functional | UI | Performance | Security | Data | Crash
**Status:** Open | In Progress | Fixed | Verified | Closed
**Traceability:** [Feature, TC-..., or Not required]
**Reporter:** [Name]
**Date:** YYYY-MM-DD

## Environment

| Property          | Value                      |
| ----------------- | -------------------------- |
| OS                |                            |
| Browser / client  |                            |
| Device            |                            |
| Build             |                            |
| Environment       | Production / Staging / Dev |
| URL / entry point |                            |

## Description

[2-3 sentences: what breaks and who it affects.]

## Repro

**Preconditions:**

- [Account, data, config]

**Steps:**

1. [Concrete action]
2. [Action]
3. [Observe failure]

**Rate:** Always | N/M | Intermittent

## Expected

[Observable correct behavior.]

## Actual

[Observable incorrect behavior.]

## Evidence

- Screenshots / recording: [links or attached]
- Console / logs: [paste or attach]
- Network / stack: [paste or attach]

## Impact

| Aspect      | Detail                                       |
| ----------- | -------------------------------------------- |
| Users       | [All / role / segment]                       |
| Frequency   | [Always / often / rare]                      |
| Data        | [None / corruption / loss]                   |
| Workaround  | [Steps or None]                              |
| Regression? | [No / Yes - last good and first bad version] |
```

## UI addition

```markdown
## Design vs implementation

**Design ref:** [URL]

| Property                  | Expected | Actual | Match  |
| ------------------------- | -------- | ------ | ------ |
| [color/size/spacing/type] |          |        | Yes/No |
```

## Performance addition

```markdown
## Metrics

| Metric                      | Expected | Actual | Variance |
| --------------------------- | -------- | ------ | -------- |
| [load / API / memory / CPU] |          |        |          |

**Conditions:** data size, network, device.
```

## Security addition

```markdown
## Vulnerability

**Class:** [XSS | injection | authz | ...]
**OWASP:** [A0x]
**Exploitability:** Easy | Moderate | Hard
**Affected data:** [PII / payments / ...]
**Proof (sanitized):** [how to confirm]
**Recommended fix direction:** [high-level]
```

Use authorized, confidential channels for security evidence and keep proof sanitized.

## Crash addition

```markdown
## Failure detail

**Kind:** Crash | Exception | Hang | Blank screen
**Message:** [Exact message]
**Stack:** [Stack trace]
**Recovery:** [Data loss, session impact, and recoverability]
```

## Title pattern

`[Area] <what fails> when <condition>`

Example: `[Checkout] Total shows $0 when discount applied twice`
