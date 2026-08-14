---
name: write-qa
description: Create coverage-mapped QA deliverables. Use when asked for a test plan, manual cases, a regression suite, or a bug report. Not for automated tests (tdd), hunting bugs in a diff (bug-hunt), or verifying a landed change against its spec (verify-specs).
---

# Write QA

Where a spec exists, its requirement IDs are the coverage map's spine ([write-specs](../write-specs/SKILL.md)); an observation that can be automated belongs to [tdd](../tdd/SKILL.md) — a manual case covers what only a human run can check.

## Steps

### 1. Route

| Ask                                      | Deliverable      | Template                                   |
| ---------------------------------------- | ---------------- | ------------------------------------------ |
| Test plan, feature plan, release plan    | Test plan        | [test-plan.md](test-plan.md)               |
| Manual test cases or scenarios           | Test case        | [test-case.md](test-case.md)               |
| Smoke, sanity, targeted, full regression | Regression suite | [regression-suite.md](regression-suite.md) |
| Bug report or defect write-up            | Bug report       | [bug-report.md](bug-report.md)             |

Ambiguous ask → ask which deliverable, once. Several requested → produce each and cross-link their **traceability**.

A regression suite also carries a level, which fixes its scope before intake:

| Level    | When                      | Scope                                            |
| -------- | ------------------------- | ------------------------------------------------ |
| Smoke    | Daily / build gate        | Critical paths only                              |
| Sanity   | After hotfix              | Narrow confirmation the fix holds                |
| Targeted | After a specific change   | Modified area plus blast radius                  |
| Full     | Release / major milestone | All in-scope functional and integration coverage |

Default to **Targeted** for a change set and **Full** for a release.

**Done when** every requested deliverable names its template, and any regression suite names its level.

### 2. Intake

Gather only what the routed deliverables need to be actionable:

- Requirements, acceptance criteria, or the observed failure
- Affected journeys, interfaces, services, data, integrations
- Environments, platforms, test data, constraints
- Changed behavior, designs, blast radius

Missing context the material cannot answer → ask the user; [grilling](../grilling/SKILL.md) is how. User says proceed anyway → fill an **Assumption Register** and mark the deliverable **Draft**.

**Done when** every needed input is known, marked unknown, or sits in the Assumption Register.

### 3. Coverage map

For each in-scope requirement and surface:

1. Inventory states, transitions, contracts, dependencies, error/retry paths — fan out [research](../research/SKILL.md) where the surface is wide.
2. Name the risk and the test type that addresses it.
3. Map to a planned case, suite check, or justified gap, citing the requirement ID where a spec exists.
4. Keep the map inside the deliverable — plan and regression always; cases and bugs via **traceability**.

**Done when** every in-scope item maps to coverage or an explicit justified gap.

### 4. Draft

Read each routed template file, then fill it against the shared scales below.

#### Priority scale

| Priority | Meaning                                     |
| -------- | ------------------------------------------- |
| P0       | Release blocker / critical path — every run |
| P1       | High impact — before release                |
| P2       | Moderate — release or next cycle            |
| P3       | Low — when possible                         |

#### Ready gates

| Deliverable      | **Ready** only when                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Test plan        | Objective, scope, environments, **coverage map**, entry/exit, and risks complete; every gap justified                           |
| Test case        | At least one **observable** step; priority, objective, preconditions, data, and **traceability** present or marked not required |
| Regression suite | Level, order, and pass/fail bar set; every affected surface covered or gap justified                                            |
| Bug report       | At least one **repro** step; environment, expected, actual, severity, and priority set                                          |

**Done when** each deliverable passes its ready gate, or is explicitly **Draft**.

## Test types

One prefix per type, carried in the case ID.

| Type        | Prefix   | Example     |
| ----------- | -------- | ----------- |
| Functional  | TC-FUNC- | TC-FUNC-001 |
| UI          | TC-UI-   | TC-UI-045   |
| Integration | TC-INT-  | TC-INT-012  |
| Regression  | TC-REG-  | TC-REG-089  |
| Security    | TC-SEC-  | TC-SEC-005  |
| Performance | TC-PERF- | TC-PERF-023 |
| Smoke       | SMOKE-   | SMOKE-001   |
| Exploratory | —        | unscripted  |

## Referencing

Where a deliverable lives follows its lifetime, under the [referencing convention](../write-specs/SKILL.md#referencing).

Change-scoped QA files follow the [referencing convention](../write-specs/SKILL.md#referencing). Net-new here: standing QA filenames — bugs as `BUG-NNN-<slug>.md`, release and build-gate suites as `<release-or-gate>.regression.md`.

`<name>.cases.md` collects the whole set into one file (structure in `test-case.md`); the coverage map links to anchors inside it.

```markdown
case to requirement [`R2`](<name>.spec.md#requirements)
case to bug [`BUG-007`](../../../docs/qa/BUG-007-checkout-total-zero.md)
bug to spec [`auth spec`](../plan/2026-08-13-auth/auth.spec.md)
suite to case [`TC-FUNC-001`](../plan/2026-08-13-auth/auth.cases.md#tc-func-001)
```

A bug found while executing a case gets the next `BUG-` number and a link from the case's execution history.
