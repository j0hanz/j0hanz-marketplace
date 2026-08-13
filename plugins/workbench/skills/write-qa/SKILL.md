---
name: write-qa
description: Create coverage-mapped QA test plans, manual cases, regression suites, and bug reports. Use when QA deliverables are requested, or when reviewing QA system for coherence.
---

# QA deliverables

Produce **coverage-mapped** QA deliverables. Every in-scope item traces to a check or a justified gap.

## 1. Route

| Ask                                         | Use                 | Deliverable                                          |
| ------------------------------------------- | ------------------- | ---------------------------------------------------- |
| Test plan, feature plan, release plan       | Test plan template  | Scope, risks, strategy, **coverage map**, entry/exit |
| Manual test cases or scenarios              | Test case template  | Executable cases with **observable** steps           |
| Smoke, targeted, full, or sanity regression | Regression template | Prioritized suite for affected surfaces              |
| Bug report or defect write-up               | Bug report template | **Repro**-ready defect                               |

If the requested output is ambiguous, ask which deliverable is needed once; when multiple deliverables are requested, produce each and cross-link their **traceability**.

**Done when:** every requested deliverable has a selected template.

## 2. Intake

Gather only what each requested deliverable needs to be actionable:

- Requirements, acceptance criteria, or observed failure
- Affected journeys, interfaces, services, data, integrations
- Environments, platforms, test data, constraints
- Changed behavior, designs, or blast radius

Missing context → targeted questions. User says proceed anyway → fill an **Assumption Register**, mark status **Draft**.

**Done when:** every needed input is known, marked unknown, or recorded as an assumption.

## 3. Coverage map

For each in-scope requirement and surface:

1. Inventory states, transitions, contracts, dependencies, error/retry paths.
2. Name the risk and the test dimension that addresses it.
3. Map to a planned case, suite check, or justified gap.
4. Keep the map inside the deliverable (plan and regression always; cases/bugs via **traceability**).

**Done when:** every in-scope item maps to coverage or an explicit justified gap.

## 4. Draft

Fill the relevant template below.

### Priority scale

| Priority | Meaning                                     |
| -------- | ------------------------------------------- |
| P0       | Release blocker / critical path — every run |
| P1       | High impact — before release                |
| P2       | Moderate — release or next cycle            |
| P3       | Low — when possible                         |

### Ready gates

| Deliverable      | **Ready** only when                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Test plan        | Objective, scope, environments, **coverage map**, entry/exit, and risks are complete; every gap justified                       |
| Test case        | At least one **observable** step; priority, objective, preconditions, data, and **traceability** present or marked not required |
| Regression suite | Level, order, pass/fail bar set; every affected surface covered or gap justified                                                |
| Bug report       | At least one **repro** step; environment; expected; actual; severity; priority                                                  |

**Done when:** the deliverable ready-gate passes, or the deliverable is explicitly **Draft**.

## Deliverable templates

### Test plan

```markdown
# Test Plan: [Feature or Release]

**Status:** Draft | Ready
**Owner:** [Name]
**Target build / release:** [ID]
**Last updated:** YYYY-MM-DD

## Objective

[What this plan validates and why it matters.]

## Inputs and assumptions

### Requirements and acceptance criteria

- [Requirement or AC]

### Assumption Register

| Assumption or unknown | Impact                       | Validation needed             |
| --------------------- | ---------------------------- | ----------------------------- |
| [Assumption]          | [Scope or confidence impact] | [Question, artifact, or test] |

## Scope

### In scope

- [Feature, flow, interface, service, data store, or integration]

### Out of scope

- [Excluded area - reason]

## Coverage map

| Requirement or surface | State, contract, or risk                              | Dimension               | Planned test or suite | Status                            |
| ---------------------- | ----------------------------------------------------- | ----------------------- | --------------------- | --------------------------------- |
| [Item]                 | [Transition, integration, failure, retry, dependency] | [Type - see type table] | [Test ID or scenario] | Planned / Covered / Justified gap |

## Strategy

- **Types:** [see type table]
- **Approach:** [positive, negative, boundary, state-transition, risk-based]
- **Regression blast radius:** [affected surfaces]

## Environment and data

| Area                                         | Required | Status                    |
| -------------------------------------------- | -------- | ------------------------- |
| [Browser, device, service, account, dataset] | [Need]   | Ready / Missing / Unknown |

## Entry criteria

- [ ] Requirements/ACs available or in the Assumption Register
- [ ] Environments and data ready or listed as blockers
- [ ] Coverage map complete with no unmapped in-scope items

## Exit criteria

- [ ] Every coverage-map row tested or an approved gap
- [ ] All P0 cases pass
- [ ] Open defects and residual risks documented with release impact
- [ ] Regression scope executed or deferred with rationale

## Risks

| Risk   | Likelihood | Impact    | Mitigation   | Owner   |
| ------ | ---------- | --------- | ------------ | ------- |
| [Risk] | L / M / H  | L / M / H | [Mitigation] | [Owner] |

## Deliverables

| Deliverable            | Owner  | Target     | Status                       |
| ---------------------- | ------ | ---------- | ---------------------------- |
| [Cases, suite, report] | [Name] | YYYY-MM-DD | Planned / In progress / Done |
```

### Test case

Use the default shape for every case. Append only the type addition required by **Type**.

```markdown
# TC-[ID]: [Title]

**Priority:** P0 | P1 | P2 | P3
**Type:** Functional | UI | Integration | Regression | Performance | Security | Smoke
**Traceability:** [Requirement, coverage-map row, or Not required]
**Status:** Not Run | Pass | Fail | Blocked | Skipped
**Estimated time:** [minutes]
**Created:** YYYY-MM-DD

## Objective

[What this case validates.]

## Preconditions

- [Setup, account, data, environment - or None]

## Steps

1. [Action]
   - **Input:** [data if any]
   - **Expected:** [observable result]

2. [Action]
   - **Expected:** [observable result]

## Test data

| Field   | Value   | Notes      |
| ------- | ------- | ---------- |
| [Field] | [Value] | [Handling] |

## Post-conditions

- [System state after run]
- [Cleanup]

## Edge cases

| Variation               | Input   | Expected |
| ----------------------- | ------- | -------- |
| [Empty / max / invalid] | [Value] | [Result] |

## Related

- [TC-... or None]

## Execution history

| Date | Tester | Build | Result | Bug ID | Notes |
| ---- | ------ | ----- | ------ | ------ | ----- |
|      |        |       |        |        |       |
```

Test types and their case-ID prefixes:

| Type        | Prefix   | Example     |
| ----------- | -------- | ----------- |
| Functional  | TC-FUNC- | TC-FUNC-001 |
| UI          | TC-UI-   | TC-UI-045   |
| Integration | TC-INT-  | TC-INT-012  |
| Regression  | TC-REG-  | TC-REG-089  |
| Security    | TC-SEC-  | TC-SEC-005  |
| Performance | TC-PERF- | TC-PERF-023 |
| Smoke       | SMOKE-   | SMOKE-001   |
| Exploratory | -        | unscripted  |

#### UI addition

```markdown
## Visual

**Design ref:** [URL]
**Breakpoints:** Desktop | Tablet | Mobile

| Element     | Property             | Expected | Actual | OK  |
| ----------- | -------------------- | -------- | ------ | --- |
| [Component] | [color/size/spacing] | [Spec]   |        | [ ] |

**Applicable states:** default | hover | active | focus | disabled - each matches design.
```

#### Integration addition

```markdown
## Contract

**Systems:** [A] -> [B]
**Endpoint / message:** [ID]

| Field   | Source  | Expected transform | OK  |
| ------- | ------- | ------------------ | --- |
| [Field] | [Value] | [Value]            | [ ] |

**Applicable failure paths:** timeout, invalid payload, auth failure, rate limit - state the expected handling for each.
```

#### Security addition

```markdown
## Control

**OWASP:** [A0x]
**Risk:** Critical | High | Medium | Low

- Attack vector under test: [description]
- Expected control: block / sanitize / deny with no information leak
- Audit log records the attempt
```

#### Performance addition

```markdown
## Metrics

| Metric        | Target | Acceptable | Actual | OK  |
| ------------- | ------ | ---------- | ------ | --- |
| Response time |        |            |        | [ ] |
| Throughput    |        |            |        | [ ] |
| Error rate    |        |            |        | [ ] |

**Load:** normal | peak | stress - record duration and concurrency.
```

#### Regression addition

```markdown
## Blast radius

**Recent changes that may affect this:**

- [Change]

**Still intact:** core path | persistence | UI | integrations | error handling
```

### Regression suite

Build from the **coverage map** of the **blast radius**.

| Level    | When                      | Scope                                            |
| -------- | ------------------------- | ------------------------------------------------ |
| Smoke    | Daily / build gate        | Critical paths only                              |
| Sanity   | After hotfix              | Narrow confirmation the fix holds                |
| Targeted | After a specific change   | Modified area plus blast radius                  |
| Full     | Release / major milestone | All in-scope functional and integration coverage |

Default to **Targeted** for a change set and **Full** for a release.

```markdown
# Regression Suite: [Change set or release]

**Status:** Draft | Ready
**Level:** Smoke | Sanity | Targeted | Full
**Build:** [ID]
**Environment:** [Name]
**Owner:** [Name]
**Last updated:** YYYY-MM-DD

## Blast radius

- Modified: [area]
- Connected: [components]
- Integrations / dependencies: [list]

## Coverage map

| Surface   | Risk               | Check ID         | Priority | Status                            |
| --------- | ------------------ | ---------------- | -------- | --------------------------------- |
| [Surface] | [What could break] | [SMOKE-/TC-/...] | P0-P3    | Planned / Covered / Justified gap |

## Execution order

1. Smoke, when included; stop if its failure makes the build unstable.
2. P0
3. P1
4. P2 / P3
5. Short exploratory pass on the blast radius

## Pass / fail bar

- **Pass:** all P0 pass, the agreed P1 threshold is met, and no critical defects remain open.
- **Fail (block):** any P0 fails, or a critical defect, security break, or data-loss path is found.
- **Conditional:** P1 failures have a workaround and documented fix plan.

## Cases

| ID   | Title   | Priority | Result | Bug | Notes |
| ---- | ------- | -------- | ------ | --- | ----- |
| [ID] | [Title] | P0-P3    |        |     |       |

## Report

| Suite slice | Total | Pass | Fail | Blocked | Rate |
| ----------- | ----- | ---- | ---- | ------- | ---- |
| Smoke       |       |      |      |         |      |
| P0          |       |      |      |         |      |
| P1          |       |      |      |         |      |
| P2+         |       |      |      |         |      |
| **Total**   |       |      |      |         |      |

**Critical failures:** [BUG-... - impact - status]

**Recommendation:** Go | Conditional go | No-go
**Residual risks:** [list]
**Next steps:** [list]
```

After each run, remove obsolete checks, add **repro** cases for bugs found, refresh test data, and re-check the blast radius against the latest change set.

### Bug report

Severity is impact; priority is scheduling urgency. Set both.

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

#### UI addition

```markdown
## Design vs implementation

**Design ref:** [URL]

| Property                  | Expected | Actual | Match  |
| ------------------------- | -------- | ------ | ------ |
| [color/size/spacing/type] |          |        | Yes/No |
```

#### Performance addition

```markdown
## Metrics

| Metric                      | Expected | Actual | Variance |
| --------------------------- | -------- | ------ | -------- |
| [load / API / memory / CPU] |          |        |          |

**Conditions:** data size, network, device.
```

#### Security addition

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

#### Crash addition

```markdown
## Failure detail

**Kind:** Crash | Exception | Hang | Blank screen
**Message:** [Exact message]
**Stack:** [Stack trace]
**Recovery:** [Data loss, session impact, and recoverability]
```

#### Title pattern

`[Area] <what fails> when <condition>`

Example: `[Checkout] Total shows $0 when discount applied twice`
